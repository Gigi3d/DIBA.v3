import puppeteerCore from 'puppeteer-core';
import fs from 'fs';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUTPUT_PATH = '/Users/gideonnweze/Documents/DIBA.v3/DIBA_Institutional_Deck_Full.pdf';
const SLIDE_URL = 'http://localhost:3000';
const TOTAL_SLIDES = 17;

async function generatePDF() {
  console.log('🚀 Launching Chrome for slide capture...');
  const browser = await puppeteerCore.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-dev-shm-usage',
      '--window-size=1600,900',
    ],
    defaultViewport: { width: 1600, height: 900 }
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 900, deviceScaleFactor: 2 });

  console.log(`📂 Opening ${SLIDE_URL}...`);
  await page.goto(SLIDE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(2500);

  const slideBuffers = [];

  for (let i = 0; i < TOTAL_SLIDES; i++) {
    console.log(`📸 Capturing slide ${i + 1} / ${TOTAL_SLIDES}...`);

    await page.evaluate((slideIndex) => {
      const slides = document.querySelectorAll('.slide');
      slides.forEach((s) => {
        s.style.display = 'none';
        s.style.opacity = '0';
        s.classList.remove('active');
      });
      if (slides[slideIndex]) {
        slides[slideIndex].style.display = 'flex';
        slides[slideIndex].style.opacity = '1';
        slides[slideIndex].classList.add('active');
      }
      const nav = document.querySelector('.nav-controls');
      const footer = document.querySelector('.deck-footer');
      const fsBtn = document.querySelector('.fullscreen-btn');
      if (nav) nav.style.display = 'none';
      if (footer) footer.style.display = 'none';
      if (fsBtn) fsBtn.style.display = 'none';
    }, i);

    await sleep(800);

    const buffer = await page.screenshot({ type: 'png', fullPage: false });
    slideBuffers.push(buffer);
    console.log(`   ✅ Slide ${i + 1} captured`);
  }

  await browser.close();
  console.log(`\n🖨️  All ${TOTAL_SLIDES} slides captured. Building PDF...`);

  const imagesHtml = slideBuffers.map((buf) => {
    const base64 = buf.toString('base64');
    return `<div class="page"><img src="data:image/png;base64,${base64}" /></div>`;
  }).join('\n');

  const printHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: 1600px 900px; margin: 0; }
  body { width: 1600px; background: #000; }
  .page {
    width: 1600px;
    height: 900px;
    display: flex;
    align-items: center;
    justify-content: center;
    page-break-after: always;
    overflow: hidden;
  }
  .page img {
    width: 1600px;
    height: 900px;
    display: block;
    object-fit: cover;
  }
</style>
</head>
<body>
${imagesHtml}
</body>
</html>`;

  const tmpHtmlPath = '/tmp/diba_deck_print.html';
  fs.writeFileSync(tmpHtmlPath, printHtml);
  console.log('🗂️  Temp HTML written. Launching PDF printer...');

  const browser2 = await puppeteerCore.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    defaultViewport: { width: 1600, height: 900 }
  });

  const page2 = await browser2.newPage();
  await page2.goto(`file://${tmpHtmlPath}`, { waitUntil: 'networkidle0', timeout: 60000 });
  await sleep(1000);

  await page2.pdf({
    path: OUTPUT_PATH,
    width: '1600px',
    height: '900px',
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  });

  await browser2.close();
  fs.unlinkSync(tmpHtmlPath);
  console.log(`\n✅ Done! PDF saved to: ${OUTPUT_PATH}`);
}

generatePDF().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
