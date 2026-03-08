const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://clrohoqwwkrbwopcsvrr.supabase.co';
const supabaseKey = 'sb_publishable_Nu5Eay-XNtfwKlDTSQFZQQ_6b0agmFe';
const supabase = createClient(supabaseUrl, supabaseKey);

// 1x1 transparent GIF
const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

module.exports = async (req, res) => {
  // Always serve pixel first — never block the response
  res.setHeader('Content-Type', 'image/gif');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.end(PIXEL);

  // Log asynchronously (don't await — pixel already sent)
  try {
    const pdfId     = req.query.id   || 'unknown';
    const email     = req.query.email || null;
    const userAgent = req.headers['user-agent'] || null;
    const ip        = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();

    await supabase.from('pdf_events').insert({
      pdf_id:     pdfId,
      event_type: 'open',
      email:      email,
      user_agent: userAgent,
      ip_address: ip,
      occurred_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[pdf-open tracker]', err.message);
  }
};
