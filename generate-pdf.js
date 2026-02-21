const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
    console.log('Starting PRO PDF generation...');
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    console.log('Navigating to local print template...');
    // Load the local HTML file directly
    const templatePath = path.join(__dirname, 'print-template.html');
    await page.goto(`file://${templatePath}`, { waitUntil: 'networkidle0' });

    const dir = path.join(__dirname, 'assets', 'downloads');
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    const pdfPath = path.join(dir, 'Elixopay-API-Reference.pdf');
    console.log('Generating polished developer PDF...');

    await page.pdf({
        path: pdfPath,
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: false,
        preferCSSPageSize: true // Respects the @page CSS rules in the template
    });

    await browser.close();
    console.log(`PRO PDF successfully generated at: ${pdfPath}`);
})();
