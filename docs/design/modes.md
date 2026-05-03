# Modes

The player picks one of two modes at the start of each run — **Royal** or **Skirmish**. The mode is fixed for the entire run.

A third mode, **Dev**, sits parallel to Royal and Skirmish but is **not a player-facing mode**. It is a developer sandbox for setting up specific positions and exercising card interactions while the official modes are being built; it is selected from the same top-level menu but exposes editor / library / AI controls instead of a run progression. See the "Dev" section at the bottom of this doc for details.

## Royal

The classic experience. Both sides start every match with the standard chess army (8 pawns, 2 rooks, 2 knights, 2 bishops, 1 queen, 1 king) on the standard chess starting setup. The player and the AI play vanilla chess except for the cards the player plays.

- **Starting position:** standard chess setup, both sides.
- **Roster management:** none. The player has no piece roster between matches; both armies always reset to the standard 16 each match.
- **Post-match rewards:** card draft + gold (no piece draft).
- **Shop:** identical to Skirmish — single cards, booster packs, artifacts (when offered), reroll, removal.
- **Placement:** standard chess starting position (not configurable).
- **Mental model:** "chess + spells".

Royal is the **easier mode to balance and the simpler onboarding experience.** New players should default to Royal. Royal also produces a more consistent per-match experience because piece composition does not vary.

## Skirmish

The roguelite-army experience. The player starts the run with a tiny army and grows their roster across the 9 matches by drafting pieces between matches.

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

## Dev (developer-only)

Dev is a sandbox parallel to Royal and Skirmish at the menu level. It exists so we can scaffold and exercise card / status / chess interactions without first building the run loop. Dev is **not shipped to players** and has no run progression.

What dev mode provides:

- **Board editor.** Place / overwrite / erase pieces, toggle side-to-move, clear the board, restore the standard chess starting position. Statuses on a square are dropped when the piece on it is replaced.
- **Free card library.** Every card in the library is playable on demand. Library plays cost no energy and do not enter the spent pile, but their effects (statuses, traps, summons, draws, scry, revive prompts, generators, self-replicators, capture-grants-Soul) resolve through the same `playCard` path as a real play.
- **Optional AI.** Stockfish on Black is off by default. Toggle it on for an auto-replying opponent, or click "AI: play one move" for a one-shot reply. With the AI off, the human drives both colors.
- **Energy controls.** "+1 energy" and "Refill (10)" buttons short-circuit the natural ramp.
- **Action-granular undo / redo.** Every dev action (move, edit, library play, side-to-move toggle, energy bump) pushes a snapshot, so undo rewinds individual actions instead of whole turns.

Cards are still only playable on the player's turn, and the chess engine still enforces standard rules — the editor doesn't validate king-uniqueness or other position legality, and odd positions may produce odd `outcome()` / `inCheck()` results. Acceptable for a dev tool.
