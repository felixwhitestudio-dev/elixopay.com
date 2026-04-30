const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'i18n.js');
let content = fs.readFileSync(filePath, 'utf8');

const thKeys = `
      // Additional Dashboard Keys
      'dashboard.sandbox_balance': 'ยอดเงินทดสอบ (Sandbox)',
      'dashboard.thb_balance': 'ยอดเงิน THB',
      'dashboard.wallet.est': 'ประเมิน',
`;

const enKeys = `
      // Additional Dashboard Keys
      'dashboard.sandbox_balance': 'TEST SANDBOX BALANCE',
      'dashboard.thb_balance': 'THB Balance',
      'dashboard.wallet.est': 'Est.',
`;

const zhKeys = `
      // Additional Dashboard Keys
      'dashboard.sandbox_balance': '测试沙盒余额',
      'dashboard.thb_balance': '泰铢余额',
      'dashboard.wallet.est': '预估',
`;

content = content.replace(/(th:\s*\{)/, "$1\n" + thKeys);
content = content.replace(/(en:\s*\{)/, "$1\n" + enKeys);
content = content.replace(/(zh:\s*\{)/, "$1\n" + zhKeys);

fs.writeFileSync(filePath, content);
console.log('Sandbox keys injected.');
