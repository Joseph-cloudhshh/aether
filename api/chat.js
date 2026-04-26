import { createClient } from '@supabase/supabase-js';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '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';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://khxpktnhseoyeoumusou.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoeHBrdG5oc2VveWVvdW11c291Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzE2NDkzNiwiZXhwIjoyMDkyNzQwOTM2fQ.ifUxU3D_0Q6WDWIXd-P0PbJ90Tif9Cl9mB0IB0GKlpM';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'anthropic/claude-3-haiku';

async function buildMemoryContext(selectedMemoryIds) {
  if (!selectedMemoryIds || selectedMemoryIds.length === 0) return '';
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data, error } = await supabase
    .from('conversations').select('id, title, content, created_at')
    .in('id', selectedMemoryIds).order('created_at', { ascending: false });
  if (error || !data || data.length === 0) return '';
  const blocks = data.map((conv, i) => {
    const date = new Date(conv.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    return `[Memory ${i + 1}] "${conv.title}" (${date})\n${conv.content.trim()}`;
  });
  return ['=== MEMORY CONTEXT ===', 'Use these memories to inform your response:', '', blocks.join('\n\n'), '=== END MEMORY CONTEXT ==='].join('\n');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { message, selectedMemoryIds = [], memory = [], history = [], stream = false, systemPrompt = '' } = req.body ?? {};
    if (!message || typeof message !== 'string' || !message.trim()) return res.status(400).json({ error: 'message is required' });

    let memoryContext = '';
    if (selectedMemoryIds.length > 0) { memoryContext = await buildMemoryContext(selectedMemoryIds); }
    else if (memory.length > 0) { memoryContext = ['=== MEMORY CONTEXT ===', 'User preferences:', '', memory.map((m, i) => `[${i+1}] ${m}`).join('\n'), '=== END MEMORY CONTEXT ==='].join('\n'); }

    const userPrompt = memoryContext ? `${memoryContext}\n\nUser message: ${message.trim()}` : message.trim();
    const sysContent = systemPrompt || 'You are Aether, a helpful AI assistant. When memory context is provided, use it to personalise responses. Be concise, clear, and helpful. Format code with markdown code blocks.';
    const messages = [{ role: 'system', content: sysContent }];
    for (const turn of history.slice(-12)) {
      const role = turn.role === 'ai' ? 'assistant' : turn.role;
      if (role === 'user' || role === 'assistant') messages.push({ role, content: String(turn.content || '') });
    }
    messages.push({ role: 'user', content: userPrompt });

    if (stream) {
      const orRes = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${OPENROUTER_API_KEY}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://aether.chat', 'X-Title': 'Aether AI Chat' },
        body: JSON.stringify({ model: MODEL, messages, max_tokens: 1500, temperature: 0.7, stream: true }),
      });
      if (!orRes.ok) { const e = await orRes.text().catch(()=>''); return res.status(502).json({ error: `AI service error: ${orRes.status}`, detail: e.slice(0,200) }); }
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      const reader = orRes.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n'); buffer = lines.pop();
        for (const line of lines) {
          const t = line.trim();
          if (!t || t === 'data: [DONE]') continue;
          if (t.startsWith('data: ')) {
            try { const j = JSON.parse(t.slice(6)); const tok = j.choices?.[0]?.delta?.content; if (tok) res.write(`data: ${JSON.stringify({ token: tok })}\n\n`); } catch(_) {}
          }
        }
      }
      res.write('data: [DONE]\n\n');
      return res.end();
    }

    const orRes = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENROUTER_API_KEY}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://aether.chat', 'X-Title': 'Aether AI Chat' },
      body: JSON.stringify({ model: MODEL, messages, max_tokens: 1500, temperature: 0.7 }),
    });
    if (!orRes.ok) { const e = await orRes.text().catch(()=>''); return res.status(502).json({ error: `AI service error: ${orRes.status}`, detail: e.slice(0,200) }); }
    const orData = await orRes.json();
    const reply = orData.choices?.[0]?.message?.content;
    if (!reply) return res.status(502).json({ error: 'No reply from AI service' });
    return res.status(200).json({ reply });
  } catch (err) {
    console.error('[chat] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
}
