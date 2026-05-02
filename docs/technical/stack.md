# Tech Stack

The prototype is a **single-player web app**. No backend services in the prototype.

## Choices

| Layer                  | Choice                                       |
|------------------------|----------------------------------------------|
| Language               | TypeScript                                   |
| Build tool             | Vite                                         |
| UI framework           | React                                        |
| Chess rules            | chess.js                                     |
| Chess AI               | Stockfish.wasm (depth-tuned)                 |
| Save / persistence     | Browser localStorage                         |
| State management       | Zustand or Context — pick the simplest one we don't outgrow (default: Zustand for global run state) |
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

### chess.js

- Battle-tested, MIT-licensed, ~5MB compressed footprint isn't an issue for a non-mobile web prototype.
- Implements legal-move generation, check/checkmate/stalemate detection, FEN/PGN parsing, draw rules.
- It does not natively support our card-induced rule extensions (extra moves, walls). We **wrap chess.js** and layer an extension layer on top — see `chess-integration.md` for the wrap pattern.

Alternatives considered: writing a chess engine from scratch (rejected — too much surface area for a prototype); chessops or other libs (chess.js is the most popular and most documented).

### Stockfish.wasm

- Strong chess AI with adjustable depth/time controls. Tunable strength.
- Runs entirely client-side (a worker thread).
- Specifically: the `stockfish.js` npm package, which ships both a WASM build (`stockfish.wasm.js` + `stockfish.wasm`) and an asm.js fallback. We avoided the `stockfish.wasm` package because it requires `COOP` / `COEP` HTTP headers, which complicates the static-host story.
- Doesn't know about our cards / walls / curses. We use a **layered AI** — Stockfish proposes moves on a **virtualized chess board** (where the rule extensions are simulated), and a custom layer decides curse-card insertion timing on the boss's behalf. See `ai.md`.

Alternatives considered: hand-rolled alpha-beta (rejected — far weaker chess play; we'd spend more time tuning than playing); heuristic AI (rejected for the same reason).

### localStorage

- Simple key-value persistence in the browser. No server required.
- Persists across sessions.
- ~5MB limit per origin is plenty for our save data (run state + meta-progression).

We will **JSON-serialize** the entire run/meta state. See `persistence.md` for the schema sketch.

### Zustand for state

- Simpler API than Redux, less boilerplate than Context for cross-cutting state.
- Good performance characteristics for the size of state we'll have.
- Easy to mock for tests.

(If the team has a strong preference for vanilla React Context + reducers, that's also fine for prototype scale. The choice should not be sacred.)

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

## Project bootstrap (recommended)

```
npm create vite@latest choss -- --template react-ts
cd choss
npm install chess.js stockfish.wasm zustand
npm install -D vitest @testing-library/react @testing-library/jest-dom
```

Then directory structure per `architecture.md`.
