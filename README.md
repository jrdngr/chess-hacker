# choss

A single-player chess + cards + roguelite + deckbuilder. Web prototype.

> Influences: Slay the Spire, Balatro, classical chess.

## Status

Pre-implementation. Design phase is complete; code has not started. See [`docs/roadmap/milestones.md`](docs/roadmap/milestones.md) for the planned implementation order.

## Where to start

- **For agents (and humans new to the project):** read [`CLAUDE.md`](CLAUDE.md) — it indexes everything.
- **For design context:** start with [`docs/README.md`](docs/README.md), then [`docs/design/overview.md`](docs/design/overview.md).
- **For implementation:** [`docs/technical/stack.md`](docs/technical/stack.md) and [`docs/roadmap/milestones.md`](docs/roadmap/milestones.md).

## Quick summary

- Two modes: **Royal** (standard chess army both sides + cards) and **Skirmish** (start small, draft pieces between matches + cards).
- A run is **9 matches across 3 acts**, each act ending in a hand-crafted boss. Single-elimination.
- Cards have **energy costs (0–4)**, the player has **3 energy per turn**, hand of 5.
- Between every match: card draft + (Skirmish) piece draft + Balatro-style shop with reroll, removal, and skip-for-gold.
- **Artifacts** (3 rarity tiers, cap 5) sourced from shop and boss rewards.
- Standard chess rules apply. **Draws count as run loss.** No clock.
- Stack: **TypeScript + React + Vite + chess.js + Stockfish.wasm + localStorage**.
- Visual style: **abstract minimalist** (geometric shapes, color-coded sides, no representational art).
- Single-player only. No multiplayer scaffolding.

For everything else, read the docs.
