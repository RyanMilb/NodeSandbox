'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TEMPLATE = path.join(ROOT, 'dashboard', 'template.html');
const DATA = path.join(ROOT, 'data', 'listings.json');
const OUT = path.join(ROOT, 'dashboard.html');

function build() {
  const template = fs.readFileSync(TEMPLATE, 'utf8');
  const data = fs.readFileSync(DATA, 'utf8').trim();

  // The payload rides inside a <script type="application/json"> block, so the only
  // sequence that can break out of it is a literal closing script tag.
  const safe = data.replace(/<\//g, '<\\/');

  fs.writeFileSync(OUT, template.replace('__DATA__', () => safe));
  const kb = (fs.statSync(OUT).size / 1024).toFixed(1);
  console.log(`dashboard.html written (${kb} KB, ${JSON.parse(data).listings.length} listings)`);
}

if (require.main === module) build();

module.exports = { build };
