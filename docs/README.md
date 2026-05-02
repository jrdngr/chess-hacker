# choss — Docs

Welcome. This folder is the design and technical reference for **choss**: a single-player chess + cards + roguelite + deckbuilder.

## Reading order for newcomers

1. [`design/overview.md`](design/overview.md) — pillars, the run loop, the match loop.
2. [`design/modes.md`](design/modes.md) — Skirmish vs Royal.
3. [`design/cards.md`](design/cards.md) — cards, energy, hand, disposal.
4. [`design/progression.md`](design/progression.md) — runs, acts, Ascension.
5. Skim the rest of `design/` as needed.
6. When ready to build, read [`technical/stack.md`](technical/stack.md) and [`technical/architecture.md`](technical/architecture.md), then [`roadmap/milestones.md`](roadmap/milestones.md).

## Folder map

```
docs/
├── README.md                   ← you are here (index)
├── glossary.md                 ← term definitions
├── design/                     ← what the game IS
│   ├── overview.md
│   ├── modes.md
│   ├── cards.md
│   ├── pieces.md
│   ├── board.md
│   ├── artifacts.md
│   ├── economy.md
│   ├── bosses.md
│   ├── progression.md
│   ├── chess-rules.md
│   └── theme.md
├── technical/                  ← how the game is BUILT
│   ├── stack.md
│   ├── architecture.md
│   ├── chess-integration.md
│   ├── ai.md
│   └── persistence.md
└── roadmap/                    ← what to build, and what is undecided
    ├── milestones.md
    └── open-questions.md
```

## Conventions

- These docs are the source of truth for design intent. When implementing, follow them. When you discover the design needs to change, **update the doc in the same PR/commit as the code**.
- Numbers in these docs (energy = 3, hand size = 5, 9 matches per run, etc.) are **starting values for the prototype**. They are tuning knobs and likely to change once we playtest.
- Open questions and explicit "TBD" items live in [`roadmap/open-questions.md`](roadmap/open-questions.md). If you make a decision while implementing, move it from open-questions into the relevant design doc.
- This is a **prototype**. Don't over-engineer. Don't build for hypothetical future features (multiplayer, mobile, alternative themes) unless they are explicitly in scope here.

## At a glance — the locked-in design

- **Genre:** chess (8x8) + deckbuilder + roguelite, single-player web app.
- **Modes:** Skirmish (small starting army, draft pieces between matches) and Royal (standard chess army on both sides, only cards differ).
- **Run shape:** 3 acts × 3 matches = 9 matches; each act ends in a hand-crafted boss (act 3 boss = finale). Linear path; no branching map.
- **No HP system:** lose a match, lose the run.
- **Cards:** hand of 5, draw to refill, energy = 3/turn, costs 0–4, energy resets each turn. Cards mostly cycle (shuffle back); some consume.
- **Pieces (Skirmish):** 1-of-3 draft after each match; tiered by piece value; soft caps per piece type; player-placed before each match.
- **Shop:** Balatro-style after every match. Buys: single cards + booster packs + artifacts. Services: reroll (scaling per shop), card removal (scaling per use). Currency: gold only. Skip rewards for gold. Balatro-style interest.
- **Artifacts:** sources = shop + boss rewards. 3 rarity tiers (C/U/R). Cap of 5 slots. Effects span cards, pieces, resources, conditional triggers.
- **Board:** always 8x8. Card-spawned square effects, zone-control buffs, walls/blocks. No portals.
- **Bosses:** 3 hand-crafted, visible at act start. Combine match-modifier rules + fixed board hazards + curse cards forced into the player's hand.
- **Win conditions:** standard chess — checkmate, stalemate, draws all enforced. Draws count as run-loss. No clock.
- **Meta-progression:** content unlocks only (no power buffs); Ascension/heat ladder for replay; single character.
- **Stack:** TypeScript + React (Vite), chess.js, Stockfish.wasm, localStorage.

For everything else — the why, the details, the edge cases — read the per-topic docs above.
