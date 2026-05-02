# Theme & Visual Direction

The prototype uses an **abstract minimalist** aesthetic. No representational art, no fantasy or sci-fi setting, no narrative lore. Just shapes, colors, and motion in service of clarity.

## Why abstract minimalist

- **Fastest to ship.** Geometric shapes and CSS-defined visuals are cheap to produce. We don't need illustrators on a prototype.
- **Clearest gameplay.** The board state is busy (pieces + walls + square effects + zone buffs + sidebars for cards / artifacts). Minimalism keeps it readable.
- **Distinctive.** Most chess apps use representational pieces. A minimalist treatment feels different and fits the deck-builder UI sensibility (Slay the Spire / Balatro both lean toward stylized over realistic).
- **Theme-neutral.** We can swap themes (cosmic, steampunk, fantasy) post-prototype as cosmetic skins without touching any gameplay logic.

## Visual rules

### Color

- **Two-color player palette.** The player's pieces in a warm color (default: amber / orange). The opponent's pieces in a cool color (default: indigo / blue). Same shapes, different color.
- **Board:** alternating soft light and dark squares — high contrast enough to read, low chroma enough not to fight pieces.
- **Effect colors** (separate accent palette):
  - Wall: neutral gray-on-gray, heavy fill.
  - Square effects: per-effect-type tint — e.g., red for damage zones, green for buff zones, purple for control marks.
  - Zone-control buffs: subtle outline glow on the controlled region.
  - Curse cards: a desaturated red border around the card.

Color choices are **functional first, aesthetic second**. Colorblind accessibility: distinguish using shape and outline pattern in addition to color.

### Pieces

Each piece type is a unique geometric glyph. Suggestions (final TBD):

| Piece   | Shape                                |
|---------|--------------------------------------|
| King    | Crown silhouette (filled triangle with notches) |
| Queen   | Diamond                              |
| Rook    | Square block                         |
| Bishop  | Tall pointed triangle                |
| Knight  | Asymmetric L or arrow                |
| Pawn    | Small circle                         |

All pieces fit comfortably within a board square, with consistent visual weight. Selection state shows a glow / outline highlight.

### Cards

- **Card frame:** a clean rounded rectangle, dominant color on the rarity tier (gray = common, blue = uncommon, gold = rare).
- **Card name:** sans-serif, top of card.
- **Cost:** large numeric in the upper-left corner.
- **Effect text:** centered, concise, plain-language description — no flavor text in the prototype.
- **Cycle vs Consume keyword:** small icon at the bottom corner. Consume = a single-X icon, Cycle = a circular arrow icon (or no icon for cycle, since it's the default).
- **Card art:** none in the prototype. The card's main visual is its color, name, and cost. Add art in post-prototype iteration.

### UI surface

- **Match screen layout:**
  - Center: the 8x8 board, taking ~60% of the viewport.
  - Bottom: the player's hand (up to 5–6 cards).
  - Top-left: turn indicator + energy display + draw/discard counts.
  - Top-right: opponent piece roster summary (Skirmish) or boss-modifier reminder (boss matches).
  - Right sidebar: artifact slots (always visible, hover for details).
  - Curses-in-hand visually distinct from regular cards (the desaturated red border).
- **Reward / shop screens:** modal-style overlays, full-screen with a "back to map / continue" button.
- **Run map:** a simple linear progress bar with 9 nodes, current position marked.

### Motion

- **Card play:** card lifts, plays its effect with a short visualization, then animates to discard / consume.
- **Move animations:** smooth piece glide along the move path. Captures pop the captured piece off.
- **Curse insertions:** a visible flash + the card sliding into hand from above with a curse-tinted effect.
- Motion should be **fast** (300–400ms total per animation). Players replaying matches will hate slow animations.

## Audio direction

Out of scope for the prototype. Add basic sound effects (click, place, capture, victory) post-MVP. Music is a stretch goal.

## What we're explicitly NOT doing

- ❌ No representational art (no painted knights, no fantasy creatures).
- ❌ No flavor text on cards (in the prototype).
- ❌ No story / lore. Boss names are descriptive ("The Iron Garrison") not narrative.
- ❌ No voice-acting, no cutscenes.
- ❌ No animated character portraits.

These can all be added later as a "skin" layer over the same gameplay. The minimal aesthetic is a deliberate choice for prototype velocity, not a permanent commitment.

## Future skin layers (post-prototype)

If we want to add identity, the cleanest path is theme skins:

- **Cosmic:** pieces become constellations; cards become "visions"; bosses are celestial titans.
- **Clockwork:** pieces are mechanical cogs; cards are gears / blueprints; bosses are giant automatons.
- **Fantasy:** classic high-fantasy treatment.

Skins should affect ONLY visuals and naming. Mechanics, balance, and rules remain identical across skins.
