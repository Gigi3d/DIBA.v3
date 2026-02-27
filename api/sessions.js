const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://clrohoqwwkrbwopcsvrr.supabase.co';
const supabaseKey = 'sb_publishable_Nu5Eay-XNtfwKlDTSQFZQQ_6b0agmFe';
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { data, error } = await supabase
    .from('deck_sessions')
    .select('*')
    .order('started', { ascending: false });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  // Convert map keys back to camelCase for the frontend
  const formattedData = data.map(s => ({
    id: s.id,
    started: s.started,
    email: s.email,
    version: s.version,
    lastActivity: s.last_activity,
    totalTimeSpentMs: parseInt(s.total_time_spent_ms) || 0,
    slideTimeMs: s.slide_time_ms || {},
    slidesViewed: s.slides_viewed || [],
    lastSlide: s.last_slide,
    emailSubmittedAt: s.email_submitted_at
  }));

  res.status(200).json(formattedData);
};
