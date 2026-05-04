# AI

The opponent AI has two responsibilities:

1. **Make legal chess moves** — strong tactical play. Handled by **Stockfish.wasm**.
2. **Schedule and inject curse cards** (boss matches only). Handled by a small **custom curse-AI layer**.

Stockfish is a black-box chess engine; it doesn't know about our cards, walls, or curses. The curse-AI layer is a deterministic scheduler that fires on triggers from the game state.

## Stockfish.wasm

### Setup

- Loaded from the `stockfish.js` npm package (which bundles both a WASM build, `stockfish.wasm.js` + `stockfish.wasm`, and an asm.js fallback). The WASM build is preferred when available. We picked this package over `stockfish.wasm` because it does **not** require `Cross-Origin-Embedder-Policy` / `Cross-Origin-Opener-Policy` headers — this keeps the static-host story simple for the prototype.
- The engine files live in `public/stockfish/` so Vite serves them as static assets.
- Runs in a **dedicated Web Worker** so it doesn't block the UI thread.
- Configured per-match with a target depth (or move time) reflecting the difficulty.

### Wrapper API

```ts
// ai/stockfish.ts (sketch)

class StockfishEngine {
  async ready(): Promise<void> { ... }
  async setPosition(fen: string): Promise<void> { ... }
  async getBestMove(opts: { depth?: number; movetimeMs?: number }): Promise<string /* uci */> { ... }
  destroy(): void { ... }
}
```

### Difficulty tuning

| Match type             | Stockfish setting (starting values)  |
|------------------------|--------------------------------------|
| Normal early           | Depth 4                              |
| Normal mid             | Depth 6                              |
| Normal late (act 3)    | Depth 8                              |
| Boss A                 | Depth 8                              |
| Boss B                 | Depth 10                             |
| Boss C (finale)        | Depth 12                             |
| Ascension scaling      | +1 depth at certain Ascension levels |

Depth values are starting points; tune from playtesting.

For the M2 free-play screen (no run / shop / cards yet), the user picks
between three depths via a Difficulty selector:

| Difficulty | Depth |
|------------|-------|
| Easy       | 2     |
| Normal     | 6     |
| Hard       | 10    |

### Handling our rule extensions

Stockfish only understands standard chess. When our cards have changed the rules (walls present, frozen pieces, etc.) we restrict Stockfish's search to our overlay-aware legal-move set, rather than virtualizing walls into the FEN.

**The pattern (`src/ai/stockfish.ts`):**

```
1. Engine: legalMoves()                       — fully overlay-aware (walls, freezes, etc.)
2. searchMoves = legal moves formatted as UCI
3. Stockfish: position fen <vanilla>; go depth N searchmoves <list>
4. Stockfish replies bestmove m
5. engine.move(m) re-validates as a defensive guard;
   on null (impossible in steady state), play a random legal move.
```

UCI's `searchmoves` filter restricts the root move set to our list, so Stockfish never picks a move that violates a wall or moves a frozen piece. It still searches deeply within that set.

- **Walls** are enforced via `searchmoves` — Stockfish never considers blocked moves at the root.
- **Player's extension moves** (e.g., "your knight may move diagonally this turn") only apply to the player; the AI is not affected.
- **Square effects** that the AI triggers by moving onto a square: Stockfish doesn't know about them. The AI just plays its move; the effect fires after.
- **Zone-control buffs that affect the AI:** for prototype, we **do not** make Stockfish "aware" of zone buffs — it plays optimal chess on the constrained move set and the player exploits the buffs.

This last point is important: **the AI plays optimal chess; the cards/buffs are a player advantage.** This is intentional for the prototype.

## Curse-AI layer

The boss decides when to insert curses based on **deterministic triggers**. There is no probabilistic "30% chance per turn" — that would make the game feel unfair. Each curse pool defines a **schedule**.

### Trigger types

```ts
type CurseTrigger =
  | { kind: "onTurn"; turn: number }                      // e.g., turn 1
  | { kind: "everyNTurns"; n: number; offset?: number }   // e.g., every 4 turns
  | { kind: "onPlayerCheck" }                             // when the player checks the boss
  | { kind: "onPlayerCapture"; pieceFilter?: PieceType }  // when the player captures
  | { kind: "onLowMaterial"; threshold: number };         // when the boss is losing badly

type Curse = {
  cardId: string;       // the curse card to insert
  trigger: CurseTrigger;
  oncePerMatch?: boolean;
  oncePerTurn?: boolean; // default true
};
```

### Scheduler

Each boss defines a list of `Curse` schedules. Each turn:

1. Iterate the schedules.
2. For each schedule, check if its trigger fired this turn.
3. If yes, and `oncePerTurn` is satisfied, insert the curse card into the player's hand.

Limit: **at most one curse may be inserted per turn**, regardless of how many triggers fire. This is enforced at the scheduler layer.

### Where the curse-AI runs

Two reasonable places:

- **In the worker** (alongside Stockfish): keeps all "AI logic" in one place; lets us simulate curse-aware look-ahead in future.
- **On the main thread**, alongside the rest of the game logic: simpler for the prototype.

Default: **main thread**. The curse-AI is a tiny scheduler with no AI heuristics; it doesn't need to live in a worker.

## Match flow with AI

```
PLAYER TURN
  → player plays cards / makes move
  → check for win/loss/draw
  → end-turn

CURSE-AI STEP (boss matches only)
  → evaluate triggers, possibly insert curse into player's hand for the player's NEXT turn

OPPONENT TURN
  → ChoseEngine.legalMoves() to get legal-under-our-rules moves
  → Stockfish: get top-N moves on vanilla FEN
  → pick first that's in our legal set
  → execute move
  → check for win/loss/draw
  → end-turn

Loop.
```

Curse insertion happens at end of the player's turn so that the curse appears in the player's hand for the next turn, not in the middle of their current turn.

## What the AI does not do

- It does not draw cards (it has no deck).
- It does not see the player's hand.
- It does not see the player's deck contents.
- It does not adapt long-term across the run (no learning).
- It does not bluff or "play dumb" — it plays the best Stockfish-suggested legal move.

## Future: AI difficulty modulation

Beyond depth, we may explore:

- **Skill level:** Stockfish has a `Skill Level` UCI option (0–20) that intentionally weakens play.
- **Move time vs depth:** time-bounded search caps unpredictability.
- **Temperature / random suboptimal selection:** for the lowest difficulty, occasionally pick a non-optimal move from the top-K.

These are tuning knobs we can reach for if depth alone produces too steep a curve. Don't pre-build them — add when needed.

## Testing

- Unit-test the Stockfish wrapper: position-setting, depth-bounded move retrieval.
- Unit-test the curse-AI scheduler: trigger evaluation, oncePerTurn enforcement, insertion.
- Integration-test a full boss match scripted move-for-move.
