# Architecture

This is a prototype web app. The architecture should be **simple, testable, and easy to evolve.** It is *not* designed for multiplayer, real-time scaling, or modding.

> **Document status (2026-05-04):** This describes the *target* architecture across M0–M11. Sections marked **(planned)** are not yet implemented. Today the codebase implements the chess engine, card system, dev sandbox, the M5 run / shop loop, M6 artifacts, and M7 zone-control buffs; the boss / persistence layers ship in M8 onward. See `docs/roadmap/milestones.md` for current status.

## Layers (top to bottom)

```
┌──────────────────────────────────────────────────┐
│ React UI components (Board, Hand, Shop, Modals)  │
├──────────────────────────────────────────────────┤
│ Run / Match state                                │
│   - today: useState in Match.tsx (M0–M4)         │
│   - planned: Zustand stores (M5+)                │
├──────────────────────────────────────────────────┤
│ Game logic (pure TS modules)                     │
│   - chess engine (chess-integration)             │
│   - card system (cards, hand, energy)            │
│   - effect resolution (apply card effects)       │
│   - artifact triggers      (planned, M6)         │
│   - boss curse layer       (planned, M8)         │
│   - shop / draft logic     (planned, M5)         │
├──────────────────────────────────────────────────┤
│ AI worker (Stockfish.wasm) + curse-AI (M8)       │
├──────────────────────────────────────────────────┤
│ Persistence (localStorage adapter, M9)           │
├──────────────────────────────────────────────────┤
│ Static data (cards JSON; artifacts/bosses M6–M8) │
└──────────────────────────────────────────────────┘
```

The **game logic layer must be pure TypeScript with no React dependencies.** This makes it testable in Vitest without DOM mocking and lets us pull it out into a worker if performance demands it.

**State management:** today match state lives in `src/components/Match.tsx` and its sibling hooks under `src/components/Match/`. Run state (added in M5) lives in `src/components/Run/Run.tsx` via `useState`. Both surfaces are small enough that local component state is fine; Zustand is queued for whenever cross-component sharing becomes painful (probably once persistence and artifacts land).

## Directory layout

What exists today:

```
src/
├── main.tsx                       # Vite entry point
├── App.tsx                        # Top-level router (menu / sandbox; M5 will add run flow)
├── components/                    # React UI
│   ├── Board/
│   │   ├── Board.tsx
│   │   ├── CapturedPieces.tsx
│   │   ├── PieceGlyph.tsx
│   │   └── material.ts
│   ├── Hand/
│   │   ├── Hand.tsx
│   │   ├── ScryModal.tsx
│   │   ├── ReviveModal.tsx
│   │   └── PileInspector.tsx
│   ├── Match.tsx                  # Match shell; composes the hooks below
│   └── Match/
│       ├── DevPanel.tsx           # Dev sandbox UI (editor, library, AI toggle)
│       ├── derivations.ts         # Pure overlay/badge derivations
│       ├── sideEffects.ts         # Pure helpers (resolveTrapForMove, formatters)
│       ├── useMatchEngine.ts      # Engine + selection + outcome
│       ├── useCardSystem.ts       # cardState + targeting + modals
│       ├── useAiTurn.ts           # Stockfish loop
│       ├── useUndoRedo.ts         # Snapshot stack
│       └── useDevEditor.ts        # Dev-only editor + chess-vision
├── game/                          # Pure TS game logic — no React
│   ├── chess/
│   │   ├── rules.ts               # Wall-aware move gen, check, FEN
│   │   └── engine.ts              # ChoseEngine (stateful wrapper over rules.ts)
│   ├── cards/
│   │   ├── data/                  # One JSON file per card (source of truth)
│   │   ├── library.ts             # Loads + validates card JSON at startup
│   │   └── match.ts               # Match-scoped card state + effect resolver
│   └── types.ts                   # Shared types (Card, Piece, statuses, MatchCardState, …)
└── ai/
    └── stockfish.ts               # Stockfish.wasm wrapper (Web Worker)
```

M5 added (live now):

```
src/
├── components/
│   └── Run/                          # Run shell + reward + shop + summary UIs
│       ├── Run.tsx
│       ├── Reward.tsx
│       ├── Shop.tsx
│       └── RunSummary.tsx
└── game/
    ├── progression/run.ts            # Run state machine, draft generation
    └── shop/shop.ts                  # Shop generation, reroll, removal, interest
```

What M6+ will add, in roughly milestone order:

```
src/
├── components/
│   ├── Placement/                 (planned, M10) Skirmish placement screen
│   └── ArtifactSidebar/           (planned, M6)
├── game/
│   ├── artifacts/                 (planned, M6)
│   │   ├── data/                    #   one JSON file per artifact
│   │   └── library.ts               #   loader + validation, sister to cards/library.ts
│   ├── overlays/                  (M7, live)     Zone-control buffs
│   ├── bosses/                    (planned, M8)  Boss definitions + curse insertion
│   ├── pieces/                    (planned, M10) Skirmish drafts, soft caps
│   └── ascension/                 (planned, post-M11) Difficulty modifier definitions
├── ai/
│   └── curseAI.ts                 (planned, M8)  Curse-card insertion scheduling
└── persistence/                   (planned, M9)  localStorage adapter
```

Empty folders are intentionally **not** created until their milestone starts — placeholder types live in `src/game/types.ts` so future PRs can compile-check against the intended shapes without dead code.

## Core types

The authoritative type definitions live in `src/game/types.ts`. The shape today:

```ts
// game/types.ts (current)

type FileIndex = 0|1|2|3|4|5|6|7;
type RankIndex = 0|1|2|3|4|5|6|7;
type Square = { file: FileIndex; rank: RankIndex };
type AlgebraicSquare = string;                          // "e4" — used at the engine boundary

type PieceType = "pawn" | "knight" | "bishop" | "rook" | "queen" | "king";
type Side = "player" | "opponent";
type Piece = { type: PieceType; side: Side };           // (no id today; M10 adds one for Skirmish)

type Card = {
  id: string;
  name: string;
  cost: 0..10;
  rarity: "common" | "uncommon" | "rare";
  archetype: "tempo" | "spatial" | "movement" | "disruption"
           | "resource" | "defensive" | "burst" | "sacrifice" | "summon" | "swap";
  curse?: boolean;
  description: string;
  target: CardTarget;                                   // what input the player picks
  effect: CardEffect;                                   // 25-way discriminated union
};

// Overlays (M3 stores; M4 enforces walls in the chess engine)
type Wall = { square: AlgebraicSquare; expiresOnTurn: number };
type PieceStatus = { square: AlgebraicSquare; side: Side; expiresOnTurn: number };
type EmpowerStatus = PieceStatus & { pattern: EmpowerPattern; singleUse?: boolean };
type LightningStatus = PieceStatus & { remaining: number };
type Sanctuary = { square: AlgebraicSquare; expiresOnTurn: number };
type Trap = { square: AlgebraicSquare; effect: "capture"|"freeze"|"push"; expiresOnTurn: number };

type MatchCardState = {
  hand: Card[]; drawPile: Card[]; consumedPile: Card[]; acquisitionLog: Card[];
  energy: number;
  turn: number;                                         // 1-indexed player turn
  walls: Wall[];
  freezes: PieceStatus[];                               // FrozenPiece alias
  roots: PieceStatus[]; disarms: PieceStatus[]; compels: PieceStatus[];
  shields: PieceStatus[]; hastes: PieceStatus[];
  lightnings: LightningStatus[];
  empowers: EmpowerStatus[];
  sanctuaries: Sanctuary[]; traps: Trap[];
};
```

Scaffolding types added for M5+ milestones (no implementations yet — see the type file for current sketches):

```ts
// (planned shapes — defined in game/types.ts as scaffolding; refined per milestone)

type RunState = { mode; ascension; act; matchInAct; gold; deck; artifacts; roster?; rngSeed; phase };  // M5
type Artifact = { id; name; rarity; description; triggers };                                            // M6
type Shop = { offers: ShopOffer[]; rerollCost; removalCost };                                           // M5
type BossModifier = { bossId; /* rule shape M8 */ };                                                    // M8
type CurseSchedule = { curses: Card[] };                                                                // M8
type ZoneBuff = { region; effect; side; expiresOnTurn?; sourceLabel };                                  // M7 (live)
```

The chess board itself lives in the `ChoseEngine` instance — it is *not* duplicated in `MatchCardState`. The split: **engine** = position + history; **`MatchCardState`** = everything else per-match (cards, energy, overlays).

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

1. **It's the player's turn.** `startPlayerTurn` ticks turn-bound overlays (statuses expire), refills hand to 5, banks +1 energy (capped at 10).
2. Player plays any number of cards → `playCard` resolves each effect against `MatchCardState`, returning a new state plus a list of `CardSideEffect`s that the React layer applies to the engine (place/remove/swap pieces, foreign moves, etc.). The played card moves to `consumedPile` for the rest of the match.
3. Player makes a chess move → `engine.move(...)`. The trap resolver (`resolveTrapForMove`) walks the move path and fires the first trap hit (capture / freeze / push). Outcome is checked.
4. **Move ends the turn.** Cards must be played BEFORE moving. (No explicit End-Turn button; the chess move is the turn boundary.)
5. **Opponent's turn.** `useAiTurn` asks Stockfish for a move on the legal-move set (UCI `searchmoves` filter). Move executes through the same engine path. Curse layer (planned, M8) fires any scheduled triggers before the AI is asked.
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
