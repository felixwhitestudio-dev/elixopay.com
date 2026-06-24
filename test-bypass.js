const puppeteer = require('puppeteer');

(async () => {
    console.log('Launching browser...');
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
        const page = await browser.newPage();
        
        // Intercept network requests to prevent redirect
        await page.setRequestInterception(true);
        page.on('request', request => {
            if (request.url().includes('/api/v1/api-keys') || request.url().includes('/api/v1/auth')) {
                request.respond({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ success: true, data: [] })
                });
            } else {
                request.continue();
            }
        });

        console.log('Navigating to app.elixopay.com/api-keys.html...');
        await page.goto('https://app.elixopay.com/api-keys.html', { waitUntil: 'networkidle0' });
        
        console.log('Injecting fake OAuth session into localStorage...');
        await page.evaluate(() => {
            localStorage.setItem('isOAuth', 'true');
            localStorage.setItem('token', 'fake-jwt-token');
            localStorage.setItem('user', JSON.stringify({ id: 1, email: 'test@example.com', isOAuth: true }));
        });
        
        // Reload so the scripts see the new localStorage
        console.log('Reloading page...');
        await page.reload({ waitUntil: 'networkidle0' });
        
        console.log('Waiting for "Generate New Key" button...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Find and click the button via evaluate
        const clicked = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const genBtn = btns.find(b => b.textContent.includes('Generate New Key') || b.textContent.includes('Create'));
            if (genBtn) {
                genBtn.click();
                return true;
            }
            return false;
        });
        
        if (clicked) {
            console.log('Clicked Generate New Key! Waiting for modal...');
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const modalContent = await page.evaluate(() => {
                const swal = document.querySelector('.swal2-popup');
                if (!swal) return null;
                return {
                    html: swal.innerHTML,
                    text: swal.innerText
                };
            });
            
            if (modalContent) {
                console.log('Modal opened successfully!');
                const hasPasswordField = modalContent.html.includes('type="password"');
                const hasOAuthText = modalContent.text.includes('Please confirm');
                
                console.log('Test Results:');
                console.log('- Has Password Input?', hasPasswordField);
                console.log('- Modal Text:', modalContent.text.replace(/\n/g, ' '));
                
                if (!hasPasswordField && hasOAuthText) {
                    console.log('✅ TEST PASSED: OAuth bypass works perfectly! No password prompted.');
                } else {
                    console.log('❌ TEST FAILED: Password prompt still appears.');
                }
            } else {
                console.log('❌ Modal did not open.');
            }
        } else {
            console.log('❌ Could not find Generate New Key button.');
        }
    } catch (e) {
        console.error('Error during test:', e);
    } finally {
        await browser.close();
    }
})();
