const fs = require('fs');
const content = fs.readFileSync('js/i18n.js', 'utf8');

const thStart = content.indexOf('th: {');
const enStart = content.indexOf('en: {');
const zhStart = content.indexOf('zh: {');

const thBlock = content.substring(thStart, enStart);
const enBlock = content.substring(enStart, zhStart);
const zhBlock = content.substring(zhStart);

const extractKeys = (block) => {
  const matches = block.match(/'(docs\.[^']*)'/g) || [];
  return matches.map(s => s.replace(/'/g, ''));
};

const thKeys = new Set(extractKeys(thBlock));
const enKeys = new Set(extractKeys(enBlock));
const zhKeys = new Set(extractKeys(zhBlock));

const missingInEn = [...thKeys].filter(k => !enKeys.has(k));
const missingInZh = [...thKeys].filter(k => !zhKeys.has(k));

console.log('Missing in EN:', missingInEn);
console.log('Missing in ZH:', missingInZh);
