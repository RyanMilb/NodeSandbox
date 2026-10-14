'use strict';

const { fetchText } = require('../lib/http');
const { stripTags } = require('../lib/html');
const { buildRecord } = require('../lib/normalize');

const source = {
  id: 'gsa',
  label: 'GSA Real Property Sales',
  custody: 'Federal surplus / forfeited real property',
  url: 'https://realestatesales.gov/our-listing/',
};

const BASE = 'https://realestatesales.gov';
const ADDRESS_RE = /([A-Za-z0-9 .'#-]+?),?\s+([A-Za-z .'-]+),\s*OR\s+(\d{5})/;

async function fetchListings() {
  const indexHtml = await fetchText(source.url);
  const ids = [...new Set(
    (indexHtml.match(/property_id=(\d+)/g) || []).map((m) => m.split('=')[1])
  )];

  const listings = [];
  for (const id of ids) {
    const detailUrl = `${BASE}/asset-details/?property_id=${id}`;
    const html = await fetchText(detailUrl);
    const text = stripTags(html);
    const addr = text.match(ADDRESS_RE);
    if (!addr) continue;

    const lat = html.match(/(?:lat|latitude)["']?\s*[:=]\s*["']?(-?\d+\.\d+)/i);
    const lon = html.match(/(?:lng|longitude)["']?\s*[:=]\s*["']?(-?\d+\.\d+)/i);
    const price = text.match(/\$([\d,]+)/);
    const type = text.match(/Asset Type:\s*([A-Za-z /-]+)/);

    listings.push(
      buildRecord(source, {
        nativeId: id,
        listingUrl: detailUrl,
        address: addr[1],
        city: addr[2],
        zip: addr[3],
        state: 'OR',
        lat: lat ? lat[1] : null,
        lon: lon ? lon[1] : null,
        price: price ? price[1] : null,
        propertyType: type ? type[1].trim() : null,
        status: 'Federal sale',
      })
    );
  }
  return listings;
}

module.exports = { ...source, fetchListings };
