# Milestones

A rough ordering of work to get from "empty repo" to "playable prototype." Numbers in `[brackets]` are vague effort estimates in *days of focused dev work*, not calendar days.

The milestones are roughly sequential — each builds on the previous — but several can be parallelized once the chess core is in place.

## M0 — Project bootstrap [0.5d]

- `npm create vite@latest` with the React + TypeScript template.
- Install chess.js, stockfish.wasm, zustand, vitest.
- Set up ESLint, Prettier, basic CI (lint + test).
- Create the directory structure described in `technical/architecture.md`.
- Get a "hello, choss" page rendering.

**Done when:** dev server runs, tests pass, lint passes, an empty router-shell renders.

## M1 — Chess board UI + chess.js integration [2d]

- Render an 8x8 board with click-to-select-and-move interaction.
- Render pieces using the geometric glyphs from `theme.md`.
- Wrap chess.js in a `ChoseEngine` (skeleton — no walls/extensions yet).
- Player vs player on the same screen (both sides controlled by the human).
- Detect checkmate / stalemate / draws; show win / draw / loss UI.

**Done when:** two humans can play a complete chess game on the prototype, and standard chess rules are enforced.

## M2 — Stockfish AI [1.5d]

- Set up the Stockfish web worker.
- Implement the depth-tuned wrapper (`ai/stockfish.ts`).
- Wire human-vs-AI: human plays white (default), AI plays black.
- Add a difficulty selector that maps to depth.

**Done when:** human can complete a full chess game vs the AI, AI moves play within ~1 second at depth 6.

## M3 — Card system foundation [3d]

- Define the `Card` type and a small starter card pool (5–10 cards).
- Implement hand / draw pile / discard pile / energy state in the match store.
- Hand UI: render cards, click to begin play, prompt for targets, resolve effect.
- Implement the **simplest** card effects first:
  - Tempo: "+1 energy this turn" (no target).
  - Tempo: "Draw 2 cards" (no target).
  - Disruption: "Freeze an enemy piece" (target piece).
  - Spatial: "Place a wall on a chosen square" (target square).
- Resolve these effects against the match state.
- End-of-turn refill, energy reset.

**Done when:** the player can draw a hand, play several cards, see them affect the match (board overlays + freeze status), and end their turn.

## M4 — Wall integration in chess.js wrapper [1.5d]

- Implement wall storage and the legal-move filter (see `chess-integration.md`).
- Implement walls-as-friendly-blockers in check evaluation (clone-and-test approach).
- Wire wall lifetimes (decrement at end-of-turn).
- Validate Stockfish's chosen move against our `legalMoves()` and re-pick if illegal (MultiPV-and-filter).

**Done when:** a wall placed by the player blocks enemy bishop / rook / queen lines, the AI doesn't try to walk through walls, and walls expire correctly.

## M5 — Match end-to-end + run scaffolding [2d]

- Add a top-level run state machine: `mode-select → match → reward → shop → match → ...`.
- Hard-code a 3-match Royal "mini-run" for testing.
- Implement post-match reward step: card draft (1 of 3) and gold reward.
- Implement skip-for-gold.
- Implement gold tracking on the run.

**Done when:** a player can complete a 3-match scripted Royal run, drafting one card after each match, gold persisting across the run.

## M6 — Shop [2d]

- Implement shop generation: rotating cards + booster packs (artifacts come later if not implemented yet).
- Reroll service (scaling per shop).
- Card removal service (scaling per use).
- Interest tally.
- Buying / spending UI.

**Done when:** between matches, the player can spend gold on cards / packs, reroll the shop, remove a card from their deck, earn interest.

## M7 — Skirmish mode + piece economy [3d]

- Skirmish mode toggle in mode select.
- Skirmish starting roster (king + 2 pawns + 2 minors).
- Piece-draft post-match (1 of 3, tiered rarity, soft caps).
- Placement screen: drag-and-drop pieces onto ranks 1–2 before each match.
- AI starting army scaling across the run.

**Done when:** a complete Skirmish 3-match mini-run is playable end-to-end, drafting pieces and placing them.

## M8 — Artifacts [2d]

- Define the `Artifact` type and a small starter artifact pool (~10 artifacts spanning all four effect domains).
- Artifact slots in the run state (cap 5).
- Shop artifact offers.
- Artifact trigger system (hook into card-played, capture, check, turn-start, etc.).
- Artifact sidebar UI.

**Done when:** artifacts can be acquired, hold their slot, and fire their effects in matches.

## M9 — Square effects + zone-control buffs [2d]

- Square-effect storage and trigger evaluation (on-enter / on-end-turn).
- Zone-buff evaluation at start-of-turn.
- A handful of cards that use square effects and zone buffs.
- UI: square auras, zone-buff sidebar text.

**Done when:** at least 2 cards spawn square effects, and at least 2 cards / artifacts grant zone-control buffs that apply correctly.

## M10 — First boss [3d]

- Pick one boss to build first (Boss A — "The Iron Garrison" sketch is a good starter).
- Implement its match-modifier rule.
- Implement its fixed board hazards.
- Implement its curse pool (1–2 curses).
- Implement the curse-AI scheduler.
- Boss-reward flow: large gold + artifact pick.
- Boss preview at act start.

**Done when:** the act-1 boss is playable, the modifier rule is enforced, hazards are placed, and curses fire on the right triggers.

## M11 — Full 9-match run [2d]

- Wire all 3 acts, 9 matches.
- Implement the other 2 bosses (Boss B and Boss C).
- Run win / loss screens.
- Save / resume on quit.

**Done when:** a player can complete an entire 9-match run from start to finish (or lose at any point).

## M12 — Meta-progression scaffolding [2d]

- Persistent meta state (`choss:meta` in localStorage).
- Track Ascension record per mode.
- Implement a small content-unlock system tied to first wins.
- Mode-select screen shows current Ascension.
- Implement Ascension 1 (one modifier) end-to-end.

**Done when:** winning a run unlocks Ascension 1, and starting an Ascension 1 run applies the modifier.

## M13 — Content expansion + polish [open-ended]

- Grow the card pool to ~40–60 cards spanning the archetypes.
- Grow the artifact pool to ~30 artifacts.
- Tune card / artifact / boss balance.
- Animation pass on card play and piece moves.
- Sound effects (basic).
- Fix accumulated paper cuts.

This phase is open-ended and driven by playtest feedback.

## Parallelization opportunities

- M3 (cards) and M4 (walls) overlap; do walls in parallel with cards once the wrapper exists.
- M8 (artifacts) and M9 (square effects / zones) are largely independent of each other and can be done in parallel.
- M10 (first boss) can begin once M9's overlays are stable.

## What is explicitly NOT in any milestone

- Multiplayer.
- Mobile / touch UI optimization.
- Tutorial mode (added late if at all; the abstract minimalist UI plus tooltips should suffice).
- Localization.
- Custom seeded runs / daily challenges (deferred — see `progression.md` and `open-questions.md`).
