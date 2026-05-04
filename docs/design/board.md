# Board

The board has a **maximum size of 8×8** but scales across a Standard run, growing one file or one rank at a time across seven distinct sizes (4×6 → 5×6 → 5×7 → 6×7 → 7×7 → 7×8 → 8×8) — see `modes.md` for the per-match table. Royal (when re-enabled) stays at 8×8. The dev sandbox supports any size from 3×3 to 8×8. Within a single match the board size is fixed. Variety on the board comes from **overlays** — square effects, zone buffs, and walls — that cards spawn during play.

## What's deliberately NOT in the design

- ❌ No portals or teleportation.
- ❌ No board geometry variation **within a match** (size is fixed once the match starts).
- ❌ No pre-placed terrain at match start (the board starts clean except for boss hazards — see `bosses.md`).
- ❌ No multi-board, no extra dimensions.

If you find yourself wanting to add any of these, file it as an open question — see `roadmap/open-questions.md`.

## What IS in the design: three overlay systems

Cards (and a few artifacts) can apply three kinds of overlays to the board.

### 1. Walls and blocked squares

Cards can place obstacles on squares.

- **Wall:** a square becomes impassable to all pieces (player and opponent). No piece may move onto a walled square; sliding pieces (bishop, rook, queen) cannot pass through it. Knights cannot land on it.
- **Destructible block:** like a wall, but a piece may "spend" a move to break it (effectively wasting a turn for the destroyer to remove the block). Destructible blocks are more common than permanent walls.
- **Lifetime:** walls placed by cards are typically temporary (last 2–4 turns) or permanent for the match. Spec on the card itself.

The UI must clearly distinguish a walled square (a thick border or filled tile) from a normal empty square.

### 2. Card-spawned square effects

A card can mark a specific square (or set of squares) with an effect. Effects can include:

- "If a friendly piece ends its move on this square, draw a card."
- "Any enemy piece that moves onto this square gets pushed back 1 square."
- "Pieces standing on this square at the start of your turn cannot be captured this turn."

Square effects are short-to-medium-lifetime (a few turns). They are visually marked on the board (a colored aura or icon) and have a visible turn-count remaining.

### 3. Zone-control buffs

Some cards (and some artifacts) grant a buff for **controlling** a region of the board. A region is a contiguous group of squares (e.g., "the center 4 squares", "the d-file", "your back rank"). "Control" means a friendly piece is on the region, or — for larger regions — that you have more pieces in the region than the opponent.

Buffs from zone control are passive and check at start of turn. Examples:

- "While you control the center 4 squares: gain +1 energy at the start of your turn."
- "While you have a piece on the 7th rank: your pawns may move 2 squares from any square (not just rank 2)."

Zone-control is a slower, board-state-driven mechanic. It rewards positional play and adds a strategic layer that pure combo cards don't.

## Interactions and edge cases

- **Walls + check:** a king cannot escape check by moving onto a wall. Walls participate in check evaluation as if the wall were a non-friendly blocker (king cannot move there, just like the king can't move onto a square attacked by an enemy).
- **Walls + pawn promotion:** a pawn cannot promote on a walled square (it can't get there).
- **Walls + en passant:** if the capture-target square is walled, en passant cannot be performed.
- **Walls being captured:** walls are not pieces; they are not captured. They are destroyed or expire.
- **Square effects on captures:** if a square effect triggers "on enter", a piece capturing onto that square also triggers it (capture is a move that ends on the square).
- **Square effects when the marked square is walled:** a wall and a square effect can coexist. The wall makes the square unenterable; the square effect remains pending until the wall is removed/expires.
- **Stacking:** at most one wall per square. Square effects: at most one per square (a new effect on an already-marked square overwrites the old one). Zone-control buffs: do not stack in any "+1 energy +1 energy" sense; multiple zone-buffs from different cards each apply once.

## Board representation

The board is always an 8x8 grid. Internally it should be modeled as a 2D state of squares, where each square has:

- An optional **piece** (chess piece + owner) — the standard chess board state.
- An optional **wall** (impassable, destructible flag, expiry).
- A list of **square effects** active on this square (with expiry per effect).

Zone-control buffs are not per-square; they are computed at the match level by inspecting which squares are "controlled" each turn (see `technical/architecture.md`).

The custom chess engine (`src/game/chess/`) handles the **piece state**; we layer wall / square-effect state above it via the engine's `Overlays`. See `technical/chess-integration.md`.

## Visual representation

Per the **abstract minimalist** theme (see `theme.md`):

- Board: alternating light/dark squares with a faint grid line.
- Pieces: minimal geometric glyphs (each piece type a unique shape) in player color (warm) vs opponent color (cool). No representational illustration.
- Walls: a heavy fill on the square (different from the dark-square color).
- Square effects: a small icon at the square corner + an aura/glow tinted by effect type.
- Zone-control buffs: subtle outline or shade on the controlled region, with a sidebar UI showing the buff text.

## Summary

The board is a blank canvas. Cards paint short-lived overlays onto it. The chess movement and capture rules apply to the board state including those overlays.

| Overlay type         | Source           | Persistence             | Visible     |
|----------------------|------------------|-------------------------|-------------|
| Wall                 | Card / artifact  | Turns or match-long     | Filled tile |
| Square effect        | Card             | A few turns             | Aura + icon |
| Zone-control buff    | Card / artifact  | While controlled        | Outline + sidebar text |
