import { createClient } from '@supabase/supabase-js';
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || 'https://khxpktnhseoyeoumusou.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoeHBrdG5oc2VveWVvdW11c291Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzE2NDkzNiwiZXhwIjoyMDkyNzQwOTM2fQ.ifUxU3D_0Q6WDWIXd-P0PbJ90Tif9Cl9mB0IB0GKlpM',
  { auth: { persistSession: false } }
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Delete all rows — gt id 0 matches everything (uuid trick: gte a null-ish uuid)
    const { error, count } = await supabaseAdmin
      .from('conversations')
      .delete({ count: 'exact' })
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (error) {
      console.error('[deleteAll] Supabase error:', error.message);
      return res.status(500).json({ error: 'Failed to delete', detail: error.message });
    }
    return res.status(200).json({ success: true, deleted: count ?? 0 });
  } catch (err) {
    console.error('[deleteAll] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
}
