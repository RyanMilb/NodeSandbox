'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TEMPLATE = path.join(ROOT, 'dashboard', 'template.html');
const DATA = path.join(ROOT, 'data', 'listings.json');
const OUT = path.join(ROOT, 'dashboard.html');

// GitHub Pages serves docs/ from master, so the published copy lives in a
// subfolder there rather than at docs/ root, which the game already occupies.
const PAGES = path.join(ROOT, '..', 'docs', 'seized-homes', 'index.html');

function build() {
  const template = fs.readFileSync(TEMPLATE, 'utf8');
  const data = fs.readFileSync(DATA, 'utf8').trim();

  // The payload rides inside a <script type="application/json"> block, so the only
  // sequence that can break out of it is a literal closing script tag.
  const safe = data.replace(/<\//g, '<\\/');
  const page = template.replace('__DATA__', () => safe);

  fs.writeFileSync(OUT, page);
  fs.mkdirSync(path.dirname(PAGES), { recursive: true });
  fs.writeFileSync(PAGES, page);

  const kb = (fs.statSync(OUT).size / 1024).toFixed(1);
  console.log(`dashboard.html + docs/seized-homes/index.html written ` +
    `(${kb} KB, ${JSON.parse(data).listings.length} listings)`);
}

if (require.main === module) build();

module.exports = { build };
