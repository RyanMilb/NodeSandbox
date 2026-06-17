# Natural Fiber & Cottagecore — Men's Styling Lookbook

A single static page that pulls real, license-clean clothing photographs from
Unsplash and arranges them into a lookbook for a natural-fiber, cottagecore-leaning
men's wardrobe: linen shirts, chambray, wool knits, waxed jackets, relaxed
trousers, leather boots, and full-outfit inspiration.

## Files

- `index.html` — page structure
- `style.css` — the linen/ink/sage/walnut/indigo/rust aesthetic
- `app.js` — fetches images from Unsplash and renders the grid
- `config.example.js` — template for your API key (committed)
- `config.js` — your real key, **gitignored**, created by you (see below)

## Get a free Unsplash API key (recommended)

The page works with zero setup (see "Run it" below), but without a key it falls
back to unattributed placeholder images. For the real experience — actual
photographer credits under each photo, as Unsplash's license requires — get a
free key:

1. Go to <https://unsplash.com/developers> and log in or create an account.
2. Click **"Your apps"** → **"New Application"**.
3. Accept the API guidelines, give the app any name (e.g. "Cottagecore Lookbook").
4. Copy the **Access Key** shown on the app's page (not the Secret key).
5. Copy `config.example.js` to `config.js`:
   ```sh
   cp config.example.js config.js
   ```
6. Open `config.js` and paste your key:
   ```js
   window.UNSPLASH_ACCESS_KEY = "your-access-key-here";
   ```

`config.js` is listed in `.gitignore`, so your key won't get committed.

Unsplash's free ("Demo") tier allows 50 requests/hour, which is plenty for
browsing this page — each full page load makes 7 requests (one per category).

## Run it

No build step. Either:

- Open `index.html` directly in a browser, or
- Serve it locally (avoids any local file restrictions some browsers apply):
  ```sh
  python -m http.server
  ```
  then visit <http://localhost:8000>.

If `config.js` is missing or its key is blank, the page automatically falls
back to [Unsplash Source](https://source.unsplash.com) URLs so it still
displays images with no setup — just without specific photographer credit
(Unsplash Source returns a random image per request and doesn't expose photo
metadata). Note that Unsplash has at times deprecated/throttled the Source
service, so for a reliable experience getting a free API key is worth the two
minutes.

## On image sourcing

Unsplash is used here because it's free, has a generous license for this kind
of use (attribution requested, not required, but included here as a courtesy
and best practice), and has good coverage of menswear/lifestyle photography.

If you want photos of actual purchasable garments (not just lifestyle/editorial
shots), a retailer-driven source — e.g. pulling product photography from a
brand's own site or an affiliate product feed (such as a Pinterest-style
shopping API, or directly browsing brands like Universal Works, Margaret Howell,
or L.L. Bean) — would map more precisely to "real clothing photos of items you
can buy." Unsplash is the right default for a moodboard/lookbook; it's the
wrong tool if the goal becomes a shoppable catalog.

## Accessibility & behavior notes

- Images lazy-load (`loading="lazy"`) and fade in once loaded.
- `prefers-reduced-motion` disables the hover lift and loading spinner animation.
- If a category's fetch fails, or an individual image fails to load, you'll see
  a "couldn't load — retry" button rather than a broken image icon.
- Layout collapses to a single column on narrow viewports.
