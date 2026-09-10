'use strict';

const fs = require('fs');
const path = require('path');

const { ORIGIN, distanceFromOrigin } = require('./lib/distance');
const { addressKey } = require('./lib/normalize');

const SOURCES = [
  require('./sources/hud'),
  require('./sources/usda'),
  require('./sources/gsa'),
  require('./sources/irs'),
];

const DATA_DIR = path.join(__dirname, '..', 'data');
const OUT_PATH = path.join(DATA_DIR, 'listings.json');
const RAW_DIR = path.join(DATA_DIR, 'raw');

function readPrevious() {
  try {
    return JSON.parse(fs.readFileSync(OUT_PATH, 'utf8'));
  } catch {
    return { listings: [] };
  }
}

// A record carrying coordinates and a price beats a sparser duplicate of the
// same house from another source.
function completeness(record) {
  return [record.lat, record.price, record.beds, record.sqft, record.photoUrl]
    .filter((v) => v !== null && v !== undefined).length;
}

async function run() {
  const startedAt = new Date().toISOString();
  const previous = readPrevious();
  const priorById = new Map(previous.listings.map((l) => [l.id, l]));

  const sourceStatus = [];
  const collected = [];

  for (const source of SOURCES) {
    const began = Date.now();
    try {
      const listings = await source.fetchListings();
      collected.push(...listings);
      sourceStatus.push({
        id: source.id,
        label: source.label,
        custody: source.custody,
        url: source.url,
        ok: true,
        count: listings.length,
        note: listings.note || null,
        ms: Date.now() - began,
      });
      fs.mkdirSync(RAW_DIR, { recursive: true });
      fs.writeFileSync(
        path.join(RAW_DIR, `${source.id}-${startedAt.slice(0, 10)}.json`),
        JSON.stringify(listings, null, 2) + '\n'
      );
      console.log(`  ${source.id.padEnd(6)} ok    ${listings.length} listing(s)${listings.note ? ` — ${listings.note}` : ''}`);
    } catch (err) {
      const lastGood = previous.meta?.sources?.find((s) => s.id === source.id && s.ok);
      sourceStatus.push({
        id: source.id,
        label: source.label,
        custody: source.custody,
        url: source.url,
        ok: false,
        count: 0,
        error: err.message,
        lastGoodAt: lastGood ? previous.meta.generatedAt : null,
        ms: Date.now() - began,
      });
      console.log(`  ${source.id.padEnd(6)} FAIL  ${err.message}`);
    }
  }

  const byAddress = new Map();
  for (const record of collected) {
    const { miles, bearing } = distanceFromOrigin(record.lat, record.lon);
    const prior = priorById.get(record.id);
    const enriched = {
      ...record,
      distanceMiles: miles,
      bearing,
      firstSeen: prior?.firstSeen || startedAt,
      lastSeen: startedAt,
      isNew: !prior,
      priorPrice: prior && prior.price !== record.price ? prior.price : null,
    };

    const key = addressKey(record);
    const existing = byAddress.get(key);
    if (!existing) {
      byAddress.set(key, enriched);
    } else if (completeness(enriched) > completeness(existing)) {
      byAddress.set(key, { ...enriched, alsoListedBy: existing.sourceLabel });
    } else {
      existing.alsoListedBy = enriched.sourceLabel;
    }
  }

  const listings = [...byAddress.values()].sort((a, b) => {
    if (a.distanceMiles === null) return 1;
    if (b.distanceMiles === null) return -1;
    return a.distanceMiles - b.distanceMiles;
  });

  const currentIds = new Set(listings.map((l) => l.id));
  const removed = previous.listings
    .filter((l) => !currentIds.has(l.id))
    .map(({ id, address, city, sourceLabel, price }) => ({ id, address, city, sourceLabel, price }));

  const output = {
    meta: {
      generatedAt: startedAt,
      origin: ORIGIN,
      state: 'OR',
      total: listings.length,
      newSinceLastRun: listings.filter((l) => l.isNew).length,
      removedSinceLastRun: removed,
      sources: sourceStatus,
    },
    listings,
  };

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2) + '\n');

  console.log(
    `\n${listings.length} listing(s) written to data/listings.json ` +
      `(${output.meta.newSinceLastRun} new, ${removed.length} gone)`
  );
  return output;
}

if (require.main === module) {
  run().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { run };
