const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '../public');
const files = fs.readdirSync(publicDir).filter(f => f.endsWith('.html'));

files.forEach(file => {
    const filePath = path.join(publicDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Replace auth-guard.js?v=1.2 with auth-guard.js?v=1.3
    const newContent = content
        .replace(/\/js\/auth-guard\.js(?:\?v=[\d\.]+)?/g, '/js/auth-guard.js?v=1.3')
        .replace(/\/js\/google-auth\.js(?:\?v=[\d\.]+)?/g, '/js/google-auth.js?v=1.3')
        .replace(/\/js\/login\.js(?:\?v=[\d\.]+)?/g, '/js/login.js?v=1.3');
    
    if (content !== newContent) {
        fs.writeFileSync(filePath, newContent);
        console.log(`Updated ${file}`);
    }
});
