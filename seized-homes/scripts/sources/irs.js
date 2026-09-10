'use strict';

const { fetchText } = require('../lib/http');
const { stripTags } = require('../lib/html');
const { buildRecord } = require('../lib/normalize');
const { geocode } = require('../lib/geocode');

const source = {
  id: 'irs',
  label: 'IRS Seized Property Auctions',
  custody: 'Seized by IRS for unpaid taxes (IRC §6331)',
  url: 'https://www.irsauctions.gov/auction/items',
};

const BASE = 'https://www.irsauctions.gov';

// "Asset Address 3134 Aurora Avenue El Paso, 79930 TX United States"
const ADDRESS_RE = /Asset Address\s+(.+?)\s+([A-Za-z .'-]+),\s*(\d{5})\s+([A-Z]{2})\s+United States/;
const AUCTION_DATE_RE = /Date of Auction\s+([A-Z][a-z]{2} \d{1,2}, \d{4})/;

async function fetchListings() {
  const indexHtml = await fetchText(source.url);
  const slugs = [...new Set(
    (indexHtml.match(/href="(\/ad\/[^"]+)"/g) || []).map((h) => h.slice(6, -1))
  )];

  const listings = [];
  for (const slug of slugs) {
    const text = stripTags(await fetchText(BASE + slug));
    const addr = text.match(ADDRESS_RE);
    if (!addr || addr[4] !== 'OR') continue;

    const [, street, city, zip] = addr;
    const point = await geocode(`${street}, ${city}, OR ${zip}`);
    const date = text.match(AUCTION_DATE_RE);

    listings.push(
      buildRecord(source, {
        nativeId: slug.replace('/ad/', ''),
        listingUrl: BASE + slug,
        address: street,
        city,
        zip,
        state: 'OR',
        lat: point?.lat,
        lon: point?.lon,
        propertyType: 'Auction lot',
        status: 'Public auction',
        saleDate: date ? date[1] : null,
      })
    );
  }
  return listings;
}

module.exports = { ...source, fetchListings };
