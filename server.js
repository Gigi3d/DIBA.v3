const express = require('express');
const path = require('path');
const trackApi = require('./api/track.js');
const sessionsApi = require('./api/sessions.js');
const { execSync } = require('child_process');
const fs = require('fs');

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

// ============ PDF EXPORT ROUTE ============
app.get('/api/export-pdf', async (req, res) => {
  const tmpPdfPath = path.join(__dirname, '_deck_export_tmp.pdf');
  try {
    console.log('📄 PDF export requested, launching Puppeteer...');

    // Dynamically import puppeteer-core (ESM)
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

    // --- Phase 2: Stitch into PDF ---
    const imagesHtml = slideBuffers.map(buf =>
      `<div class="page"><img src="data:image/png;base64,${buf.toString('base64')}" /></div>`
    ).join('\n');

    const printHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
      *{margin:0;padding:0;box-sizing:border-box}
      @page{size:1600px 900px;margin:0}
      body{width:1600px;background:#000}
      .page{width:1600px;height:900px;display:flex;align-items:center;justify-content:center;page-break-after:always;overflow:hidden}
      .page img{width:1600px;height:900px;display:block;object-fit:cover}
    </style></head><body>${imagesHtml}</body></html>`;

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
    await page2.pdf({ path: tmpPdfPath, width: '1600px', height: '900px', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
    await browser2.close();
    fs.unlinkSync(tmpHtml);

    console.log('✅ PDF ready, streaming to client...');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="DIBA_Institutional_Deck.pdf"');
    const stream = fs.createReadStream(tmpPdfPath);
    stream.pipe(res);
    stream.on('end', () => { try { fs.unlinkSync(tmpPdfPath); } catch(e) {} });

  } catch (err) {
    console.error('❌ PDF export error:', err);
    try { fs.unlinkSync(tmpPdfPath); } catch(e) {}
    res.status(500).json({ error: err.message });
  }
});
// ==========================================

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

