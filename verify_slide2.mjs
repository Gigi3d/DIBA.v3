import puppeteer from 'puppeteer-core';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME_PATH,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
  defaultViewport: { width: 1600, height: 900 }
});

const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 900, deviceScaleFactor: 2 });
await page.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 30000 });
await sleep(2500);

// Activate slide 2 (Market Size) — index 1
await page.evaluate(() => {
  document.querySelectorAll('.slide').forEach((s, j) => {
    s.style.display = j === 1 ? 'flex' : 'none';
    s.style.opacity = j === 1 ? '1' : '0';
    j === 1 ? s.classList.add('active') : s.classList.remove('active');
  });
  ['#prevBtn', '#nextBtn', '.nav-controls', '.deck-footer', '.fullscreen-btn', '#pdfBtn'].forEach(sel => {
    const el = document.querySelector(sel);
    if (el) el.style.display = 'none';
  });
});

await sleep(400);

// Snap all countup animations to final values (same logic as server.js fix)
await page.evaluate(() => {
  const slide = document.querySelector('.slide.active');
  if (!slide) return;

  // 1. Snap explicit [data-countup] elements
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

  // 2. Snap auto-detected large-font stat numbers
  function parseNumStr(s) {
    s = (s || '').trim();
    const m = s.match(/^(\$?)(\d+(?:\.\d+)?)(k|M|B|T)?(\+|%)?$/);
    if (!m) return null;
    return { prefix: m[1]||'', value: parseFloat(m[2]), unit: m[3]||'', extra: m[4]||'' };
  }

  slide.querySelectorAll('[style*="font-size"]').forEach(el => {
    const fsStr = (el.style.fontSize || '');
    const fs = parseFloat(fsStr);
    const unit = fsStr.replace(/[\d.]/g, '');
    if (!fs || (unit === 'rem' && fs < 1.8) || (unit === 'px' && fs < 26)) return;

    const rawText = Array.from(el.childNodes)
      .filter(n => n.nodeType === Node.TEXT_NODE)
      .map(n => n.textContent).join('').trim();
    const parsed = parseNumStr(rawText);
    if (parsed) {
      Array.from(el.childNodes)
        .filter(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim())
        .forEach(tn => { tn.textContent = parsed.prefix + parsed.value + parsed.unit + parsed.extra; });
      return;
    }

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
});

await sleep(800);
await page.screenshot({ path: './pdf_slide2_verify.png', type: 'png', fullPage: false });
console.log('✅ Screenshot saved as pdf_slide2_verify.png');
await browser.close();
