import { createClient } from '@supabase/supabase-js';
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || 'https://khxpktnhseoyeoumusou.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoeHBrdG5oc2VveWVvdW11c291Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzE2NDkzNiwiZXhwIjoyMDkyNzQwOTM2fQ.ifUxU3D_0Q6WDWIXd-P0PbJ90Tif9Cl9mB0IB0GKlpM',
  { auth: { persistSession: false } }
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { title, content } = req.body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'title is required' });
    }
    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ error: 'content is required' });
    }

    const { data, error } = await supabaseAdmin
      .from('conversations')
      .insert([{ title: title.trim(), content: content.trim() }])
      .select()
      .single();

    if (error) {
      console.error('[saveConversation] Supabase error:', error.message);
      return res.status(500).json({ error: 'Failed to save conversation', detail: error.message });
    }

    return res.status(201).json({ success: true, conversation: data });

  } catch (err) {
    console.error('[saveConversation] Unhandled error:', err);
    return res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
}
