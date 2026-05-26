# Modes

There is one active mode in the prototype: **Standard**. Two more — **Royal** and **Skirmish** — are spec'd but disabled in the menu while Standard is the focus. The mode is fixed for an entire run.

A fourth mode, **Sandbox** (a.k.a. Dev), sits parallel to the player-facing modes but is **not a player-facing mode**. It is a developer sandbox for setting up specific positions and exercising card interactions; it is selected from the same top-level menu but exposes editor / library / AI controls instead of a run progression. See the "Sandbox" section at the bottom of this doc for details.

## Standard (default)

The active default mode. Both sides start each match with a small piece set on a small board and grow on a fixed, symmetric curve to a full 16-piece army on 8x8 across the 9-match run. There is no piece drafting in Standard. Starting positions are Chess960-style, generalized to whatever board / piece set the current match uses. The run uses **three square boards, one per act**: Act 1 = 6×6, Act 2 = 7×7, Act 3 = 8×8. The board only grows **after** an act-end boss, so all three matches in an act share a size and the boss is played on the act's board.

Per-match piece curve:

| Match | Board | Per-side composition | Total | Move target |
|---|---|---|---|---|
| 1 | 6×6 | K + 6 pawns + random pieces (budget 9 pts, pool {N,B,R}) | 9–10 | ~12 |
| 2 | 6×6 | K + 6 pawns + random pieces (budget 13 pts, pool {N,B,R}) | 10 | ~15 |
| 3 (Boss A) | 6×6 | K + 6 pawns + N + B + R | 10 | ~16 |
| 4 | 7×7 | K + 7 pawns + random pieces (budget 13 pts, pool {N,B,R}) | 11 | ~20 |
| 5 | 7×7 | K + 7 pawns + random pieces (budget 18 pts, pool {N,B,R}) | 12–13 | ~24 |
| 6 (Boss B) | 7×7 | K + 7 pawns + 2 N + 2 B + 2 R | 14 | ~28 |
| 7 | 8×8 | K + 8 pawns + random pieces (budget 21 pts, pool {N,B,R,Q}) | 13–14 | ~36 |
| 8 | 8×8 | K + 8 pawns + random pieces (budget 24 pts, pool {N,B,R,Q}) | 14–15 | ~44 |
| 9 (Boss C) | 8×8 | K + 8 pawns + 2 N + 2 B + 2 R + Q | 16 | ~50 |

The composition for non-boss matches is **rolled per match** from a non-pawn points budget plus a pool of allowed piece types (knight = 3, bishop = 3, rook = 5, queen = 9). Pieces are drawn until no allowed type both fits the remaining budget and is below its Chess960 cap (≤2 N, ≤2 B, ≤2 R, ≤1 Q). Pawns fill the front rank fully (`pawns = files`); the king is always present. Bosses keep hand-tuned explicit compositions because their hazards (`bosses.md`) are designed around them.

Numbers are tuning knobs (centralized in `src/game/progression/standard.ts`). The aim: an average player should checkmate match 1 in roughly 12 moves; match 9 should average ~50.

### Generalized Chess960

For each match, the back-rank piece set (everything except pawns) is shuffled onto white's back rank with constraints:

1. If two bishops are present, place them on opposite-color squares.
2. If two rooks are present, place the king between them.
3. Place remaining pieces freely in leftover squares.
4. Mirror white's back rank to black.
5. Pawns fill rank 1 (white) and rank `ranks - 2` (black).

Castling is **disabled on boards smaller than 8 files** — it's awkward to generalize the king-to-g-file landing rule on smaller boards, and small-board piece sets often don't have two rooks anyway. See `chess-rules.md`.

- **Starting position:** Chess960-style every match (per the table above).
- **Roster management:** none. Both armies reset per match per the curve.
- **Post-match rewards:** card draft + gold (no piece draft).
- **Shop:** identical to other modes.
- **Mental model:** "chess + spells, with a steady ramp into a full board."

## Royal (post-prototype, currently disabled)

The classic experience. Both sides start every match with the standard chess army (8 pawns, 2 rooks, 2 knights, 2 bishops, 1 queen, 1 king) on 8x8.

When Royal is re-enabled post-prototype, it will default to **Chess960** starting positions (using the same generalized generator Standard uses, just on the full piece set), with a "standard start" opt-in for players who want vanilla chess openings. Disabled in the menu while Standard is the active default.

- **Starting position (planned):** Chess960 default; standard chess setup as opt-in.
- **Roster management:** none. The player has no piece roster between matches; both armies always reset to the standard 16 each match.
- **Post-match rewards:** card draft + gold (no piece draft).
- **Shop:** identical to other modes.
- **Mental model:** "chess + spells, full armies."

## Skirmish (M10 — active)

The roguelite-army experience. The player starts the run with a tiny army and grows their roster across the 9 matches by drafting pieces between matches. Selectable from the mode menu alongside Standard.

- **Starting roster (run start):** king + 3 pawns + 1 knight + 1 bishop. The roster grows via piece drafts between matches.
- **Opponent army:** mirrors the player's placed composition each match (same piece types, independent Chess960 layout). Boss matches use their canonical hand-crafted armies instead.
- **Roster management:** persistent across the run. No roster size cap — the player collects pieces freely. A per-match placement value cap (scaling from 10 on M1 to 42 on M9) determines how many pieces can be placed each match.
- **Post-match rewards:** gold + **piece draft (1 of 3)**. Cards remain shop-only (no card draft in reward).
- **Piece draft:** after every match win, pick 1-of-3 pieces (P, N, B, R, or Q). Rarity-weighted (pawns common, queens rare). Hard cap of 8 pawns; no other per-type caps. Skip for gold available.
- **Board size:** variable per act (6×6, 7×7, 8×8), same as Standard.
- **Placement:** player-placed before each match. Back-rank pieces (K/N/B/R/Q) go on rank 1 following Chess960 rules (bishops on opposite colors, king between rooks). Pawns go on rank 2 (free arrangement, player chooses layout). Both consume from the placement value cap.
- **Mental model:** "chess + army builder + spells".

### Placement value cap

Piece values: P=1, N=3, B=3, R=5, Q=9, K=0 (king is free). The per-match cap scales:

| Match | Board | Cap |
|-------|-------|-----|
| 1 | 6×6 | 8 |
| 2 | 6×6 | 12 |
| 3 | 6×6 | 16 |
| 4 | 7×7 | 20 |
| 5 | 7×7 | 24 |
| 6 | 7×7 | 28 |
| 7 | 8×8 | 32 |
| 8 | 8×8 | 36 |
| 9 | 8×8 | 40 |

The cap creates a natural progression: early matches are space-limited (few pieces on a small board), mid-game the value cap starts constraining, and late-game forces meaningful tradeoffs between power and coverage.

### Why three modes (two active)

| Dimension                        | Standard                       | Royal (disabled)               | Skirmish                       |
|----------------------------------|--------------------------------|--------------------------------|--------------------------------|
| Starting roster                  | Per-match curve (auto)         | Standard 16 (fixed)            | Small (6), grows by drafting   |
| Roster persistence between games | None (resets per match)        | None (resets)                  | Persistent across run          |
| Piece drafts                     | No                             | No                             | Yes (1-of-3 each match)        |
| Placement                        | Chess960 (auto)                | Standard chess setup           | Player chooses (Chess960 rules)|
| AI army                          | Same as player (per curve)     | Standard chess army            | Mirrors player's placement     |
| Variety source                   | Cards + artifacts only         | Cards + artifacts only         | Cards + artifacts + roster     |

Standard is the streamlined "chess + spells with a ramp." Skirmish is the maximum roguelite power-curve experience — drafting a queen early should feel like getting a Pandora's Box in Slay the Spire.

## What is identical between modes

- The match loop (energy, cards, hand size, draws).
- The card pool and shop.
- The board sizes (6×6, 7×7, 8×8 per act).
- The economy (gold, interest, reroll/removal pricing).
- The artifact pool.
- The 3-act, 9-match run structure with three hand-crafted bosses.
- Win conditions and chess rules (see `chess-rules.md`).
- Ascension difficulty modifiers.

The differences are roster management, placement, and AI army sourcing.

## Sandbox (developer-only)

Sandbox (a.k.a. Dev) is parallel to the player-facing modes at the menu level. It exists so we can scaffold and exercise card / status / chess interactions without first building the run loop. Sandbox is **not shipped to players** and has no run progression.

What sandbox mode provides:

- **Board editor.** Place / overwrite / erase pieces, toggle side-to-move, clear the board, restore the standard chess starting position. Statuses on a square are dropped when the piece on it is replaced.
- **Resizable board.** Independent file (3..8) and rank (3..8) pickers — any rectangle from 3x3 to 8x8. Resizing drops pieces that no longer fit on the new board. The toy AI replaces Stockfish whenever the board is not 8x8 (Stockfish is hardcoded to 8x8).
- **Live position validation.** After every change (piece placed / removed / moved, side-to-move toggle, size change), the editor flags rule violations: extra/missing kings, kings on adjacent squares, pawns on a back rank, the wrong side already in check. Offending pieces tint red, the board shows a red outline, and the panel lists the violations in plain English. Validation **flags but does not block** edits — odd positions are still allowed (a dev might be reproducing a bug).
- **Free card library.** Every card in the library is playable on demand. Library plays cost no energy and do not enter the spent pile, but their effects (statuses, traps, summons, draws, scry, revive prompts, generators, self-replicators, capture-grants-energy) resolve through the same `playCard` path as a real play.
- **Optional AI.** AI on Black is off by default in sandbox. Toggle it on for an auto-replying opponent, or click "AI: play one move" for a one-shot reply. With the AI off, the human drives both colors.
- **Energy controls.** "+1 energy" button short-circuits the natural ramp.
- **Action-granular undo / redo.** Every action (move, edit, library play, side-to-move toggle, energy bump, resize) pushes a snapshot, so undo rewinds individual actions instead of whole turns. Exception: when the AI is on, mid-turn snapshots collapse so one undo rewinds the player's whole previous turn (move + AI reply). Undo / redo also stay enabled after checkmate / stalemate.

Cards are still only playable on the player's turn, and the chess engine still enforces standard rules. The editor flags invalid positions but does not block them — odd positions may produce odd `outcome()` / `inCheck()` results. Acceptable for a dev tool.
