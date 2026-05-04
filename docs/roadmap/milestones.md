# Milestones

A rough ordering of work to get from "empty repo" to "playable prototype." Numbers in `[brackets]` are vague effort estimates in *days of focused dev work*, not calendar days.

The milestones are roughly sequential — each builds on the previous — but several can be parallelized.

## Status as of 2026-05-03

The chess core, card system, walls, dev sandbox, the first half of the square-effect overlays, and the M5 run loop (3-match Royal mini-run + shop + reward) are built. The remaining work is artifacts, bosses, zone-control buffs, the full 9-match run, then Skirmish.

Already shipped:

- **Chess board + rules.** `src/components/Board/Board.tsx` (click + drag-to-move, hover tooltips). Full chess rules — including checkmate / stalemate / 50-move / threefold — in a custom engine at `src/game/chess/rules.ts`. (chess.js was tried and replaced with our own engine because of wall-aware move generation.)
- **Stockfish AI.** `src/ai/stockfish.ts`, depth-tuned (`easy=2 / normal=6 / hard=10`). AI moves are validated against our wall-aware legal-move set before being applied.
- **Cards.** 37 cards in `src/game/cards/data/`. Hand / draw pile / consumed pile / energy state in `src/game/cards/match.ts`. 25 effect kinds spanning tempo, disruption, spatial, movement, summon, swap, sacrifice, revival, and generators. Card UI + targeting via `src/components/Hand` + `src/components/Board`.
- **Walls.** Wall storage and lifetimes in the engine; ray-blocking in move generation; check evaluation respects walls.
- **Dev sandbox.** Top-level "Sandbox" mode in `src/App.tsx`; full editor / library / energy controls / undo-redo in `src/components/Match/DevPanel.tsx`.
- **Square effects (partial).** Sanctuaries and traps are stored, triggered, and rendered with hover info on the board. Zone-control buffs (auras that grant adjacent-square buffs) are not yet implemented — see M7 below.
- **Tooltips.** Square / piece tooltips on the board (commit `80d3ee7`).
- **Run loop + shop (M5).** Top-level Royal mode kicks off a 3-match mini-run in `src/components/Run/`. State machine + reward generation in `src/game/progression/run.ts`; shop / reroll / removal / interest in `src/game/shop/shop.ts`. Post-match draft (1-of-3) with skip-for-gold, then a shop with rotating card / booster offers, reroll service (per-shop scaling), card removal (per-run scaling), and Balatro-style interest tally on shop close.

State management note: zustand was planned and skipped — match state currently lives in `Match.tsx` with `useState`. Adopt zustand only if cross-component state grows painful.

## M0 — Project bootstrap [done]

Vite + React + TS scaffold. Stockfish.wasm wired. Vitest + ESLint + Prettier set up. Empty router-shell renders.

## M1 — Chess board UI + engine [done]

Built without chess.js — see `src/game/chess/rules.ts` and `src/components/Board/Board.tsx`.

## M2 — Stockfish AI [done]

`src/ai/stockfish.ts` with depth-tuned wrapper and difficulty selector.

## M3 — Card system foundation [done]

37 cards, hand / draw / consumed piles, energy state, target prompts, and resolution all live. Goes well beyond the original M3 scope (the original list named ~5 starter cards).

## M4 — Wall integration [done]

Wall-aware legal moves and check evaluation in `src/game/chess/rules.ts`. Lifetimes decrement on turn start. Stockfish moves are filtered through the wall-aware legal-move set.

## Dev mode — testing sandbox [done]

Live in `src/components/Match/DevPanel.tsx`. Provides editor, library, energy controls, and action-granular undo / redo. Selected from the App's mode menu alongside the (still-disabled) Royal and Skirmish options.

---

## M5 — Preliminary Royal: run scaffolding + shop [done]

Live in `src/components/Run/` + `src/game/progression/run.ts` + `src/game/shop/shop.ts`. Top-level Royal kicks off a 3-match mini-run; reward step offers a 1-of-3 card draft (or skip-for-gold); shop offers rotating cards + booster packs with reroll (per-shop scaling) and card removal (per-run scaling); +1 gold per 5 saved at shop close (capped +5). Boss / artifact pieces are stubbed for the milestones below.

## M6 — Artifacts [2d]

- Define the `Artifact` type and a small starter artifact pool (~10 artifacts spanning all four effect domains).
- Artifact slots in the run state (cap 5).
- Shop artifact offers.
- Artifact trigger system (hook into card-played, capture, check, turn-start, etc.).
- Artifact sidebar UI.

(Boss-reward artifact path is stubbed but unused until M8.)

**Done when:** artifacts can be acquired from the shop, hold their slot, displace correctly past the cap, and fire their effects in matches.

## M7 — Zone-control buffs [0.5d]

Finishes the unfinished tail of the original M9. Sanctuaries and traps already work — this is just the aura system.

- Zone-buff storage on squares.
- Zone-buff evaluation at start-of-turn (and on relevant board changes).
- Sidebar / square-aura UI text.
- At least 1 card and 1 artifact that grants a zone-control buff that applies correctly.

**Done when:** placing a zone-buff square grants the documented adjacency effect, and the aura renders in the board UI. (Boss B will lean on this in M9.)

## M8 — First boss [3d]

Build one boss end-to-end before generalizing. Pick Boss A — "The Iron Garrison" sketch is a good starter. Validates the modifier+hazard+curse pattern before the other two bosses are built.

- Match-modifier rule.
- Fixed board hazards.
- Curse pool (1–2 curses).
- Curse-AI scheduler (deterministic, trigger-based).
- Boss-reward flow: large gold + 1-of-3 artifact pick (uses M6).
- Boss preview at act start.

**Done when:** the act-1 boss is playable, the modifier rule is enforced, hazards are placed, curses fire on the right triggers, and beating it grants the boss-tier reward.

## M9 — Full Standard run [done in this PR — variable board + Chess960 + boss rebalance]

Standard is the active default mode. Replaces the old "Full Royal run" milestone.

- Variable board size (4×6 → 8×8 across seven distinct sizes, one file or one rank per match) threaded through the engine, rules, FEN parser, Board UI, and Match shell.
- Generalized Chess960 generator (`src/game/chess/positions.ts`) producing a per-match starting position for whatever board / piece set the run hands it.
- Per-match curve table in `src/game/progression/standard.ts` — points-budget driven for non-bosses (M1 K + 4P + ~2 minors → M9 full standard chess army), explicit hand-tuned compositions for bosses.
- Toy AI (`src/ai/toyAi.ts`) for non-8×8 matches; Stockfish stays for 8×8.
- Dev sandbox: 3..8 size pickers per axis, live position validation (extra kings, kings adjacent, pawns on back ranks, wrong-side-in-check) with red highlights on offending pieces.
- Boss A (5×6) and Boss B (7×7) rebalanced; Boss C (8×8) unchanged.

**Done when:** a player can complete (or lose) a full 9-match Standard run from the menu, the board scales correctly across acts, and the dev editor flags invalid positions live.

Royal stays disabled in the menu — when re-enabled it will default to Chess960 with a "standard start" opt-in. Save/resume (was M9 scope) moves to a follow-up milestone.

## M10 — Skirmish [3d]

Most of the run scaffolding (M5 / M6 / M9) is shared with Standard, so Skirmish is mostly piece-economy work on top of the existing shell.

- Skirmish mode toggle in mode select (re-enable the disabled menu entry).
- Skirmish starting roster (king + 2 pawns + 2 minors).
- Piece-draft post-match (1 of 3, tiered rarity, soft caps).
- Placement screen: drag-and-drop pieces onto ranks 1–2 before each match.
- AI starting army scaling across the run.

**Done when:** a complete Skirmish 9-match run is playable end-to-end, drafting pieces and placing them between matches.

## M11 — Content expansion + polish [open-ended]

- Grow the card pool toward the archetypes' target sizes.
- Grow the artifact pool to ~30 artifacts.
- Tune card / artifact / boss balance.
- Animation pass on card play and piece moves.
- Sound effects (basic).
- Card hover descriptions.
- Fix accumulated paper cuts.

This phase is open-ended and driven by playtest feedback.

## Parallelization opportunities

- M6 (artifacts) and M7 (zone-buffs) are independent and can be done in parallel after M5.
- Boss B and Boss C inside M9 can be built in parallel by two contributors once M8's pattern is in place.
- M10 (Skirmish) has no real dependency on M9's bosses — once M5 / M6 ship, an enthusiastic contributor could prototype piece economy in parallel with the boss work, deferring boss-aware AI scaling to the very end.

## What is explicitly NOT in any milestone

- Multiplayer.
- Mobile / touch UI optimization.
- Tutorial mode (added late if at all; the abstract minimalist UI plus tooltips should suffice).
- Localization.
- Custom seeded runs / daily challenges (deferred — see `progression.md` and `open-questions.md`).
- Meta-progression / Ascension scaffolding. Designed in `docs/design/progression.md` but not milestoned in this revision; re-add when Royal and Skirmish are both shippable.
