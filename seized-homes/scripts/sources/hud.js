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

// Lot size is absent from the search payload and only appears on the detail page,
// where LotSize is read in the unit named by SqftAcreage ('A' acres, 'S' sq ft).
const DETAIL_RE = /id="prop_details"[^>]*?\svalue="([^"]*)"/i;
const SQFT_PER_ACRE = 43560;

async function fetchAcres(caseNumber) {
  try {
    const html = await fetchText(
      `https://www.hudhomestore.gov/propertydetails?caseNumber=${encodeURIComponent(caseNumber)}`,
      { retries: 1 }
    );
    const match = html.match(DETAIL_RE);
    if (!match) return null;
    let detail = JSON.parse(decodeEntities(match[1]));
    if (Array.isArray(detail)) detail = detail[0];
    const size = Number(detail.LotSize);
    if (!Number.isFinite(size) || size <= 0) return null;
    return String(detail.SqftAcreage).toUpperCase() === 'A' ? size : size / SQFT_PER_ACRE;
  } catch {
    return null;
  }
}

async function withAcreage(records) {
  const CONCURRENCY = 4;
  for (let i = 0; i < records.length; i += CONCURRENCY) {
    const slice = records.slice(i, i + CONCURRENCY);
    const acres = await Promise.all(
      slice.map((r) => fetchAcres(r.id.split(':')[1]))
    );
    slice.forEach((record, n) => {
      record.acres = acres[n] == null ? null : Number(acres[n].toFixed(3));
    });
  }
  return records;
}

async function fetchListings() {
  const html = await fetchText(source.url);
  const match = html.match(PAYLOAD_RE);
  if (!match) {
    throw new Error('available_prop payload missing — HUD page layout changed');
  }

  const payload = JSON.parse(decodeEntities(match[1]));

  const records = payload
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

  return withAcreage(records);
}

module.exports = { ...source, fetchListings };
