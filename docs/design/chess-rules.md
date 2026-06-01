# Chess Rules

Chess Hacker uses **standard chess** as its rule baseline. Where this doc says "standard", we mean the FIDE laws of chess as commonly implemented (the rule layer in `src/game/chess/rules.ts` enforces them). Cards, artifacts, and bosses can override these rules in specific ways; this doc covers the **defaults**, and `cards.md` / `artifacts.md` / `bosses.md` cover the override mechanisms.

## Win, loss, draw

- **Checkmate** — the side checkmated loses the match. Player checkmating the AI = match win. AI checkmating the player = match loss.
- **Stalemate** — the side stalemated draws. **Draws count as a run loss.**
- **50-move rule** — fires; draw → run loss.
- **Threefold repetition** — fires; draw → run loss.
- **Insufficient material** — fires; draw → run loss.

The "draw = run loss" treatment is intentional: it pressures players to make decisive plays and prevents stall-strategies for cheap draws. Some players will find this harsh; this is mitigated by the cards giving players powerful tempo and tactical tools. Reconsider after playtesting if it feels unfair.

There is **no clock** and **no move-count cap** in the prototype. Players take as long as they like. (Adding a clock is a future option — see `roadmap/open-questions.md`.)

## Piece movement

Standard chess movement, no override unless specified by an active card / artifact / boss modifier:

- King — 1 square in any direction. Cannot move into check.
- Queen — sliding any number of squares in any of the 8 directions, blocked by pieces.
- Rook — sliding orthogonally.
- Bishop — sliding diagonally.
- Knight — L-shape (2+1), can jump over pieces.
- Pawn — 1 square forward (2 from starting rank), captures diagonally.

## Special moves (all enabled)

### Castling

Standard chess castling rules apply on 8x8 boards:

- King and rook have not moved.
- No pieces between them.
- King is not in check.
- King does not pass through or end on a square attacked by an enemy piece.

**Castling is disabled on boards smaller than 8 files.** Standard mode runs three square boards across the run (6×6 in Act 1, 7×7 in Act 2, 8×8 in Act 3) — castling is only available in Act 3, when the board reaches 8 files. The engine's move generator skips the castling branch when `size.files < 8`. The "king to g-file / rook to f-file" landing-square rule from Chess960 doesn't generalize cleanly to a smaller board, and small-board piece sets often don't have two rooks anyway.

In **Royal**, castling is straightforward (pieces start on standard squares). When Royal is re-enabled with Chess960 starts, the back-rank generator places the king between the rooks specifically so castling rights are unambiguous.

In **Skirmish**, castling is possible only when the player happens to place their king on its standard square (e1) AND a rook on a standard square (a1 or h1).

### En passant

Enabled. Standard rules: when an enemy pawn advances two squares from its starting rank and lands beside one of your pawns, your pawn may, on the very next move only, capture the enemy pawn diagonally as if it had advanced only one square. Available on any board size where a double-push is possible.

Pawn double-pushes are available on every board size — a pawn on its starting rank may advance one or two squares whenever both squares are empty (and not walled).

Note (see `board.md`): if the en passant capture target square is walled, en passant cannot be performed.

### Pawn promotion

Enabled. A pawn reaching the **far** rank promotes. The far rank is `ranks - 1` for white and `0` for black, scaling with the current board: rank 5 / rank 0 on a 6-rank board, rank 7 / rank 0 on 8×8. The player chooses any piece type **other than king** (typically queen, rook, bishop, or knight).

In **Standard / Royal**, promotion is unlimited.

In **Skirmish**, promotion is allowed and the promoted piece exists for the rest of the match only. Promotion does **not** add to the persistent roster.

## Capture-grants-Energy (card-system extension)

When the **player** captures an enemy piece during their chess move, energy equal to the captured piece's **standard chess piece value** is immediately added to the player's energy pool:

- pawn → +1 energy
- knight → +3 energy
- bishop → +3 energy
- rook → +5 energy
- queen → +9 energy
- king → (never reachable; the game ends on checkmate)

Energy is capped at 20; excess is lost. This is an addition to standard rules — the chess movement and legality are unchanged, but the energy system rewards aggressive piece capture. The opposite direction (AI capturing one of the player's pieces) does **not** grant energy: energy from captures flows *to* the player only.

See [`cards.md`](cards.md) for the energy system details.

## Check

A king in check must be the next move's resolution — that move must remove the check. Standard rules.

When evaluating "is this square attacked?" for check / castling purposes, **walls** count as friendly blockers (they block sliding pieces' lines of attack). Square effects do not interact with check evaluation. Zone-control buffs do not interact with check evaluation.

## What cards / artifacts / bosses CAN override

Subject to specific card / artifact / boss text:

- A piece's move set (e.g., "your knights may also move 1 square diagonally").
- The board (walls, square effects, zone buffs).
- Resources (energy, hand size, gold).
- Triggers ("when you check, draw a card").
- Promotion rules (e.g., "pawns promote on rank 6").
- Match-end conditions in specific niche cases (e.g., a card might say "if you would lose to checkmate this turn, instead skip the opponent's next move" — rare, deliberately). The prototype keeps the draw=loss rule itself intact; **counterplay against forced dead-ends is delivered through cards rather than a match-end override** — Kernel Panic grants an extra chess move to change the position before it resolves, and Watchdog Timer shields all your pieces for an opponent turn (see [`../cards/burst.md`](../cards/burst.md), [`../cards/defensive.md`](../cards/defensive.md)).

## What cards / artifacts / bosses CAN'T override (without explicit text)

- The number of pieces a side has at match start (this is set by mode rules).
- The 8x8 board geometry.
- The basic alternation of turns.
- The player's identity as the side that draws cards (the AI never draws).

## Edge case: when chess rules and card rules conflict

If a card's effect would create a board state inconsistent with standard chess (e.g., multiple kings, kings in check that can't be escaped), the card's effect is the **canonical state** and the chess rule layer (`src/game/chess/rules.ts`) accommodates it. See `technical/chess-integration.md` for how the engine threads card-spawned overlays through move generation and check evaluation.

If a card would let the player make a move that puts their own king in check (illegal in standard chess), the card is interpreted strictly: **unless the card explicitly says "you may put your own king in check"**, the move remains illegal. We err toward standard chess conservatism.

## Summary

| Rule                       | Status in prototype                 |
|----------------------------|-------------------------------------|
| Standard piece movement    | Enabled, can be extended by cards   |
| Castling                   | Enabled                             |
| En passant                 | Enabled                             |
| Pawn promotion             | Enabled                             |
| Check / checkmate          | Enabled                             |
| Stalemate                  | Enabled (= draw = run loss)         |
| 50-move rule               | Enabled (= draw = run loss)         |
| Threefold repetition       | Enabled (= draw = run loss)         |
| Insufficient material draw | Enabled (= draw = run loss)         |
| Clock / time control       | None                                |
| Move-count cap             | None                                |
| Walls block movement       | Yes                                 |
| Walls block check rays     | Yes (count as friendly blockers)    |
