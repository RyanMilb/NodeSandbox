'use strict';

const { fetchText } = require('../lib/http');
const { stripTags, decodeEntities, hiddenInputs } = require('../lib/html');
const { buildRecord } = require('../lib/normalize');
const { geocode } = require('../lib/geocode');

const source = {
  id: 'usda',
  label: 'USDA Rural Development REO',
  custody: 'Government-owned (USDA foreclosure inventory)',
  url: 'https://properties.sc.egov.usda.gov/resales/public/searchSFH',
};

// The state dropdown only lists states that currently hold inventory, and each
// label carries its count — "Oregon (3)". Absence means zero, not an error.
function findOregonOption(html) {
  const select = html.match(/<select[^>]*name="stateCode"[\s\S]*?<\/select>/i);
  if (!select) throw new Error('stateCode dropdown missing — USDA layout changed');
  const options = [...select[0].matchAll(/<option[^>]*value="([^"]*)"[^>]*>([^<]*)/g)];
  const oregon = options.find((o) => /^\s*Oregon\b/i.test(decodeEntities(o[2])));
  return oregon ? { code: oregon[1], label: decodeEntities(oregon[2]).trim() } : null;
}

function parseResultRows(html) {
  const rows = [];
  for (const row of html.match(/<tr[\s\S]*?<\/tr>/gi) || []) {
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((c) => stripTags(c[1]));
    if (cells.length < 4) continue;
    const joined = cells.join(' ');
    const addr = joined.match(/(.+?)\s+([A-Za-z .'-]+),?\s+OR\s+(\d{5})/);
    if (!addr) continue;
    const price = joined.match(/\$([\d,]+)/);
    const link = row.match(/href="([^"]*propertyId=[^"]*)"/i);
    rows.push({
      address: addr[1].trim(),
      city: addr[2].trim(),
      zip: addr[3],
      price: price ? price[1] : null,
      href: link ? link[1] : null,
    });
  }
  return rows;
}

async function fetchListings() {
  const form = await fetchText(source.url);
  const oregon = findOregonOption(form);
  if (!oregon) {
    const note = 'USDA currently holds no Oregon inventory';
    return Object.assign([], { note });
  }

  const body = new URLSearchParams({
    ...hiddenInputs(form),
    stateCode: oregon.code,
    countyCode: '',
    city: '',
    zipCode: '',
    minPrice: '',
    maxPrice: '',
    bedrooms: '',
    bathrooms: '',
    squareFootage: '',
    Search: 'Search',
  });

  const html = await fetchText(source.url, {
    method: 'POST',
    body: body.toString(),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  const listings = [];
  for (const row of parseResultRows(html)) {
    const point = await geocode(`${row.address}, ${row.city}, OR ${row.zip}`);
    listings.push(
      buildRecord(source, {
        nativeId: row.href ? row.href.split('propertyId=')[1] : `${row.address}-${row.zip}`,
        listingUrl: row.href
          ? new URL(row.href, 'https://properties.sc.egov.usda.gov').toString()
          : source.url,
        address: row.address,
        city: row.city,
        zip: row.zip,
        state: 'OR',
        lat: point?.lat,
        lon: point?.lon,
        price: row.price,
        propertyType: 'Single Family Home',
        status: 'For sale',
      })
    );
  }
  return listings;
}

module.exports = { ...source, fetchListings };
