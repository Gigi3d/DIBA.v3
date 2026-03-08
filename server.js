const express = require('express');
const path = require('path');
const trackApi = require('./api/track.js');
const sessionsApi = require('./api/sessions.js');
const trackPdfOpen = require('./api/track-pdf-open.js');
const trackPdfLink = require('./api/track-pdf-link.js');
const pdfEventsApi = require('./api/pdf-events.js');
const { execSync } = require('child_process');
const fs = require('fs');
const crypto = require('crypto');

const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

// Serve static files (HTML, CSS, JS, images) from the current folder
app.use(express.static(path.join(__dirname)));

// Route specifically for the Vercel serverless function at /api/track
app.post('/api/track', async (req, res) => {
  try {
    await trackApi(req, res);
  } catch (error) {
    console.error('Error handling /api/track:', error);
    res.status(500).json({ error: error.message });
  }
});

// Route specifically for the Vercel serverless function at /api/sessions
app.get('/api/sessions', async (req, res) => {
  try {
    await sessionsApi(req, res);
  } catch (error) {
    console.error('Error handling /api/sessions:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── PDF Analytics Routes ───────────────────────────────────────────────────
// Tracking pixel: fires when the downloaded PDF is opened in a PDF viewer
app.get('/api/track-pdf-open', async (req, res) => {
  try { await trackPdfOpen(req, res); } catch (e) { res.status(500).end(); }
});

// Redirect tracker: logs clicks on links inside the PDF then redirects
app.get('/api/track-pdf-link', async (req, res) => {
  try { await trackPdfLink(req, res); } catch (e) { res.redirect(302, req.query.url || '/'); }
});

// Read all PDF open/click events (used by admin dashboard)
app.get('/api/pdf-events', async (req, res) => {
  try { await pdfEventsApi(req, res); } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============ PDF EXPORT ROUTE (with embedded analytics) ============
app.get('/api/export-pdf', async (req, res) => {
  const tmpPdfPath = path.join(__dirname, '_deck_export_tmp.pdf');
  try {
    console.log('📄 PDF export requested, launching Puppeteer...');

    // Generate a unique ID for this PDF download so we can track it
    const pdfId   = crypto.randomBytes(8).toString('hex');
    const email   = req.query.email || '';
    const BASE_URL = 'https://diba-v3.vercel.app'; // Production tracker base

    // Build tracked redirect URL helper
    const trackedUrl = (dest, label) => {
      const params = new URLSearchParams({ id: pdfId, url: dest, label });
      if (email) params.set('email', email);
      return `${BASE_URL}/api/track-pdf-link?${params.toString()}`;
    };

    // Tracking pixel URL (fires when PDF is opened)
    const pixelParams = new URLSearchParams({ id: pdfId });
    if (email) pixelParams.set('email', email);
    const pixelUrl = `${BASE_URL}/api/track-pdf-open?${pixelParams.toString()}`;

    const { default: puppeteer } = await import('puppeteer-core');
    const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    const TOTAL_SLIDES = 17;
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    // --- Phase 1: Capture all slides as screenshots ---
    const browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security', '--disable-dev-shm-usage', '--window-size=1600,900'],
      defaultViewport: { width: 1600, height: 900 }
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1600, height: 900, deviceScaleFactor: 2 });
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(2500);

    const slideBuffers = [];
    for (let i = 0; i < TOTAL_SLIDES; i++) {
      await page.evaluate((idx) => {
        document.querySelectorAll('.slide').forEach((s, j) => {
          s.style.display = j === idx ? 'flex' : 'none';
          s.style.opacity = j === idx ? '1' : '0';
          j === idx ? s.classList.add('active') : s.classList.remove('active');
        });
        ['#prevBtn', '#nextBtn', '.nav-controls', '.deck-footer', '.fullscreen-btn', '#pdfBtn'].forEach(sel => {
          const el = document.querySelector(sel);
          if (el) el.style.display = 'none';
        });
      }, i);
      await sleep(700);
      slideBuffers.push(await page.screenshot({ type: 'png', fullPage: false }));
      console.log(`  ✅ Slide ${i + 1} captured`);
    }
    await browser.close();

    // --- Phase 2: Stitch into PDF with tracking embedded ---
    const imagesHtml = slideBuffers.map((buf, i) => {
      // On the LAST slide (contact), add clickable tracked link overlays
      const isLastSlide = (i === TOTAL_SLIDES - 1);
      const overlay = isLastSlide ? `
        <div style="position:absolute;top:0;left:0;width:100%;height:100%;">
          <a href="${trackedUrl('https://calendly.com/bitgidie', 'calendly_cta')}"
             style="position:absolute;bottom:38%;left:57%;width:32%;height:8%;display:block;"
             title="Request a Meeting"></a>
          <a href="${trackedUrl('https://diba.io', 'diba_website')}"
             style="position:absolute;bottom:27%;left:57%;width:12%;height:4%;display:block;"
             title="diba.io"></a>
          <a href="${trackedUrl('https://bitmask.app', 'bitmask_website')}"
             style="position:absolute;bottom:27%;left:70%;width:16%;height:4%;display:block;"
             title="bitmask.app"></a>
          <a href="mailto:gideon@diba.io"
             style="position:absolute;bottom:31%;left:57%;width:25%;height:4%;display:block;"
             title="Email Gideon"></a>
        </div>` : '';
      return `<div class="page" style="position:relative;">${overlay}<img src="data:image/png;base64,${buf.toString('base64')}" /></div>`;
    }).join('\n');

    // Invisible 1x1 tracking pixel + PDF metadata in <head>
    const printHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8">
      <title>DIBA × BitMask — Institutional Investor Deck 2026</title>
      <meta name="author" content="DIBA × BitMask">
      <meta name="subject" content="Institutional Investor Deck 2026">
      <meta name="keywords" content="Bitcoin, RGB, DIBA, BitMask, Tokenization, Digital Assets">
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        @page{size:1600px 900px;margin:0}
        body{width:1600px;background:#000}
        .page{width:1600px;height:900px;display:flex;align-items:center;justify-content:center;page-break-after:always;overflow:hidden;position:relative;}
        .page img{width:1600px;height:900px;display:block;object-fit:cover;position:relative;z-index:0;}
        .page div{z-index:1;}
        #tracker{position:absolute;width:1px;height:1px;opacity:0.01;top:0;left:0;}
      </style>
      </head><body>
      <img id="tracker" src="${pixelUrl}" width="1" height="1" alt="" />
      ${imagesHtml}
    </body></html>`;

    const tmpHtml = path.join(require('os').tmpdir(), 'diba_print.html');
    fs.writeFileSync(tmpHtml, printHtml);

    const browser2 = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      defaultViewport: { width: 1600, height: 900 }
    });
    const page2 = await browser2.newPage();
    await page2.goto(`file://${tmpHtml}`, { waitUntil: 'networkidle0', timeout: 60000 });
    await sleep(1000);
    await page2.pdf({
      path: tmpPdfPath,
      width: '1600px',
      height: '900px',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      displayHeaderFooter: false,
    });
    await browser2.close();
    fs.unlinkSync(tmpHtml);

    console.log(`✅ PDF ready [id=${pdfId}], streaming to client...`);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="DIBA_Institutional_Deck.pdf"`);
    const stream = fs.createReadStream(tmpPdfPath);
    stream.pipe(res);
    stream.on('end', () => { try { fs.unlinkSync(tmpPdfPath); } catch(e) {} });

  } catch (err) {
    console.error('❌ PDF export error:', err);
    try { fs.unlinkSync(tmpPdfPath); } catch(e) {}
    res.status(500).json({ error: err.message });
  }
});
// ===========================================================================

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
  console.log('\n====================================');
  console.log('🚀 Local Environment Ready!');
  console.log('====================================');
  console.log(`🔹 Main Deck: http://localhost:${PORT}`);
  console.log(`🔹 Admin Dashboard: http://localhost:${PORT}/admin.html`);
  console.log(`🔹 Export PDF:  http://localhost:${PORT}/api/export-pdf`);
  console.log('====================================\n');
});

