# choss

A single-player chess + cards + roguelite + deckbuilder. Web prototype.

> Influences: Slay the Spire, Balatro, classical chess.

## Status

Match-loop prototype playable in the **Sandbox** mode (board editor, full card library, optional AI). The chess core, the card system, walls, square effects (sanctuaries, traps), and the dev sandbox are shipped. The next user-facing milestone is **M5 — preliminary Royal run loop** (mode-select → match → reward → shop). See [`docs/roadmap/milestones.md`](docs/roadmap/milestones.md) for the full status and ordering.

## Where to start

- **For agents (and humans new to the project):** read [`CLAUDE.md`](CLAUDE.md) — it indexes everything.
- **For design context:** start with [`docs/README.md`](docs/README.md), then [`docs/design/overview.md`](docs/design/overview.md).
- **For implementation:** [`docs/technical/stack.md`](docs/technical/stack.md), [`docs/technical/architecture.md`](docs/technical/architecture.md), and [`docs/roadmap/milestones.md`](docs/roadmap/milestones.md).

## Quick summary

- Two modes: **Royal** (standard chess army both sides + cards) and **Skirmish** (start small, draft pieces between matches + cards).
- A run is **9 matches across 3 acts**, each act ending in a hand-crafted boss. Single-elimination.
- Cards have **energy costs (0–10)**. The player starts at **1 energy on turn 1**, banks **+1 each turn** up to a cap of **10**. Hand of 5; every played card is consumed for the rest of the match.
- Between every match: card draft + (Skirmish) piece draft + Balatro-style shop with reroll, removal, and skip-for-gold.
- **Artifacts** (3 rarity tiers, cap 5) sourced from shop and boss rewards.
- Standard chess rules apply. **Draws count as run loss.** No clock.
- Stack: **TypeScript + React + Vite + custom chess engine + Stockfish.wasm + localStorage**.
- Visual style: **abstract minimalist** (geometric shapes, color-coded sides, no representational art).
- Single-player only. No multiplayer scaffolding.

## Run locally

```
npm install
npm run dev      # Vite dev server
npm test         # Vitest suite
npm run build    # tsc + Vite production build
```

For everything else, read the docs.
