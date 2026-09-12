# Image brief — "Underwater Cities, ready to play"

Handoff for whoever (or whatever) generates the image. Everything below is
derived from the actual implementation in `docs/` so the artwork and the app
agree on colour and iconography.

**Goal:** one hero image of the game set up and waiting for the first move —
the moment before anyone has acted. Intended use: README header, social preview
card for <https://ryanmilb.github.io/NodeSandbox/>, and a title-screen backdrop.

---

## 1. Deliverables

| Crop | Pixels | Use |
|---|---|---|
| Wide hero | 2400 × 1260 (≈1.9:1) | README top, page header |
| Social card | 1200 × 630 | OpenGraph / link preview |
| Square | 1500 × 1500 | avatar, thumbnail |

Deliver PNG, sRGB. Leave the upper-left third of the wide crop visually calm —
a title may be typeset over it later. Do **not** bake title text into the image.

---

## 2. What "ready to play" means

This is a setup shot, not an action shot. The distinction matters and is the
single thing most likely to come back wrong.

**Must be visible:**
- Each player board is nearly bare: exactly **one white starting dome** in the
  lower-right of the board, nothing else built.
- **No tunnels laid.** The routes between city sites are empty engraved channels.
- **No farms, desalination plants or laboratories** placed. Their building sites
  sit empty around each city site.
- Central board's action slots are **all empty** — no worker/card markers in them.
- Three face-down cards fanned at each player's seat (their opening hand).
- One face-up "Personal Assistant" card in front of each player.
- Three card decks stacked by the central board (Era I, II, III), unshuffled-looking
  and untouched; a smaller Special deck beside them.
- Resource tokens in small, tidy **starting piles**: a couple of brass coins,
  a single green kelp frond, a single grey bar per player. Piles are small —
  this is turn one, nobody is rich.
- A shallow supply bowl of spare purple domes.
- Four scoring markers all sitting together at zero.
- Federation-track markers **staggered** down the track, one per player, in
  descending starting order.
- Metropolis tiles placed face-up on each player board's three reserved spots.

**Must NOT appear:** stacked-up resources, cards in the action slots, built
tunnels or buildings, scoring markers spread apart, dice (this game has none),
player hands or arms mid-reach, food/drink clutter.

---

## 3. Composition & camera

Primary framing: **low three-quarter view** across the table, roughly 25–35°
above the surface, focal length equivalent ~35mm, shallow-ish depth of field with
the nearest player board sharp and the far side of the table softening.

Arrangement: the **central action board** sits upper-centre. Two to four
**player boards** radiate toward the camera; the nearest one is the hero object
and should read clearly — its empty grid of city sites, its single white dome,
its engraved tunnel channels. Card decks and the supply bowl fill the mid-ground
gaps. Table surface is dark wood or slate.

Alternative framing (deliver if budget allows): **flat overhead**, perfectly
square-on, everything legible, styled like a board-game-geek setup photo.

---

## 4. Light & mood

Cool, submarine, but the components are clearly lit — legibility beats
atmosphere. Key light from upper left, soft and broad, like an overcast window.
A subtle cyan rim/bounce from below-left, as if light were reflecting off water,
is welcome. Optional faint caustic ripple pattern on the table surface at low
opacity. No heavy fog, no murk over the components, no dramatic god rays.

Mood words: quiet, anticipatory, precise, clean, expensive-feeling.

---

## 5. Palette — lock to these

Taken verbatim from the app's stylesheet.

| Role | Hex |
|---|---|
| Deep background / table shadow | `#0b1c2c` |
| Board panel base | `#142f47` |
| Panel highlight / edges | `#1b3a55` |
| Line work, engraved channels | `#2a4d6b` |
| Slot colour — yellow (strongest actions) | `#e0b63a` |
| Slot colour — red (middle) | `#d9534f` |
| Slot colour — green (weakest) | `#4caf7d` |
| Farm tiles | `#5fb85f` |
| Desalination tiles | `#4fa3e0` |
| Laboratory tiles | `#e0913f` |
| Symbiotic domes | `#b07ce8` |
| Standard city domes | `#f1f1f1` |
| Brown metropolis tile | `#a4763a` |
| Blue metropolis tiles | `#3f8fd6` |
| Upgrade markers / accents | `#ffd24d` |

Player colours (use in this order for seats 1–4):
teal `#1f9e8a`, coral `#e2603f`, gold `#d9a521`, violet `#7b5cd6`.

---

## 6. Component glossary

Describe these consistently; they're what the app draws.

- **City dome** — a low translucent hemisphere, frosted white, ~coin diameter.
- **Symbiotic dome** — same shape, violet, faintly luminous.
- **Tunnel** — a short glass-and-steel tube segment laid into an engraved channel
  between two city sites. Upgraded ones carry a small gold band.
- **Farm** — a small square tile, green, with a kelp-frond motif.
- **Desalination plant** — small square tile, blue, droplet motif.
- **Laboratory** — small square tile, amber, flask motif.
- **Metropolis tiles** — larger rectangular tiles; one brown (needs two tunnels),
  two blue (need one each).
- **Central action board** — a wide board whose main feature is a **3 × 5 grid of
  colour-coded card slots**, five yellow, five red, five green, each slot an empty
  recessed rectangle sized for a card. A Federation track runs along one edge.
- **Cards** — poker-sized, with a coloured left edge band (yellow / red / green)
  that matches the slot colours.
- **Resources** — brass coins (credits), green pressed-kelp chips, grey-silver
  bars (steelplast), violet vials (biomatter), cyan crystals (science).

---

## 7. Prompts

### Variant A — photoreal hero (primary)

```
Photograph of an original underwater-city-themed strategy board game set up on a
dark slate table, ready to begin, nothing yet played. Low three-quarter camera
angle, 35mm, soft overcast key light from upper left with a faint cyan bounce
from below. Centre of table: a wide navy game board whose face is a grid of
fifteen empty recessed card slots, five gold, five red, five green, each slot
empty. Radiating toward the camera: personal player boards in deep navy and
slate blue, each showing an empty network of circular city sites joined by
engraved empty channels, with a single frosted-white translucent dome placed in
the lower right of each board and no other pieces built. Beside the boards: three
neat stacks of cards with coloured edge bands, a small bowl of spare violet
domes, and tidy little starting piles of brass coins, green kelp chips and
silver bars. Three face-down cards fanned at each seat. Colour story of deep
ocean navy #0b1c2c, panel blue #142f47, gold #e0b63a, coral red #d9534f, sea
green #4caf7d. Crisp, clean, premium board game photography, shallow depth of
field, high detail on the nearest board, no hands, no people, no text.
```

### Variant B — flat overhead setup shot

Same content; replace the camera sentence with:

```
Perfectly flat overhead top-down view, square to the table, even diffuse
lighting, every component fully legible, styled like a hobbyist board game
setup photograph.
```

### Variant C — stylised isometric key art

```
Isometric illustration of an original undersea city-building board game arranged
for the start of play, clean vector-adjacent rendering with soft gradients and
crisp edges. Empty colour-coded action slots on a central board, bare player
boards each with one white dome and empty tunnel channels, small stacks of
cards and tidy resource piles. Deep ocean navy palette with gold, coral and sea
green accents, subtle caustic light ripples across the table. Modern, calm,
uncluttered, poster-quality, no text.
```

### Variant D — the digital version (optional alternate)

```
A tablet lying flat on a dark wooden table, screen on, displaying a dark navy
board game interface with a grid of colour-coded panels and a network diagram of
circular nodes; a mug and a notebook beside it; warm room light, cool screen
glow, shot from a three-quarter angle, no legible text on screen.
```

### Negative prompt (all variants)

```
text, letters, words, logos, watermark, signature, hands, people, arms, dice,
meeples, clutter, food, drink, blurry, low detail, warped geometry, melted
shapes, duplicated boards, pieces already built, crowded board, garish
saturation, lens flare, heavy fog
```

---

## 8. Parameters

- **Midjourney:** append `--ar 40:21 --style raw --stylize 150` (hero),
  `--ar 1:1` (square). Variant C: drop `--style raw`, `--stylize 400`.
- **Stable Diffusion / Flux:** 1536 × 800 base then upscale ×1.5; CFG 4–6;
  30–40 steps; a photographic checkpoint for A/B, an illustration one for C.
- **DALL·E / Imagen:** give the prompt unmodified, request wide landscape, and
  say "no text anywhere in the image" a second time — they leak text otherwise.

---

## 9. Text in the image

Generators will produce garbled pseudo-text on cards and boards. Plan for it:
prompt for text-free components, accept faint illegible marks as texture, and
typeset any real wording (title, URL) afterward in a layout tool. Reject any
image where fake lettering is prominent enough to read as broken.

---

## 10. Originality requirement

This is an original fan implementation, not a reproduction. The image must be an
**original design in the genre** — do not ask for, or accept, artwork that
reproduces the published game's box art, logo, typography, specific board
layout, or component sculpts. If a returned image looks like a photograph of the
real retail product, discard it and re-prompt. Describing shapes and colours (as
above) is the intended route; naming the publisher or its artists is not.

---

## 11. Acceptance checklist

- [ ] Zero tunnels, farms, plants or labs placed anywhere
- [ ] Exactly one white dome per player board, lower-right
- [ ] All fifteen action slots visibly empty
- [ ] Slot colours read as gold / red / green, five of each
- [ ] Resource piles small and tidy, not heaped
- [ ] No legible or near-legible text
- [ ] No hands, people or dice
- [ ] Palette matches §5 within reasonable tolerance
- [ ] Nearest player board sharp and readable
- [ ] Upper-left third calm enough to take overlaid type
