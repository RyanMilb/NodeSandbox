'use strict';

const { fetchText } = require('../lib/http');
const { decodeEntities } = require('../lib/html');
const { buildRecord } = require('../lib/normalize');

const source = {
  id: 'hud',
  label: 'HUD Home Store',
  custody: 'Government-owned (FHA foreclosure, HUD REO)',
  url: 'https://www.hudhomestore.gov/searchresult?citystate=OR',
};

// The results grid is rendered client-side from a JSON payload parked in a
// hidden input, so the page itself is the API — no separate endpoint exists.
const PAYLOAD_RE = /id="available_prop"[^>]*?\svalue="([^"]*)"/i;

async function fetchListings() {
  const html = await fetchText(source.url);
  const match = html.match(PAYLOAD_RE);
  if (!match) {
    throw new Error('available_prop payload missing — HUD page layout changed');
  }

  const payload = JSON.parse(decodeEntities(match[1]));

  return payload
    .filter((p) => String(p.propertyState).toUpperCase() === 'OR')
    .map((p) =>
      buildRecord(source, {
        nativeId: p.propertyCaseNumber,
        listingUrl: `https://www.hudhomestore.gov/propertydetails?caseNumber=${encodeURIComponent(p.propertyCaseNumber)}`,
        address: p.propertyAddress,
        city: p.propertyCity,
        county: p.propertyCounty,
        state: p.propertyState,
        zip: p.propertyZip,
        lat: p.latitude,
        lon: p.longitude,
        price: p.listPrice,
        beds: p.bedrooms,
        baths: p.bathroomsdecimal ?? p.bathrooms,
        sqft: p.squareFootage,
        yearBuilt: p.yearBuilt,
        propertyType: p.propertyType,
        status: p.listingPeriod ? `${p.listingPeriod} listing` : null,
        saleDate: p.bidOpenDate || p.periodDeadlineDate,
        photoUrl: p.propertyThumb,
        notes: [p.fhaFinancing, p.eligibleBidders].filter(Boolean).join(' · ') || null,
      })
    );
}

module.exports = { ...source, fetchListings };
