'use strict';

const { fetchText } = require('../lib/http');
const { stripTags } = require('../lib/html');
const { buildRecord, titleCase } = require('../lib/normalize');
const { geocode } = require('../lib/geocode');

const source = {
  id: 'sheriff',
  label: "Oregon Sheriffs' Sales",
  custody: 'Court-ordered foreclosure auction, sold by the county sheriff',
  url: 'https://oregonsheriffssales.org/',
};

const API = 'https://oregonsheriffssales.org/wp-json/wp/v2/property-listing';

// The notice detail page prints labelled fields; the attached PDF repeats them,
// so there is nothing to gain from parsing it. The live sale date is MM/DD/YYYY —
// the long-form date beside it sits inside an HTML comment and is a stale value.
const DETAIL_RE = /Address:\s*(.*?)\s*Sale Date:\s*(\d{1,2}\/\d{1,2}\/\d{4})/;

function slugFrom(classList, prefix) {
  const hit = (classList || []).find((c) => c.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
}

async function fetchIndex() {
  const posts = [];
  for (let page = 1; ; page++) {
    const body = await fetchText(`${API}?per_page=100&page=${page}`);
    const batch = JSON.parse(body);
    posts.push(...batch);
    if (batch.length < 100) break;
  }
  return posts;
}

async function fetchListings() {
  const posts = await fetchIndex();

  // The same taxonomy also carries personal-property (vehicle, equipment) sales.
  const realProperty = posts.filter((p) =>
    (p.class_list || []).some((c) => c.startsWith('property_types-') && c.includes('real-property'))
  );

  const listings = [];
  for (const post of realProperty) {
    const detail = stripTags(await fetchText(post.link));
    const match = detail.match(DETAIL_RE);
    if (!match) continue;

    const rawAddress = match[1].replace(/\bOregon\b/i, 'OR').replace(/\s+/g, ' ').trim();
    const point = await geocode(rawAddress);
    const county = slugFrom(post.class_list, 'county-');

    // These addresses arrive as one unpunctuated string, so the geocoder's parse
    // is the only reliable way to split city and ZIP back out.
    const street = point?.matched ? point.matched.split(',')[0] : rawAddress;

    listings.push(
      buildRecord(source, {
        nativeId: String(post.id),
        listingUrl: post.link,
        address: street,
        city: point?.city || '',
        county: county ? titleCase(county.replace(/-/g, ' ')) : '',
        state: 'OR',
        zip: point?.zip || '',
        lat: point?.lat,
        lon: point?.lon,
        propertyType: 'Auction lot',
        status: "Sheriff's sale",
        saleDate: match[2],
        notes: stripTags(post.title?.rendered || '').slice(0, 160) || null,
      })
    );
  }
  return listings;
}

module.exports = { ...source, fetchListings };
