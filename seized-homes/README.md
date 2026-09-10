# Oregon government-held homes, measured from McMinnville

Pulls every residential property currently held or auctioned by a federal agency in
Oregon straight from the agencies' own listing systems, normalizes them into one
schema, computes straight-line distance from McMinnville, and renders a
self-contained dashboard.

No dependencies, no build step, no API keys. Node 18+ (uses built-in `fetch`).

```sh
node scripts/fetch.js            # pull sources -> data/listings.json
node scripts/build-dashboard.js  # data + template -> dashboard.html
```

`dashboard.html` is fully self-contained (data inlined, no external requests
except webfonts), so it opens straight from disk.

## Sources

| Adapter | Agency | What it covers |
| --- | --- | --- |
| `hud` | HUD Home Store | Homes HUD owns after FHA foreclosure. The only source with Oregon inventory today (21 properties). |
| `usda` | USDA Rural Development | Homes USDA owns after foreclosure on its rural loans. |
| `gsa` | GSA Real Property Sales | Federal surplus and forfeited real property. |
| `irs` | IRS Auctions | Property seized under IRC §6331 for unpaid taxes. Genuinely "seized" in the strict sense. |

USDA, GSA and IRS run clean but hold no Oregon residential inventory at the moment.
They are wired up so the dashboard fills in on its own when that changes — the
source ledger at the top of the page reports each one's live count, so an empty
source is visibly empty rather than silently missing.

Deliberately excluded: Zillow, Realtor.com, RealtyTrac and Foreclosure.com. Their
terms prohibit scraping and the data sits behind a paywall. Everything above is
public federal data.

## How it fits together

```
scripts/fetch.js              orchestrator: run adapters, dedupe, diff, write
scripts/sources/<id>.js       one adapter per agency
scripts/lib/http.js           fetch with retry/backoff, browser UA, timeouts
scripts/lib/html.js           entity decoding and attribute extraction
scripts/lib/normalize.js      canonical record + address dedupe key
scripts/lib/geocode.js        Census batch geocoder, disk-cached
scripts/lib/distance.js       haversine + compass bearing from McMinnville
scripts/build-dashboard.js    inlines listings.json into dashboard/template.html
data/listings.json            canonical output
data/geocode-cache.json       address -> coordinates, so re-runs cost no requests
```

Each adapter exports `{ id, label, custody, url, fetchListings() }`. The
orchestrator runs them in isolation — one agency returning a 403 records a failed
status and leaves the other three intact, rather than taking down the run.

HUD is the one source that needs no geocoding: its search page carries a JSON
payload with coordinates already on it. The rest are geocoded through the Census
Bureau's geocoder (free, no key) and cached to disk.

## Adding a source

Write `scripts/sources/<id>.js` exporting the same four fields plus
`fetchListings()`, build records through `buildRecord()` from `lib/normalize`, and
add it to the `SOURCES` array in `scripts/fetch.js`. Distance, dedupe, diffing and
the dashboard all come for free.

The obvious next additions are Oregon county tax-foreclosure sales (Yamhill, Polk,
Marion, Washington, Clackamas), which is where the real Oregon volume lives. They
publish in irregular batches, often as PDFs, so each county is its own parser.

## Caveats

- Distances are great-circle miles, not drive time. Something 30 miles out across
  the Coast Range is a very different trip from 30 miles down 99W.
- Prices are agency list prices and move without notice. Confirm on the listing.
- HUD properties have bidding windows and eligibility rules (owner-occupant
  priority periods). The `Listing` column shows which period a property is in.
