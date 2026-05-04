# Modes

There is one active mode in the prototype: **Standard**. Two more — **Royal** and **Skirmish** — are spec'd but disabled in the menu while Standard is the focus. The mode is fixed for an entire run.

A fourth mode, **Sandbox** (a.k.a. Dev), sits parallel to the player-facing modes but is **not a player-facing mode**. It is a developer sandbox for setting up specific positions and exercising card interactions; it is selected from the same top-level menu but exposes editor / library / AI controls instead of a run progression. See the "Sandbox" section at the bottom of this doc for details.

## Standard (default)

The active default mode. Both sides start each match with a small piece set on a small board and grow on a fixed, symmetric curve to a full 16-piece army on 8x8 across the 9-match run. There is no piece drafting in Standard. Starting positions are Chess960-style, generalized to whatever board / piece set the current match uses. Boards span seven distinct sizes (4×6 → 8×8); each match grows by at most one file or one rank.

Per-match piece curve:

| Match | Board | Per-side composition | Total | Move target |
|---|---|---|---|---|
| 1 | 4×6 | K + 4 pawns + 2 random minors *or* 1 random rook | 6–7 | ~8 |
| 2 | 4×6 | K + 4 pawns + random pieces (budget 9 pts, pool {N,B,R}) | 6–7 | ~11 |
| 3 (Boss A) | 5×6 | K + 5 pawns + N + B + R | 9 | ~14 |
| 4 | 5×7 | K + 5 pawns + random pieces (budget 14 pts, pool {N,B,R}) | 8–10 | ~18 |
| 5 | 6×7 | K + 6 pawns + random pieces (budget 17 pts, pool {N,B,R}) | 10–12 | ~22 |
| 6 (Boss B) | 7×7 | K + 7 pawns + 2 N + 2 B + 2 R | 14 | ~28 |
| 7 | 7×8 | K + 7 pawns + random pieces (budget 22 pts, pool {N,B,R,Q}) | 11–14 | ~35 |
| 8 | 8×8 | K + 8 pawns + random pieces (budget 25 pts, pool {N,B,R,Q}) | 13–16 | ~42 |
| 9 (Boss C) | 8×8 | K + 8 pawns + 2 N + 2 B + 2 R + Q | 16 | ~50 |

The composition for non-boss matches is **rolled per match** from a non-pawn points budget plus a pool of allowed piece types (knight = 3, bishop = 3, rook = 5, queen = 9). Pieces are drawn until no allowed type both fits the remaining budget and is below its Chess960 cap (≤2 N, ≤2 B, ≤2 R, ≤1 Q). Pawns fill the front rank fully (`pawns = files`); the king is always present. Bosses keep hand-tuned explicit compositions because their hazards (`bosses.md`) are designed around them.

Numbers are tuning knobs (centralized in `src/game/progression/standard.ts`). The aim: an average player should checkmate match 1 in roughly 8 moves; match 9 should average ~50.

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

## Skirmish (post-prototype, currently disabled)

The roguelite-army experience. The player starts the run with a tiny army and grows their roster across the 9 matches by drafting pieces between matches. Disabled in the menu while Standard is the active default.

- **Starting roster (run start):** king + 2 pawns + 2 minor pieces (knight or bishop). Exact starter composition is a tuning knob; see `roadmap/open-questions.md`.
- **Opponent army:** the AI's army scales over the 9 matches. Early matches use a deliberately weakened army; the act-3 boss faces the player at full standard chess force or stronger. Exact scaling curve TBD; see `roadmap/open-questions.md`.
- **Roster management:** persistent across the run. Pieces do not reset between matches in Skirmish — the army you finish a match with (alive plus draft additions) is the army you bring to the next match.

  - Pieces lost during a match come back at full strength for the next match. (Death is not permanent within a run; a captured knight returns next match. Subject to playtest — we may want to introduce permanent loss as a difficulty modifier later.)

- **Post-match rewards:** card draft (1 of 3) + gold + **piece draft (1 of 3)**.
- **Piece draft:** see [`pieces.md`](pieces.md). Tiered rarity (pawns common, queens very rare). Soft caps per piece type encourage variety.
- **Placement:** **player-placed** before each match. The player chooses which squares within an allowed region (typically their own back two ranks) each piece occupies. Castling is still available when the king and a rook end up on standard squares and other castling conditions are met (see `chess-rules.md`).
- **Mental model:** "chess + army builder + spells".

### Why two modes

The dimensions are:

| Dimension                        | Royal                          | Skirmish                       |
|----------------------------------|--------------------------------|--------------------------------|
| Starting roster                  | Standard 16 (fixed)            | Small (5), grows by drafting   |
| Roster persistence between games | None (resets)                  | Persistent across run          |
| Piece drafts                     | No                             | Yes (1-of-3 each match)        |
| Placement                        | Standard chess setup           | Player chooses                 |
| AI army                          | Standard chess army            | Scales across run              |
| Variety source                   | Cards + artifacts only         | Cards + artifacts + roster     |
| Difficulty to balance            | Easier                         | Harder                         |

Royal is for players who want the cleanest "chess + spells" experience. Skirmish is for players who want the maximum roguelite power-curve dopamine — drafting a queen on Match 3 should feel like getting a Pandora's Box in Slay the Spire.

## What is identical between modes

- The match loop (energy, cards, hand size, draws).
- The card pool, draft, and shop.
- The board (always 8x8, no portals, card-spawned overlays — see `board.md`).
- The economy (gold, interest, reroll/removal pricing).
- The artifact pool.
- The 3-act, 9-match run structure with three hand-crafted bosses.
- Win conditions and chess rules (see `chess-rules.md`).
- Ascension difficulty modifiers.

The only differences are roster management and placement.

## Sandbox (developer-only)

Sandbox (a.k.a. Dev) is parallel to the player-facing modes at the menu level. It exists so we can scaffold and exercise card / status / chess interactions without first building the run loop. Sandbox is **not shipped to players** and has no run progression.

What sandbox mode provides:

- **Board editor.** Place / overwrite / erase pieces, toggle side-to-move, clear the board, restore the standard chess starting position. Statuses on a square are dropped when the piece on it is replaced.
- **Resizable board.** Independent file (3..8) and rank (3..8) pickers — any rectangle from 3x3 to 8x8. Resizing drops pieces that no longer fit on the new board. The toy AI replaces Stockfish whenever the board is not 8x8 (Stockfish is hardcoded to 8x8).
- **Live position validation.** After every change (piece placed / removed / moved, side-to-move toggle, size change), the editor flags rule violations: extra/missing kings, kings on adjacent squares, pawns on a back rank, the wrong side already in check. Offending pieces tint red, the board shows a red outline, and the panel lists the violations in plain English. Validation **flags but does not block** edits — odd positions are still allowed (a dev might be reproducing a bug).
- **Free card library.** Every card in the library is playable on demand. Library plays cost no energy and do not enter the spent pile, but their effects (statuses, traps, summons, draws, scry, revive prompts, generators, self-replicators, capture-grants-Soul) resolve through the same `playCard` path as a real play.
- **Optional AI.** AI on Black is off by default in sandbox. Toggle it on for an auto-replying opponent, or click "AI: play one move" for a one-shot reply. With the AI off, the human drives both colors.
- **Energy controls.** "+1 energy" button short-circuits the natural ramp.
- **Action-granular undo / redo.** Every action (move, edit, library play, side-to-move toggle, energy bump, resize) pushes a snapshot, so undo rewinds individual actions instead of whole turns. Exception: when the AI is on, mid-turn snapshots collapse so one undo rewinds the player's whole previous turn (move + AI reply). Undo / redo also stay enabled after checkmate / stalemate.

Cards are still only playable on the player's turn, and the chess engine still enforces standard rules. The editor flags invalid positions but does not block them — odd positions may produce odd `outcome()` / `inCheck()` results. Acceptable for a dev tool.
