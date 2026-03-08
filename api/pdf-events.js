const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://clrohoqwwkrbwopcsvrr.supabase.co';
const supabaseKey = 'sb_publishable_Nu5Eay-XNtfwKlDTSQFZQQ_6b0agmFe';
const supabase   = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { data, error } = await supabase
    .from('pdf_events')
    .select('*')
    .order('occurred_at', { ascending: false })
    .limit(200);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.status(200).json(data);
};
