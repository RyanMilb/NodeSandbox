# Underwater Cities — hot-seat digital edition

An unofficial, single-screen implementation of the board game *Underwater Cities*
for 2–4 players sharing one device. No build step, no server, no networking.

## Play it

Online: <https://ryanmilb.github.io/NodeSandbox/> (GitHub Pages serves this
`docs/` folder from `master`; that's why the game lives in a folder named
`docs` rather than something more obvious).

Locally, open `index.html` in a browser, or serve the folder:

```sh
cd docs
python -m http.server 8000
# then open http://localhost:8000
```

The game autosaves to `localStorage` after every action, so a closed tab can be
resumed from the setup screen.

## How hot seat works

- Between turns a full-screen "Pass the device to …" screen hides the hand.
- Click any player's card at the top to look at their board and tableau (their
  hand stays hidden); click "Back to …" to return.
- "Restart turn" rewinds to the start of the current player's turn.
- Production reports and final scoring are public and shown to everyone.

## What is faithful to the published rules

Taken from the official rulebook text (via UltraBoardGames' rules transcription):

- Structure costs: tunnel 1 steelplast + 1 credit; city 2 steelplast + 1 kelp + 1 credit;
  symbiotic city 1 steelplast + 1 kelp + 1 biomatter + 2 credits; farm 1 kelp;
  desalination plant 1 credit; laboratory 1 steelplast; any upgrade 1 science.
  Biomatter substitutes for kelp or steelplast.
- 10 rounds, 3 turns each, production after rounds 4, 7 and 10; era decks; hand
  limit 3 with a draw at end of turn; new era = draw 3, keep 3.
- Card/slot colour matching; three slot colours; the always-available
  "2 cards + 2 credits" slot; the 4-player action-cloning tile.
- Production: farm 1 kelp (+1 VP upgraded), desalination 1 credit (+1 biomatter),
  lab 1 steelplast (+1 science), two upgraded of a kind at one city +1 base resource
  (farms also +1 VP), tunnels touching a connected city 1 credit (+1 VP upgraded),
  symbiotic cities 2 VP. Feeding: 1 kelp per connected city, then 1 biomatter, then −3 VP.
- Action cards: max 4 including the Personal Assistant, once per era, an unused
  one discarded on overflow is used on the way out.
- Special cards: stay in hand, cost credits when matched, six limited 3-credit specials.
- Federation track with staggered starting positions and seat bonuses, overflow
  worth 1 VP per step, track order sets next round's turn order.
- Final scoring: connected cities 2/3/4/6 VP by building types, brown metropolis
  needs both tunnels, end-scoring cards, biomatter sells for 2 credits, then 4
  resources = 1 VP.
- Symbiotic dome supply: 7 / 10 / 13 for 2 / 3 / 4 players.

## What is an approximation

The real card text, the exact 15 action-slot effects, the four different player
boards and the metropolis tiles are not reproduced here (they weren't reachable
through public sources, and the card art/text is the publisher's). Instead:

- `js/data.js` defines an original 15-slot board that follows the known
  slots (build 2 tunnels, build city + building, advance 2, the 2-science-or-upgrade
  slot, the use-action-card + build + upgrade slot, special card slot, etc.) with
  yellow > red > green power.
- An original ~130-card set in the same five categories (instant, action,
  permanent, production, end-scoring) plus 16 specials, with green cards strongest
  and yellow weakest.
- One player-board layout (start city, 9 city sites with 3 building sites + 1
  expansion site each, 17 tunnel sites, brown metropolis needing 2 tunnels, two
  blue metropolises) with a handful of build-site bonuses. Every player uses the
  same layout; metropolis tiles are dealt randomly.
- The same board is used at every player count (the real 2-player board removes slots).

All of that lives in `js/data.js` and is easy to edit. A push to `master` that
touches this folder republishes the site.

## Files

- `index.html`, `style.css` — page shell and theme
- `js/data.js` — costs, board graph, slots, metropolis tiles, cards
- `js/engine.js` — rules engine (turn flow, effect queue, production, scoring, autosave)
- `js/ui.js` — rendering and click handling
