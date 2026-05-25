# Milestones

A rough ordering of work to get from "empty repo" to "playable prototype." Numbers in `[brackets]` are vague effort estimates in *days of focused dev work*, not calendar days.

The milestones are roughly sequential — each builds on the previous — but several can be parallelized.

## Status as of 2026-05-05

The chess core, card system, walls, dev sandbox, the full square-effect overlay set (sanctuaries / traps / zone-control buffs), the M5 run loop (3-match Royal mini-run + shop + reward), M6 artifacts (pool + shop offers + trigger system + sidebar), M7 zone-control buffs, the M8 first boss (Boss A — "The Firewall"), and M9 (full Standard run with Boss B "The Whale" and Boss C "The Singularity" wired end-to-end) are built. The remaining work is Skirmish (M10).

Already shipped:

- **Chess board + rules.** `src/components/Board/Board.tsx` (click + drag-to-move, hover tooltips). Full chess rules — including checkmate / stalemate / 50-move / threefold — in a custom engine at `src/game/chess/rules.ts`. (chess.js was tried and replaced with our own engine because of wall-aware move generation.)
- **Stockfish AI.** `src/ai/stockfish.ts`, depth-tuned (`easy=2 / normal=6 / hard=10`). AI moves are validated against our wall-aware legal-move set before being applied.
- **Cards.** 37 cards in `src/game/cards/data/`. Hand / draw pile / consumed pile / energy state in `src/game/cards/match.ts`. 25 effect kinds spanning tempo, disruption, spatial, movement, summon, swap, sacrifice, revival, and generators. Card UI + targeting via `src/components/Hand` + `src/components/Board`.
- **Walls.** Wall storage and lifetimes in the engine; ray-blocking in move generation; check evaluation respects walls.
- **Dev sandbox.** Top-level "Sandbox" mode in `src/App.tsx`; full editor / library / energy controls / undo-redo in `src/components/Match/DevPanel.tsx`.
- **Square effects.** Sanctuaries, traps, and zone-control buffs are all stored, triggered, and rendered with hover info on the board. Zone-buffs add a teal aura on every square in the buff's region (paler when the region is uncontrolled), an anchor ring on the source square, and a "Zone buffs" sidebar block listing each active buff and its remaining lifetime.
- **Tooltips.** Square / piece tooltips on the board (commit `80d3ee7`).
- **Run loop + shop (M5).** Top-level Royal mode kicks off a 3-match mini-run in `src/components/Run/`. State machine + reward generation in `src/game/progression/run.ts`; shop / reroll / removal / interest in `src/game/shop/shop.ts`. Post-match draft (1-of-3) with skip-for-gold, then a shop with rotating card / booster offers, reroll service (per-shop scaling), card removal (per-run scaling), and Balatro-style interest tally on shop close.
- **First boss (M8).** Boss A — "The Firewall" — runs end-to-end in Standard mode. Boss definitions and curse triggers live in `src/game/bosses/`; Match.tsx wires the modifier (no player walls), permanent hazard walls (c3 / c4), and the trigger-based curse scheduler. The Run shell prepends a boss-preview phase at act start and gates a 1-of-3 boss-tier artifact pick onto the post-boss reward step.
- **Acts 2 + 3 bosses (M9).** Boss B — "The Whale" (7×7) — modifier `captures-grant-captured-energy` queues +1 energy for the player on the next turn after their pieces are captured; pre-placed `Server Farm` zone-buff at d1 grants +1 energy/turn while the player holds it; `Memory Leak` curse fires every 4 turns and bills 1 energy on the next turn unless the player captured. Boss C — "The Singularity" (8×8) — modifier `no-promotion` strips promotion candidates from legal moves; a 2x2 void at d4/d5/e4/e5 destroys any piece ending its turn there; three curses (`Hardened` on turn 1, `Echo` on player check, `Bit Rot` every 5 turns). Echo grants the boss an extra chess move via the `bossExtraMoves` counter; Bit Rot removes a random own minor piece. New `MatchRules.noPromotion` flag and turn-scoped state (`pendingEnergyLossOnNoCapture`, `capturedThisTurn`, `noZeroCostCardsThisTurn`, `bossExtraMoves`, `pendingPlayerEnergyOnTurnStart`) all reset on `startPlayerTurn`.

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

## M6 — Artifacts [done]

Live in `src/game/artifacts/` (library + effect helpers) plus shop/Match/Run wiring.

- `Artifact` type with a discriminated `ArtifactEffect` union spanning the
  four effect domains: card cost discounts, hand size / starting energy /
  per-turn energy bonuses, gold-on-match-start, and capture / check
  triggers (draw, energy).
- 11 starter artifacts (6 common, 3 uncommon, 2 rare) covering all those
  domains in `src/game/artifacts/library.ts`.
- Artifact slots tracked in `RunState.artifacts`, cap 20 (`ARTIFACT_SLOT_CAP`).
  Buy is rejected at the cap; the displacement-pick modal from the design doc
  is deferred to polish (M11) since the prototype rarely fills the slots.
- Shop artifact offers: 1 per visit, weighted by rarity, never re-offered if
  already owned, priced common 12 / uncommon 18 / rare 25 (+ jitter).
- Trigger system wired in `Match.tsx`: hand-size / energy bonuses fold into
  `startPlayerTurn`, cost discounts into `playCard`, capture / check into the
  player chess-move handler.
- Artifacts shown as emoji badges in the run banner across all phases (match
  / reward / shop / summary); rarity-coloured borders, hover description.

(Boss-reward artifact path is stubbed but unused until M8.)

**Done when:** artifacts can be acquired from the shop, hold their slot,
displace correctly past the cap, and fire their effects in matches. ✅

## M7 — Zone-control buffs [done]

Live in `src/game/overlays/zoneBuffs.ts` plus card / artifact / Match wiring.

- `ZoneBuff` storage on `MatchCardState.zoneBuffs`. Card-placed buffs carry an `expiresOnTurn` and tick at start-of-turn alongside the rest of the timed overlays; artifact-granted buffs have no expiry and ride for the whole match.
- Region patterns: anchored `square-orthogonal-1` / `square-radius-1` (used by cards) and absolute `rank` (used by artifacts).
- Buff effects: `energy-per-turn` and `hand-size`. Both fold into `startPlayerTurn` / `refillHand` only when the controlling side has at least one piece on a region square.
- Aura UI: every region square gets a teal tint when controlled / paler grey when not, plus an anchor ring on the source square. The Match sidebar adds a "Zone buffs" block listing every buff with its source label, effect, active state, and remaining lifetime.
- New card: `Power Node` (cost 2, uncommon, spatial). Places a `square-orthogonal-1` zone-buff that grants +1 energy/turn while you have a friendly piece on the buff square or any orthogonal neighbour. Lasts 4 turns.
- New artifact: `Foothold` (uncommon). Grants a permanent rank-4 zone-buff: hand size +1 while you have a friendly piece on rank 4.

**Done when:** placing a zone-buff square grants the documented adjacency effect, and the aura renders in the board UI. ✅ (Boss B will lean on this in M9.)

## M8 — First boss [done]

Boss A — "The Firewall" — is live end-to-end and validates the
modifier+hazard+curse pattern for Boss B / C in M9.

- `BossDef` shape (modifier kind + permanent hazard walls + curse schedule),
  Boss-A definition in `src/game/bosses/library.ts`.
- Trigger-based curse scheduler in `src/game/bosses/scheduler.ts` —
  deterministic, with a once-per-player-turn cap. Wired into `Match.tsx`
  on turn-start, on player check, and on player capture.
- Match modifier rule: `no-player-walls` blocks every `place-wall` card via
  a new `MatchRules.forbiddenCardEffectKinds` parameter on `playCard`; the
  hand UI greys out forbidden cards.
- Indestructible boss-hazard walls: `Wall.permanent` flag bypasses the
  start-of-turn lifetime tick; Boss A spawns center pillars on its 6×6 board.
- New curse semantics in `playCard` / `refillHand`: curses cost 0, vanish on
  play (no consumed-pile entry), and don't count toward the hand-size cap.
- Throttled curse: cost-0 `next-move-constraint` effect that sets the new
  `mustNotCheckNextMove` flag; `engine.wouldDeliverCheck()` filters it out
  of the player's legal-move set until satisfied.
- Boss-reward flow: large gold (`WIN_BONUS_BOSS = 25`) + 1-of-3 artifact
  pick (rare-skewed via `pickRandomArtifacts`, owned-exclusion) + the
  regular post-match card draft. New `BossArtifactOffer` type and helpers
  (`generateBossArtifactOffer` / `pickBossArtifact` / `skipBossArtifact`).
- New `boss-preview` phase: shown at the start of any act whose boss is
  defined (`createRun` for act 1; `leaveShop` for acts 2 / 3 once those
  bosses ship). Renders name, modifier, hazard list, and the curse pool with
  trigger labels.

**Done when:** the act-1 boss is playable, the modifier rule is enforced,
hazards are placed, curses fire on the right triggers, and beating it grants
the boss-tier reward. ✅

## M9 — Full Standard run [done in this PR — variable board + Chess960 + boss rebalance]

Standard is the active default mode. Replaces the old "Full Royal run" milestone.

- Variable board size threaded through the engine, rules, FEN parser, Board UI, and Match shell. (Originally seven sizes growing one file/rank per match; later collapsed to three square sizes — one per act, growing only after each boss — see `docs/design/modes.md`.)
- Generalized Chess960 generator (`src/game/chess/positions.ts`) producing a per-match starting position for whatever board / piece set the run hands it.
- Per-match curve table in `src/game/progression/standard.ts` — points-budget driven for non-bosses (M1 K + 6P + 3 minors (or rook + minor) → M9 full standard chess army on 8×8), explicit hand-tuned compositions for bosses.
- Toy AI (`src/ai/toyAi.ts`) for non-8×8 matches; Stockfish stays for 8×8.
- Dev sandbox: 3..8 size pickers per axis, live position validation (extra kings, kings adjacent, pawns on back ranks, wrong-side-in-check) with red highlights on offending pieces.
- Bosses placed on each act's board (Boss A 6×6, Boss B 7×7, Boss C 8×8).

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
