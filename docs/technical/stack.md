# Tech Stack

The prototype is a **single-player web app**. No backend services in the prototype.

## Choices

| Layer                  | Choice                                       |
|------------------------|----------------------------------------------|
| Language               | TypeScript                                   |
| Build tool             | Vite                                         |
| UI framework           | React                                        |
| Chess rules            | Custom in-repo engine (`src/game/chess/`) — chess.js was tried and replaced |
| Chess AI               | Stockfish.wasm (depth-tuned)                 |
| Save / persistence     | Browser localStorage                         |
| State management       | React `useState` today (in `src/components/Match.tsx` + sibling hooks). **Zustand is queued for M5** when run state must survive across screens (`mode-select` → `match` → `reward` → `shop`). |
| Styling                | Plain CSS modules (or Tailwind if we want speed). Prefer CSS modules for simpler debug. |
| Routing                | React Router only if we end up with multiple pages; otherwise none |
| Tests                  | Vitest                                       |
| Linting                | ESLint + Prettier                            |
| Deployment             | Static host (any: GitHub Pages, Netlify, Vercel) |

## Rationale

### TypeScript + React + Vite

- **TypeScript** is non-negotiable for a project with as many entity types as this (cards, pieces, artifacts, board overlays, run state, match state, etc.). Strong typing catches bugs at compile time.
- **React** is the most accessible UI framework for the kind of UI we're building (cards, drag/drop, modals, side-panels). Big ecosystem, huge documentation surface, easy to onboard new contributors.
- **Vite** is the fastest-iterating modern build tool. Hot-module reload is essential for tuning a card-heavy game.

### Custom chess engine (replaced chess.js)

- Originally we planned to wrap chess.js. We tried it and replaced it with a custom engine in `src/game/chess/` (rules in `rules.ts`, stateful wrapper in `engine.ts`).
- The trigger was **wall-aware move generation**. chess.js doesn't expose hooks deep enough into ray attacks / check evaluation to treat walls as friendly blockers cleanly; doing it as a post-filter loses correctness on edge cases (sliding-piece pins, castling transit, en-passant target, attacker-set computation for in-check evaluation).
- The custom engine implements: legal-move generation (including castling, en-passant, promotion), check/checkmate/stalemate, threefold repetition, 50-move draw, FEN parsing/serialization, attacker sets per side, and pluggable `Overlays` (walls, freezes, roots, disarms, compels, shields, sanctuaries, empowers) that all rule paths consult uniformly.
- See `chess-integration.md` for the engine surface and how Stockfish moves are validated against it.

Alternatives considered: chessops or other libs (rejected for the same reason — same wall-blocking limitation); a thinner wrap-and-postfilter on chess.js (tried; correctness issues piled up).

### Fairy-Stockfish.wasm

- Strong chess AI with adjustable depth/time controls. Tunable strength.
- Runs entirely client-side (a worker thread).
- Specifically: the `fairy-stockfish-nnue.wasm` npm package (GPL-3.0). Fairy-Stockfish is a Stockfish fork with native chess-variant support, including custom board dimensions defined in a `variants.ini`. Standard mode uses 6×6 and 7×7 boards (plus stock 8×8) across the run; without variant support we'd be back to a homegrown toy AI on small boards.
- **Cross-origin isolation required.** Fairy-Stockfish uses pthreads + SharedArrayBuffer, so the document must be served with `Cross-Origin-Embedder-Policy: require-corp` and `Cross-Origin-Opener-Policy: same-origin`. `vite.config.ts` adds these headers via middleware for the dev and preview servers; production deployments must configure the same headers at the host level. We accept this constraint to gain native non-8×8 support.
- Doesn't know about our cards / walls / curses. We use a **layered AI** — Fairy-Stockfish proposes moves under our wall-/freeze-aware `searchmoves` filter, and a custom layer decides curse-card insertion timing on the boss's behalf. See `ai.md`.

Alternatives considered: hand-rolled alpha-beta (rejected — far weaker chess play; we'd spend more time tuning than playing); heuristic AI (rejected for the same reason).

### localStorage

- Simple key-value persistence in the browser. No server required.
- Persists across sessions.
- ~5MB limit per origin is plenty for our save data (run state + meta-progression).

We will **JSON-serialize** the entire run/meta state. See `persistence.md` for the schema sketch.

### State management — `useState` today, Zustand at M5

- M0–M4 ship with React `useState` in `src/components/Match.tsx` (decomposed into a `useMatchEngine` / `useCardSystem` / `useAiTurn` / `useUndoRedo` / `useDevEditor` quartet under `src/components/Match/`). All match state lives in one component subtree, so prop-drilling is bounded and a store earns nothing yet.
- **Zustand becomes load-bearing at M5**, when run state (gold, deck, artifacts, act/match index) must survive across `Match` → `Reward` → `Shop` → `Match` screen transitions. At that point the existing hooks migrate to a `runStore` + `matchStore` (the action-shaped hook surface makes this mechanical).
- Reasons we picked Zustand specifically: simpler API than Redux, less boilerplate than Context for cross-cutting state, good selector-based subscription performance, easy to mock for tests, easy to serialize for persistence.
- The dependency is already in `package.json` so the M5 PR can land without an install step.

### Plain CSS modules vs Tailwind

- Default to **plain CSS modules** (one .module.css per component). Pros: explicit class names; easy to grep; no build-tool magic; learn-curve-free for new contributors.
- Switch to Tailwind only if we feel CSS authoring is slowing iteration. Don't over-engineer.

## Constraints

- **Single-player only.** No backend, no multiplayer, no server-driven content.
- **No PWA / offline-first concerns.** Just a normal web app.
- **Browser support:** target modern evergreen browsers (Chromium, Firefox, Safari latest). No IE / legacy support.

## Out of scope (for the prototype)

- Mobile-first responsive design. (Desktop browser primary; touch input could be added later.)
- Internationalization. English only.
- Accessibility audits. (Aim for keyboard-navigable UI as a baseline; don't pursue full WCAG compliance pre-MVP.)
- Analytics / telemetry.
- User accounts.

## Project bootstrap (historical, for reference)

```
npm create vite@latest choss -- --template react-ts
cd choss
npm install fairy-stockfish-nnue.wasm zustand
npm install -D vitest @testing-library/react @testing-library/jest-dom
```

(The actual bootstrap also installed chess.js, which has since been removed.) Directory structure follows `architecture.md`.
