import { createClient } from '@supabase/supabase-js';
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || 'https://khxpktnhseoyeoumusou.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoeHBrdG5oc2VveWVvdW11c291Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzE2NDkzNiwiZXhwIjoyMDkyNzQwOTM2fQ.ifUxU3D_0Q6WDWIXd-P0PbJ90Tif9Cl9mB0IB0GKlpM',
  { auth: { persistSession: false } }
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = parseInt(req.query.offset) || 0;

    const { data, error, count } = await supabaseAdmin
      .from('conversations')
      .select('id, title, content, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[getConversations] Supabase error:', error.message);
      return res.status(500).json({ error: 'Failed to fetch conversations', detail: error.message });
    }

    return res.status(200).json({
      conversations: data || [],
      total: count ?? 0,
      limit,
      offset,
    });

  } catch (err) {
    console.error('[getConversations] Unhandled error:', err);
    return res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
}
