'use strict';

const STREET_ABBREV = {
  street: 'st', avenue: 'ave', boulevard: 'blvd', drive: 'dr', road: 'rd',
  lane: 'ln', court: 'ct', place: 'pl', terrace: 'ter', parkway: 'pkwy',
  circle: 'cir', highway: 'hwy', north: 'n', south: 's', east: 'e', west: 'w',
  northeast: 'ne', northwest: 'nw', southeast: 'se', southwest: 'sw',
};

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(String(value).replace(/[$,]/g, ''));
  return Number.isFinite(n) ? n : null;
}

const DIRECTIONALS = /^(n|s|e|w|ne|nw|se|sw|nne|ene|ese|sse|ssw|wsw|wnw|nnw)$/i;

function titleCase(value) {
  if (!value) return '';
  return String(value)
    .toLowerCase()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase())
    .replace(/\b[A-Za-z]{1,3}\b/g, (word) =>
      DIRECTIONALS.test(word) ? word.toUpperCase() : word
    );
}

// Collapses "3320 Glendale Avenue NE" and "3320 GLENDALE AVE N.E." to one key so
// the same house arriving from two sources dedupes.
function addressKey(record) {
  const street = String(record.address || '')
    .toLowerCase()
    .replace(/[.,#]/g, ' ')
    .split(/\s+/)
    .map((word) => STREET_ABBREV[word] || word)
    .filter(Boolean)
    .join(' ');
  const zip = String(record.zip || '').slice(0, 5);
  return `${street}|${String(record.city || '').toLowerCase().trim()}|${zip}`;
}

function buildRecord(source, fields) {
  const lat = toNumber(fields.lat);
  const lon = toNumber(fields.lon);
  return {
    id: `${source.id}:${fields.nativeId}`,
    source: source.id,
    sourceLabel: source.label,
    custody: source.custody,
    listingUrl: fields.listingUrl || source.url,
    address: titleCase(fields.address).trim(),
    city: titleCase(fields.city).trim(),
    county: titleCase(fields.county || '').trim(),
    state: (fields.state || 'OR').toUpperCase(),
    zip: String(fields.zip || '').slice(0, 5),
    lat,
    lon,
    price: toNumber(fields.price),
    beds: toNumber(fields.beds),
    baths: toNumber(fields.baths),
    sqft: toNumber(fields.sqft),
    yearBuilt: toNumber(fields.yearBuilt),
    propertyType: fields.propertyType || null,
    status: fields.status || null,
    saleDate: fields.saleDate || null,
    photoUrl: fields.photoUrl || null,
    notes: fields.notes || null,
  };
}

module.exports = { buildRecord, addressKey, toNumber, titleCase };
