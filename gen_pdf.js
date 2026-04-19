const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();

    const htmlPath = 'file://' + path.resolve('/tmp/zynexpay_bank_doc.html');
    await page.goto(htmlPath, { waitUntil: 'networkidle0', timeout: 30000 });

    // Wait for fonts to load
    await page.evaluateHandle('document.fonts.ready');
    await new Promise(r => setTimeout(r, 2000));

    await page.pdf({
        path: path.resolve(process.env.HOME, 'Desktop/ZynexPay_Bank_Document.pdf'),
        format: 'A4',
        printBackground: true,
        margin: { top: '0', bottom: '0', left: '0', right: '0' },
        preferCSSPageSize: true,
    });

    console.log('✅ PDF generated successfully!');
    await browser.close();
})();
