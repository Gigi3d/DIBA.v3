const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://clrohoqwwkrbwopcsvrr.supabase.co';
const supabaseKey = 'sb_publishable_Nu5Eay-XNtfwKlDTSQFZQQ_6b0agmFe';
const supabase   = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
  const pdfId  = req.query.id  || 'unknown';
  const dest   = req.query.url || 'https://diba.io';
  const label  = req.query.label || 'unknown';
  const email  = req.query.email || null;
  const ip     = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
  const ua     = req.headers['user-agent'] || null;

  // Redirect immediately — log after
  res.redirect(302, dest);

  try {
    await supabase.from('pdf_events').insert({
      pdf_id:      pdfId,
      event_type:  'link_click',
      link_label:  label,
      link_url:    dest,
      email:       email,
      ip_address:  ip,
      user_agent:  ua,
      occurred_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[pdf-link tracker]', err.message);
  }
};
