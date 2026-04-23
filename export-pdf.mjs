import puppeteer from 'puppeteer-core';
import fs from 'fs';

(async () => {
    try {
        console.log("Generating PDF from http://localhost:8080 ...");
        const browser = await puppeteer.launch({
            executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        
        // Emulate screen for CSS media queries
        await page.emulateMediaType('screen');
        await page.setViewport({ width: 1600, height: 900, deviceScaleFactor: 2 });
        
        // Go to our local server
        await page.goto('http://localhost:8080', { waitUntil: 'networkidle0', timeout: 60000 });
        
        // Create an array to hold all slides images
        const slideBuffers = [];
        const TOTAL_SLIDES = 11;
        
        // Capture each slide individually
        for (let i = 0; i < TOTAL_SLIDES; i++) {
            await page.evaluate((idx) => {
                const slides = document.querySelectorAll('.slide');
                slides.forEach((s, j) => {
                    s.style.display = j === idx ? 'flex' : 'none';
                    s.style.opacity = j === idx ? '1' : '0';
                });
                
                // Hide navigation controls for printing
                const nav = document.querySelector('.institutional-nav');
                if (nav) nav.style.display = 'none';

                // Stop animations
                const style = document.createElement('style');
                style.innerHTML = `* { transition: none !important; animation: none !important; transform: none !important; opacity: 1 !important; visibility: visible !important;}`;
                document.head.appendChild(style);
            }, i);
            
            // Wait a moment for any render artifacts
            await new Promise(r => setTimeout(r, 1000));
            
            const buffer = await page.screenshot({ type: 'png' });
            slideBuffers.push(buffer);
            console.log(`Captured slide ${i + 1}/${TOTAL_SLIDES}`);
        }
        
        await browser.close();
        
        // Now wrap the images in HTML and create a combined PDF
        const imagesHtml = slideBuffers.map((buf) => {
            return `<div class="page"><img src="data:image/png;base64,${buf.toString('base64')}" /></div>`;
        }).join('\\n');
        
        const printHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8">
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                @page { size: 1600px 900px; margin: 0; }
                body { width: 1600px; background: #000; -webkit-print-color-adjust: exact !important; }
                .page { width: 1600px; height: 900px; page-break-after: always; overflow: hidden; }
                img { width: 1600px; height: 900px; display: block; object-fit: cover; }
            </style></head><body>${imagesHtml}</body></html>`;
            
        fs.writeFileSync('temp_print.html', printHtml);
        
        console.log("Stitching PDF...");
        const browser2 = await puppeteer.launch({
            executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            headless: true,
            args: ['--no-sandbox']
        });
        const page2 = await browser2.newPage();
        await page2.goto(`file://${process.cwd()}/temp_print.html`, { waitUntil: 'networkidle0' });
        
        const outPath = '/Users/gideonnweze/Desktop/DIBA_Institutional_Deck_DeckX.pdf';
        await page2.pdf({
            path: outPath,
            width: '1600px',
            height: '900px',
            printBackground: true,
            margin: { top: 0, right: 0, bottom: 0, left: 0 }
        });
        
        await browser2.close();
        fs.unlinkSync('temp_print.html');
        
        console.log(`Successfully generated PDF at: ${outPath}`);
    } catch (e) {
        console.error("Error generating PDF:", e);
    }
})();
