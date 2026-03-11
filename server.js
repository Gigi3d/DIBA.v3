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
    const TOTAL_SLIDES = 16;
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    // --- Phase 1: Capture all slides as screenshots ---
    const browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox', 
        '--disable-web-security', 
        '--disable-dev-shm-usage', 
        '--window-size=1600,900',
        '--force-color-profile=srgb'
      ],
      defaultViewport: { width: 1600, height: 900 }
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1600, height: 900, deviceScaleFactor: 2 });
    
    // Ensure accurate sizing and media matching
    await page.emulateMediaType('screen');
    
    // Wait until network is completely idle
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0', timeout: 60000 });
    
    // Ensure all fonts are fully loaded
    await page.evaluateHandle('document.fonts.ready');
    
    // Force wait for all images
    await page.evaluate(async () => {
      const images = Array.from(document.querySelectorAll('img'));
      await Promise.all(images.map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => {
           img.onload = resolve;
           img.onerror = resolve; // Continue even if an image fails
        });
      }));
    });

    // Provide extra breathing room for WebGL/Canvas/Lottie components to init
    await sleep(5000);

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

      // Give the slide ample moment to render newly visible layers
      await sleep(1000);
      await page.evaluate(() => {
        const slide = document.querySelector('.slide.active');
        if (!slide) return;

        // ── 1. Snap explicit [data-countup] elements ─────────────────────────
        slide.querySelectorAll('[data-countup]').forEach(el => {
          const prefix = el.dataset.prefix || '';
          const target = parseFloat(el.dataset.target);
          const suffix = el.dataset.suffix !== undefined ? el.dataset.suffix : '';
          if (!isNaN(target)) {
            el.textContent = prefix + target + suffix;
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
            el.style.transition = 'none';
          }
        });

        // ── 2. Snap auto-detected large-font stat numbers ────────────────────
        // These are wrapped in a <span> by the smartCountUp engine mid-animation.
        // We detect them by font-size and numeric text content.
        function parseNumStr(s) {
          s = (s || '').trim();
          const m = s.match(/^(\$?)(\d+(?:\.\d+)?)(k|M|B|T)?(\+|%)?$/);
          if (!m) return null;
          return { prefix: m[1]||'', value: parseFloat(m[2]), unit: m[3]||'', extra: m[4]||'' };
        }

        // Target both the wrapper elements and any animation spans inserted inside them
        slide.querySelectorAll('[style*="font-size"]').forEach(el => {
          const fsStr = (el.style.fontSize || '');
          const fs = parseFloat(fsStr);
          const unit = fsStr.replace(/[\d.]/g, '');
          if (!fs || (unit === 'rem' && fs < 1.8) || (unit === 'px' && fs < 26)) return;

          // Check direct text nodes (before wrapping in span)
          const rawText = Array.from(el.childNodes)
            .filter(n => n.nodeType === Node.TEXT_NODE)
            .map(n => n.textContent).join('').trim();
          const parsed = parseNumStr(rawText);
          if (parsed) {
            // Not yet wrapped — snap the text node directly
            Array.from(el.childNodes)
              .filter(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim())
              .forEach(tn => { tn.textContent = parsed.prefix + parsed.value + parsed.unit + parsed.extra; });
            return;
          }

          // Check if there's an animation span inside (already wrapped)
          const animSpan = Array.from(el.childNodes).find(n =>
            n.nodeType === Node.ELEMENT_NODE && n.tagName === 'SPAN' && !n.dataset.countup
          );
          if (animSpan) {
            const p2 = parseNumStr(animSpan.textContent);
            if (p2) {
              animSpan.textContent = p2.prefix + p2.value + p2.unit + p2.extra;
              animSpan.style.opacity = '1';
              animSpan.style.transform = 'translateY(0)';
              animSpan.style.transition = 'none';
            }
          }
        });

        // ── 3. Remove all CSS transitions & animations to prevent ghosting ────
        const styleTag = document.createElement('style');
        styleTag.id = '_pdf_snap_style';
        styleTag.textContent = `
          .slide.active *, .slide.active *::before, .slide.active *::after {
            animation-play-state: paused !important;
            animation-duration: 0s !important;
            transition: none !important;
          }
        `;
        if (!document.getElementById('_pdf_snap_style')) {
          document.head.appendChild(styleTag);
        }
      });

      await sleep(1500);
      
      const links = await page.evaluate(() => {
        const slide = document.querySelector('.slide.active');
        if (!slide) return [];
        return Array.from(slide.querySelectorAll('a[href]'))
          .filter(a => {
            const rect = a.getBoundingClientRect();
            // Ignore hidden items
            return rect.width > 0 && rect.height > 0 && 
                   window.getComputedStyle(a).visibility !== 'hidden' &&
                   a.href && !a.href.startsWith('javascript:');
          })
          .map(a => {
            const rect = a.getBoundingClientRect();
            return {
              href: a.href,
              title: a.title || a.textContent.trim() || 'link',
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height
            };
          });
      });

      const buffer = await page.screenshot({ type: 'png', fullPage: false, omitBackground: false });
      slideBuffers.push({ buffer, links });
      console.log(`  ✅ Slide ${i + 1} captured (${links.length} interactive links)`);
    }
    await browser.close();

    // --- Phase 2: Stitch into PDF with tracking embedded ---
    const imagesHtml = slideBuffers.map((slideData, i) => {
      const { buffer, links } = slideData;
      let overlayHtml = '';
      
      if (links && links.length > 0) {
        overlayHtml = links.map(link => {
          let dest = link.href;
          // Apply tracking layer to outbound http links, leave mailto pristine
          if (dest.startsWith('http')) {
            dest = trackedUrl(dest, link.title);
          }
          // The block uses opacity 0.01 instead of completely transparent or hidden
          // so the PDF engine is absolutely guaranteed to pick up the click area bounding box
          return `<a href="${dest}" title="${link.title}" style="position:absolute;left:${link.x}px;top:${link.y}px;width:${link.width}px;height:${link.height}px;display:block;z-index:10;color:transparent;font-size:${Math.max(link.height, 12)}px;line-height:${link.height}px;text-decoration:none;overflow:hidden;opacity:0.01;">█</a>`;
        }).join('\n');
      }
      
      return `<div class="page" style="position:relative;">
        <div style="position:absolute;top:0;left:0;width:100%;height:100%;z-index:2;pointer-events:none;">
          ${overlayHtml}
        </div>
        <img src="data:image/png;base64,${buffer.toString('base64')}" />
      </div>`;
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
        body{
          width:1600px;
          background:#000;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
        }
        .page{width:1600px;height:900px;display:flex;align-items:center;justify-content:center;page-break-after:always;overflow:hidden;position:relative;}
        .page img{
          width:1600px;
          height:900px;
          display:block;
          object-fit:cover;
          position:relative;
          z-index:0;
          image-rendering: high-quality;
        }
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
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox', 
        '--disable-dev-shm-usage',
        '--force-color-profile=srgb'
      ],
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

