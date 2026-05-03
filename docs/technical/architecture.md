# Architecture

This is a prototype web app. The architecture should be **simple, testable, and easy to evolve.** It is *not* designed for multiplayer, real-time scaling, or modding.

## Layers (top to bottom)

```
┌──────────────────────────────────────────────────┐
│ React UI components (Board, Hand, Shop, Modals)  │
├──────────────────────────────────────────────────┤
│ Run / Match state stores (Zustand)               │
├──────────────────────────────────────────────────┤
│ Game logic (pure TS modules)                     │
│   - chess engine wrapper (chess-integration)     │
│   - card system (cards, hand, energy)            │
│   - effect resolution (apply card effects)       │
│   - artifact triggers                            │
│   - boss curse layer                             │
│   - shop / draft logic                           │
├──────────────────────────────────────────────────┤
│ AI worker (Stockfish.wasm) + curse-AI layer      │
├──────────────────────────────────────────────────┤
│ Persistence (localStorage adapter)               │
├──────────────────────────────────────────────────┤
│ Static data (cards.json, artifacts.json, bosses) │
└──────────────────────────────────────────────────┘
```

The **game logic layer must be pure TypeScript with no React dependencies.** This makes it testable in Vitest without DOM mocking and lets us pull it out into a worker if performance demands it.

The **state stores** are the only place game state lives at runtime. UI components subscribe to slices of state. Game-logic functions return new state objects (immutable updates).

## Suggested directory layout

```
src/
├── main.tsx                  # Vite entry point
├── App.tsx                   # Top-level router (mode select / run / match)
├── components/               # React UI
│   ├── Board/
│   ├── Hand/
│   ├── Shop/
│   ├── Reward/
│   ├── Placement/            # Skirmish placement screen
│   ├── ArtifactSidebar/
│   └── ...
├── stores/                   # Zustand stores
│   ├── runStore.ts           # Whole-run state (gold, deck, roster, artifacts, act/match index)
│   ├── matchStore.ts         # Active match state (board, hand, energy, turn, overlays)
│   └── metaStore.ts          # Cross-run state (unlocks, ascension, stats)
├── game/                     # Pure TS game logic
│   ├── chess/                # chess.js wrapper + rule-extension layer
│   ├── cards/                # Card system: effects, resolution, library loader
│   │   ├── data/             #   one JSON file per card (source of truth)
│   │   ├── decks/            #   deck compositions ({ id, count } lists)
│   │   ├── library.ts        #   loads + validates card JSON at startup
│   │   └── match.ts          #   match-scoped state + effect resolver
│   ├── artifacts/            # Artifact definitions, triggers
│   ├── pieces/               # Piece-related logic (Skirmish drafts, soft caps)
│   ├── shop/                 # Shop generation, reroll, removal
│   ├── bosses/               # Boss definitions, curse-card insertion logic
│   ├── overlays/             # Walls, square effects, zone-control
│   ├── progression/          # Run flow (acts, matches, rewards)
│   ├── ascension/            # Difficulty modifier definitions
│   └── types.ts              # Shared types (Card, Piece, Artifact, etc.)
├── ai/                       # AI worker code
│   ├── worker.ts             # Web Worker entry; hosts Stockfish
│   ├── stockfish.ts          # Stockfish.wasm wrapper
│   └── curseAI.ts            # Boss curse-insertion scheduling
├── data/                     # Static data (cards live under game/cards/data/)
│   ├── artifacts.json
│   └── bosses.ts             # Boss definitions are code (modifier rules) not just data
├── persistence/              # localStorage adapter
└── styles/                   # Global CSS
```

## Core types (sketch)

```ts
// game/types.ts (rough)

type Square = { file: 0..7; rank: 0..7 }; // a1 = (0,0), h8 = (7,7)
type PieceType = "pawn" | "knight" | "bishop" | "rook" | "queen" | "king";
type Side = "player" | "opponent";
type Piece = { id: string; type: PieceType; owner: Side; };

type Card = {
  id: string;
  name: string;
  cost: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
  rarity: "common" | "uncommon" | "rare";
  archetype: "tempo" | "spatial" | "movement" | "disruption" | "resource" | "defensive" | "burst";
  curse?: boolean;        // true for boss curse cards
  effect: CardEffect;     // resolved by the effect system
  description: string;
};

type Artifact = {
  id: string;
  name: string;
  rarity: "common" | "uncommon" | "rare";
  description: string;
  effect: ArtifactEffect; // hooks into trigger system
};

type Wall = { square: Square; destructible: boolean; expiresOn?: number /* turn */ };
type SquareEffect = { square: Square; effect: SquareEffectKind; expiresOn: number };

type Board = {
  // Pieces and positions are owned by chess.js wrapper, but referenced here.
  walls: Wall[];
  squareEffects: SquareEffect[];
  zoneBuffs: ZoneBuff[];
};

type RunState = {
  mode: "royal" | "skirmish";
  ascension: number;
  act: 1 | 2 | 3;
  matchInAct: 1 | 2 | 3;
  gold: number;
  deck: Card[];
  artifacts: Artifact[];
  roster?: Piece[];          // Skirmish only
  rngSeed: number;
};

type MatchState = {
  board: ChessBoardSnapshot; // chess.js position
  overlays: Board;           // walls / square effects / zone buffs
  hand: Card[];
  drawPile: Card[];
  consumedPile: Card[];      // every played card lands here for the rest of the match
  energy: number;            // banks across turns, capped at 10
  turn: number;
  whoseTurn: Side;
  bossModifier?: BossModifier;
  curseSchedule?: CurseSchedule;
  outcome?: "playerWins" | "opponentWins" | "draw";
};
```

These types are sketches. The actual code may evolve them; what matters is the shape:

- **Run state** is preserved across matches.
- **Match state** is fresh per match.
- **Meta state** is preserved across runs.

## Static content

Card definitions are JSON, one file per card, under `src/game/cards/data/`.
Decks (e.g. the starter deck) are JSON under `src/game/cards/decks/`, and
reference cards by id with a count. `src/game/cards/library.ts` loads every
card via `import.meta.glob`, validates each one at module load, and throws a
clear error if a card is malformed or a deck references an unknown id. To add
a card, drop a new JSON file in `data/` — no code changes are needed.

Artifacts and bosses will follow the same shape (`data/artifacts.json`,
boss-definition modules) once those systems are implemented.

## Update flow during a match

1. **It's the player's turn.** State: `MatchState.whoseTurn === "player"`. Energy reset to 3. Hand drawn to 5.
2. Player plays a card → resolve its effect against `MatchState`. Mutate immutably (return new state). Energy decrements. Card moves to discard or is consumed. UI re-renders.
3. Player makes a chess move → call into chess engine wrapper. Update `MatchState.board` and overlays. Check for win/loss/draw.
4. Player ends turn (explicit "End Turn" button after every play, or via making a move? — see UI design open question).
5. **Opponent's turn.** Curse layer fires any scheduled triggers (inserts curses). Stockfish AI is asked for a move on a virtualized board (with rule extensions applied). Move executes. Check for win/loss/draw.
6. Loop.

## State purity / determinism

The prototype is single-player with no multiplayer requirements (`overview.md`). We don't need full determinism. But:

- Game logic functions should be **pure** where reasonable. Side-effects only at the edges (UI render, AI worker message, localStorage write).
- The **RNG** for shop content / draft offers / draw shuffles should be **seeded** per-run for reproducibility during testing. Seed lives in `RunState.rngSeed`. (This also makes implementing seeded daily challenges trivial later.)

## Web Workers

Stockfish.wasm runs on a **dedicated worker** to avoid blocking the UI thread. Communication is via postMessage with a small typed protocol. See `ai.md`.

The curse-AI layer also lives in the worker (so the worker can simulate the player's hand-with-curses scenario for any look-ahead reasoning), or in the main thread — whichever is cleanest. Default: main thread.

## Testing strategy

- **Unit tests on game/** modules (Vitest). Cover card-effect resolution, wall placement, draw/shuffle, energy economy, artifact triggers.
- **Integration tests** that run a scripted match end-to-end: deal hand, play card, resolve, advance turn. Mock the AI to play deterministic moves.
- **No** UI / e2e testing in the prototype. (Add Playwright if the project graduates.)

## Performance guardrails

- Match state should be small (<10KB JSON). We can deep-clone freely.
- Avoid recomputing zone-control buffs every frame; compute once per turn.
- Memoize board overlays in render selectors.
- Stockfish at low depth (5–8) is fast (<1s per move). Higher depths are reserved for late-Ascension.
