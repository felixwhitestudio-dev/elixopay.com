const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '../public');
const files = fs.readdirSync(publicDir).filter(f => f.endsWith('.html'));

files.forEach(file => {
    const filePath = path.join(publicDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Replace auth-guard.js?v=1.1 or auth-guard.js with auth-guard.js?v=1.2
    const newContent = content.replace(/\/js\/auth-guard\.js(?:\?v=[\d\.]+)?/g, '/js/auth-guard.js?v=1.2');
    
    if (content !== newContent) {
        fs.writeFileSync(filePath, newContent);
        console.log(`Updated ${file}`);
    }
});
