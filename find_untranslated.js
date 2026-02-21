const fs = require('fs');
const path = require('path');

const pages = ['index.html', 'usecases.html', 'about.html', 'pricing.html'];
const dir = path.join(__dirname, 'public-site');

pages.forEach(page => {
  const content = fs.readFileSync(path.join(dir, page), 'utf8');
  // Very basic regex to find text inside tags that don't have data-i18n
  // This is a heuristic, not a perfect parser.
  const regex = /<([a-zA-Z][a-zA-Z0-9]*)(?![^>]*data-i18n)[^>]*>\s*([^<]+?)\s*<\/\1>/g;
  let match;
  console.log(`\n--- Untranslated strings in ${page} ---`);
  let count = 0;
  while ((match = regex.exec(content)) !== null) {
    const text = match[2].trim();
    // Ignore empty, numbers, or very short punctuation-only strings
    if (text.length > 1 && /[a-zA-Zก-๙]/.test(text) && !text.includes('{') && !text.includes('Elixopay')) {
      console.log(`Line approx ${content.substring(0, match.index).split('\n').length}: ${text.substring(0, 50)}`);
      count++;
    }
  }
  console.log(`Total suspect strings: ${count}`);
});
