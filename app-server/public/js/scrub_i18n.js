const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'i18n.js');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Remove exchange.* keys
content = content.replace(/'exchange\.[^']+':\s*'[^']+',?/g, '');
// 2. Remove modal.exchange.* keys
content = content.replace(/'modal\.exchange\.[^']+':\s*'[^']+',?/g, '');
// 3. Remove admin.stat.systemUsdt
content = content.replace(/'admin\.stat\.systemUsdt':\s*'[^']+',?/g, '');
// 4. Remove signup.currency.usdt
content = content.replace(/'signup\.currency\.usdt':\s*'[^']+',?/g, '');

// 5. Add the new admin stats
const thKeys = `
      'admin.stat.activeMerchants': 'ร้านค้าที่ใช้งานอยู่',
      'admin.stat.verifiedAccounts': 'บัญชีที่ยืนยันแล้ว',
`;
const enKeys = `
      'admin.stat.activeMerchants': 'Active Merchants',
      'admin.stat.verifiedAccounts': 'Verified Accounts',
`;
const zhKeys = `
      'admin.stat.activeMerchants': '活跃商户',
      'admin.stat.verifiedAccounts': '已验证账户',
`;

content = content.replace(/(th:\s*\{)/, "$1\n" + thKeys);
content = content.replace(/(en:\s*\{)/, "$1\n" + enKeys);
content = content.replace(/(zh:\s*\{)/, "$1\n" + zhKeys);

fs.writeFileSync(filePath, content);
console.log('i18n dictionary scrubbed of crypto keys and added activeMerchants.');
