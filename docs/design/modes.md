# Modes

The player picks one of two modes at the start of each run. The mode is fixed for the entire run.

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
