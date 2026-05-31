# AI

The opponent AI has two responsibilities:

1. **Make legal chess moves.** Every board size — 6×6, 7×7, and 8×8 — uses **Fairy-Stockfish.wasm** via a single wrapper at `src/ai/stockfish.ts`. Fairy-Stockfish is a Stockfish fork with native chess-variant support, including custom board dimensions defined in a `variants.ini`.
2. **Schedule and inject curse cards** (boss matches only). Handled by a small **custom curse-AI layer**.

Fairy-Stockfish is a black-box chess engine; it knows about board geometry (via the variant config) but not about our cards, walls, or curses. The curse-AI layer is a deterministic scheduler that fires on triggers from the game state.

## Fairy-Stockfish.wasm

### Setup

- Loaded from the `fairy-stockfish-nnue.wasm` npm package (1.7 MB unpacked, GPL-3.0). It ships a `Stockfish()` factory plus a pthread worker template and a wasm binary; we add a small UCI proxy worker (`public/fairy-stockfish/uci.worker.js`) that loads the engine inside a dedicated Web Worker and pipes UCI lines both ways.
- All engine files live in `public/fairy-stockfish/`:
  - `stockfish.js` — engine factory
  - `stockfish.wasm` — wasm binary
  - `stockfish.worker.js` — pthread worker template (loaded by the engine internally)
  - `uci.worker.js` — Chess Hacker-side UCI proxy
  - `variants.ini` — custom variant declarations (one per non-8×8 size used by Standard mode)
- **Cross-origin isolation is required.** Fairy-Stockfish.wasm uses pthreads + SharedArrayBuffer, so the document must be served with `Cross-Origin-Embedder-Policy: require-corp` and `Cross-Origin-Opener-Policy: same-origin`. `vite.config.ts` adds these headers via middleware for both the dev server and the preview server. Production deployments must configure the same headers at the host level.

### Custom variants

`public/fairy-stockfish/variants.ini` declares one variant per non-8×8 size we use, each inheriting from the built-in `chess`:

```ini
[chess-hacker6x6:chess]
maxFile = 6
maxRank = 6
```

The wrapper sends `setoption name VariantPath value /fairy-stockfish/variants.ini` during init so the engine loads the file. Match then calls `setVariant(variantFor(boardSize))` before each match — the helper maps `BoardSize` to either `"chess"` (for 8×8) or `"chess-hackerNxM"`. Castling is automatically inert on these boards because our FEN never sets `KQkq` for non-8-file positions (`castlingAvailable` in `src/game/chess/rules.ts`).

We always feed positions via `position fen <our serializeFen>` after `setVariant`, so the per-variant `startFen` is unused.

### Wrapper API

```ts
// ai/stockfish.ts (sketch)

class StockfishEngine {
  async ready(): Promise<void> { ... }
  setVariant(name: string): void { ... }
  setPosition(fen: string): void { ... }
  async getBestMove(opts: {
    depth?: number;
    movetimeMs?: number;
    searchMoves?: ReadonlyArray<string>;
  }): Promise<string /* uci */> { ... }
  destroy(): void { ... }
}

function variantFor(size: BoardSize): string;
```

### Difficulty tuning

Difficulty scales across a run via an **`AiStrength` profile**, not a bare
depth. Depth alone is a lumpy, board-coupled lever (a given depth sees
relatively further on the smaller early boards), and it only makes the engine
*shallower*, never *beatably weak* — it still never hangs a piece to a short
tactic. So the early game leans on Fairy-Stockfish's **`Skill Level`** (0–20),
which injects deliberate, human-like suboptimal move selection, and the late
game leans on **depth**. `UCI_LimitStrength` + `UCI_Elo` are also wired in the
wrapper (`setStrength`) as an alternative cap, though the run schedule uses
Skill Level.

The per-match schedule lives in `src/game/progression/aiStrength.ts`
(`aiStrengthForMatch(matchNumber)`) and is shared by Standard and
Skirmish (both run 9 matches with bosses at 3/6/9):

| Match            | Skill Level | Depth |
|------------------|-------------|-------|
| 1                | 3           | 6     |
| 2                | 6           | 6     |
| 3 — Boss A       | 12          | 8     |
| 4                | 9           | 7     |
| 5                | 13          | 7     |
| 6 — Boss B       | 16          | 10    |
| 7                | 16          | 8     |
| 8                | 18          | 9     |
| 9 — Boss C       | 20          | 12    |

Each new act resets the non-boss baseline below the prior boss, then climbs;
bosses spike above their neighbours (the engine plays "for real" on top of the
boss's modifier/hazard/status layers). Numbers are first-pass; tune from
playtesting.

**Why non-boss matches don't get abilities.** The escalation between bosses
comes from engine strength (this schedule) plus the composition/board-size
curve in `standard.ts` — *not* from giving normal enemies status effects or
rule-modifiers. Active/passive ability kits and match-modifiers stay
boss-exclusive so "boss = special rules" remains the boss identity. (Whether
*later* normal matches should get light, telegraphed board *terrain* — terrain
only, no abilities — is still open; see `roadmap/open-questions.md`.)

For the M2 free-play screen (no run / shop / cards yet), the user instead picks
between three depths via a Difficulty selector, which maps to a depth-only
`AiStrength` (`strengthForDifficulty`). The per-run schedule overrides this
selector and hides it in run mode.

| Difficulty | Depth |
|------------|-------|
| Easy       | 2     |
| Normal     | 6     |
| Hard       | 10    |

### Handling our rule extensions

Fairy-Stockfish knows board geometry from the variant config but doesn't understand our overlays (walls, freezes, sanctuaries, etc.). When cards change the rules we restrict the engine's search to our overlay-aware legal-move set rather than virtualizing overlays into the FEN.

**The pattern (`src/ai/stockfish.ts`):**

```
1. Engine: legalMoves()                       — fully overlay-aware (walls, freezes, etc.)
2. searchMoves = legal moves formatted as UCI
3. setVariant(variantFor(size)); position fen <our fen>; go depth N searchmoves <list>
4. Engine replies bestmove m
5. engine.move(m) re-validates as a defensive guard;
   on null (impossible in steady state), play a random legal move.
```

UCI's `searchmoves` filter restricts the root move set to our list, so the engine never picks a move that violates a wall or moves a frozen piece. It still searches deeply within that set.

- **Walls** are enforced via `searchmoves` — the engine never considers blocked moves at the root.
- **Player's extension moves** (e.g., "your knight may move diagonally this turn") only apply to the player; the AI is not affected.
- **Square effects** that the AI triggers by moving onto a square: the engine doesn't know about them. The AI just plays its move; the effect fires after.
- **Zone-control buffs that affect the AI:** for prototype, we **do not** make the engine "aware" of zone buffs — it plays optimal chess on the constrained move set and the player exploits the buffs.

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

- **In the worker** (alongside Fairy-Stockfish): keeps all "AI logic" in one place; lets us simulate curse-aware look-ahead in future.
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
  → Fairy-Stockfish: position fen <our fen>; go depth N searchmoves <list>
  → execute the returned move (or, defensively, fall back to the first legal move)
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
- It does not bluff or "play dumb" — it plays the best engine-suggested legal move.

## Future: AI difficulty modulation

`Skill Level` is now part of the per-match schedule (see Difficulty tuning).
Knobs we may still explore:

- **Move time vs depth:** time-bounded search caps unpredictability. `AiStrength` already supports `movetimeMs` as an alternative to `depth`; the schedule doesn't use it yet.
- **Temperature / random suboptimal selection:** for the lowest difficulty, occasionally pick a non-optimal move from the top-K (beyond what Skill Level already does).

Reach for these only if the Skill-Level + depth schedule produces too steep or too flat a curve in playtesting.

## Testing

- Unit-test the wrapper: init handshake, variant selection, position-setting, depth-bounded move retrieval.
- Unit-test the curse-AI scheduler: trigger evaluation, oncePerTurn enforcement, insertion.
- Integration-test a full boss match scripted move-for-move.

The Match dev panel exposes a **Skip match (auto-win)** button when `runMode === "run"`. It synthesizes a player checkmate via `onMatchEnd` so the run advances to Reward + Shop and onto the next match — useful for spot-checking the AI on every board size in one run without grinding through nine real matches.
