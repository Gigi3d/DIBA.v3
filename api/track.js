const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://clrohoqwwkrbwopcsvrr.supabase.co';
const supabaseKey = 'sb_publishable_Nu5Eay-XNtfwKlDTSQFZQQ_6b0agmFe';
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const s = req.body;

  const { data, error } = await supabase
    .from('deck_sessions')
    .upsert({
      id: s.id,
      started: s.started,
      email: s.email || null,
      version: s.version || null,
      last_activity: s.lastActivity || s.started,
      total_time_spent_ms: s.totalTimeSpentMs || 0,
      slide_time_ms: s.slideTimeMs || {},
      slides_viewed: s.slidesViewed || [],
      last_slide: s.lastSlide || 1,
      email_submitted_at: s.emailSubmittedAt || null
    });

  if (error) {
    console.error('Supabase error:', error);
    return res.status(500).json({ error: error.message });
  }

  res.status(200).json({ success: true });
};
