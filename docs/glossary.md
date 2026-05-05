# Glossary

Terms used across the choss design and technical docs.

| Term                | Meaning                                                                                  |
|---------------------|------------------------------------------------------------------------------------------|
| **Act**             | A third of a run (3 matches). The run has 3 acts; each ends with a boss.                |
| **Artifact**        | A persistent run-level effect occupying one of 5 slots; sourced from shop and bosses.   |
| **Ascension**       | Difficulty level above 0; each level adds a fixed stacking modifier. Per-mode track.    |
| **Booster pack**    | Shop item: open and pick 1+ cards from its randomized contents. Balatro-style.          |
| **Boss**            | A hand-crafted match at the end of each act. 3 bosses per run (one per act).            |
| **Card**            | An effect played from hand. Costs energy. By default a played card lands in the discard pile and cycles back into the draw pile when it empties; the Consume keyword removes it from the match instead. |
| **choss**           | Chess + Roguelite. Working name of the project.                                         |
| **Compel**          | Status keyword: enemy piece is forced to move on its next turn (must capture if able).  |
| **Curse card**      | A 0-cost detrimental card injected into the player's hand by a boss. Vanishes when played. |
| **Deck**            | The persistent card collection of a run. Grows by drafting / shopping; shrinks by removal. |
| **Disarm**          | Status keyword: enemy piece may move but may not capture on its next turn.              |
| **Draft**           | A 1-of-3 choice (cards or, in Skirmish, pieces) shown after each match.                 |
| **Empower**         | Buff keyword: own piece gains an additional movement pattern this turn.                 |
| **Energy**          | Resource for playing cards. +1 each turn (1 on turn 1), banks unspent up to 10.         |
| **Consume**         | Card-flow keyword: a played card with Consume is removed from the match (lands in the consumed pile) and is not eligible for revival. |
| **Discard pile**    | Where played cards without Consume land at the moment they're played, plus the end-of-turn hand wipe. Reshuffles into the draw pile when it empties mid-draw. |
| **Consumed pile**   | Where Consume-keyworded cards land when played. Cards here never re-enter the cycle. |
| **Retain**          | Card-flow keyword: a card with Retain stays in your hand at end-of-turn discards until played. Granted dynamically by Bookmark; no card has inherent Retain in the prototype. |
| **Revive**          | A card effect that returns a card from the discard pile to your hand (Restore Point, Restore from Backup). Cannot reach into the consumed pile. |
| **Rooted**          | Status keyword: enemy piece cannot move on its next turn except to capture (alias for Root). Also used by Extract as a target filter. |
| **Patch card**       | One of five (Pawn / Knight / Bishop / Rook / Queen) Empower cards granted to your draw pile when you capture the matching enemy piece. All Patches have Consume. |
| **Bookmark**           | Resource card: applies Retain to a chosen card in hand for the rest of the match. |
| **FIDE**            | The international chess federation; "FIDE rules" = the standard chess rules baseline.   |
| **Freeze**          | Status keyword: enemy piece cannot move or capture on its next turn.                    |
| **Haste**           | Buff keyword: own piece may move a second time this turn but may not capture.           |
| **Heat**            | Synonym for Ascension level.                                                            |
| **Match**           | A single chess game inside a run. 9 matches per run.                                    |
| **Modifier**        | A persistent rule change for a match (used by bosses and Ascension).                    |
| **Move extension**  | A card-granted ability that adds new legal moves for a piece this turn.                 |
| **Overlay**         | Anything painted onto the board that isn't a piece — wall, square effect, zone buff.    |
| **Performance bonus** | Gold earned by a per-match feat (short game, no losses, etc.).                       |
| **Piece draft**     | Skirmish-only draft of a single new piece for the roster (1-of-3).                      |
| **Placement**       | Pre-match step where players position pieces. Standard FIDE in Royal; player-chosen in Skirmish. |
| **Root**            | Status keyword: enemy piece cannot move on its next turn except to capture.             |
| **Roster**          | Skirmish-only persistent army across the run.                                           |
| **BoardSize**       | `{ files, ranks }` describing the active board. Standard mode walks 4×6 → 8×8 across the run (seven distinct sizes); the dev sandbox supports any size from 3×3 to 8×8. |
| **Chess960**        | Randomized starting position (from the official 960). The Standard generator generalizes the rules (bishops on opposite colors, king between rooks) to any board / piece set. |
| **Royal**           | One of three run modes — both sides start with the standard 16-piece chess army on 8x8. Currently disabled in the menu (post-prototype). |
| **Standard**        | The default run mode — variable board (4×6 → 8×8) with a points-budget piece curve that grows from K + 4 pawns + ~2 minor pieces up to a full 16-piece army. |
| **Run**             | A single playthrough — 9 matches across 3 acts. Single elimination.                     |
| **Sanctuary**       | Square keyword: pieces standing on the square cannot be captured.                       |
| **Shield**          | Buff keyword: captures targeting the shielded piece are not legal moves.                |
| **Skip**            | Forfeit a draft for a gold bonus.                                                       |
| **Skirmish**        | One of three run modes — start with a small army, draft pieces between matches. Currently disabled (M10). |
| **Soft cap**        | A draft-time limit per piece type that suppresses further offers of that type.          |
| **Square effect**   | A card-painted effect on a single board square; triggers on enter / start-of-turn / etc. |
| **Stockfish**       | The open-source chess engine used for the 8x8 AI. Loaded as Stockfish.wasm.              |
| **Toy AI**          | Internal negamax-with-material-eval used in place of Stockfish on non-8x8 boards (Stockfish doesn't support them). Lives in `src/ai/toyAi.ts`. |
| **Trap**            | Square keyword: triggers a per-card effect (capture/freeze/push) when an enemy enters.   |
| **Wall**            | A card-painted impassable square. Blocks movement and attack rays.                       |
| **Zone-control buff** | A passive buff active while you "control" a region of the board.                       |
