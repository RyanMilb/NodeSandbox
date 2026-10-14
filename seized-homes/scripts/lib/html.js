'use strict';

const NAMED = {
  quot: '"',
  apos: "'",
  lt: '<',
  gt: '>',
  nbsp: ' ',
  amp: '&', // must be applied last; see decodeEntities
};

// &amp; is resolved last so that "&amp;quot;" does not become a quote character.
function decodeEntities(input) {
  if (!input) return '';
  let out = String(input);
  for (const [name, char] of Object.entries(NAMED)) {
    if (name === 'amp') continue;
    out = out.split(`&${name};`).join(char);
  }
  out = out.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
  out = out.replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
  return out.split('&amp;').join('&');
}

function stripTags(html) {
  return decodeEntities(
    String(html)
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/\s+/g, ' ')
    .trim();
}

function attrById(html, id, attr = 'value') {
  const re = new RegExp(`id="${id}"[^>]*?\\s${attr}="([^"]*)"`, 'i');
  const match = html.match(re);
  return match ? decodeEntities(match[1]) : null;
}

function hiddenInputs(formHtml) {
  const out = {};
  const re = /<input[^>]*type="hidden"[^>]*>/gi;
  for (const tag of formHtml.match(re) || []) {
    const name = tag.match(/\sname="([^"]*)"/i);
    const value = tag.match(/\svalue="([^"]*)"/i);
    if (name) out[name[1]] = value ? decodeEntities(value[1]) : '';
  }
  return out;
}

module.exports = { decodeEntities, stripTags, attrById, hiddenInputs };
