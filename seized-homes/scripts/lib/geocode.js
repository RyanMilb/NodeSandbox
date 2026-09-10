'use strict';

const fs = require('fs');
const path = require('path');
const { fetchText, sleep } = require('./http');

const CACHE_PATH = path.join(__dirname, '..', '..', 'data', 'geocode-cache.json');
const CENSUS = 'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress';

let cache = null;

function loadCache() {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
  } catch {
    cache = {};
  }
  return cache;
}

function saveCache() {
  if (!cache) return;
  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2) + '\n');
}

async function geocode(oneLineAddress) {
  const key = oneLineAddress.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!key) return null;
  const store = loadCache();
  if (key in store) return store[key];

  const url =
    `${CENSUS}?address=${encodeURIComponent(oneLineAddress)}` +
    '&benchmark=Public_AR_Current&format=json';

  let result = null;
  try {
    const body = JSON.parse(await fetchText(url, { timeoutMs: 20000, retries: 2 }));
    const match = body?.result?.addressMatches?.[0];
    if (match) {
      result = { lat: match.coordinates.y, lon: match.coordinates.x, matched: match.matchedAddress };
    }
  } catch {
    // A geocode miss must not fail the run; the record keeps a null distance.
    return null;
  }

  store[key] = result;
  saveCache();
  await sleep(300);
  return result;
}

module.exports = { geocode, saveCache };
