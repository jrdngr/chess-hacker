# Card Keywords

Every named effect a card can apply. Cards reference these keywords by name in their effect text; the rules live here.

Grouped by where the effect lives: on a piece (debuff or buff), on a square, or on a card.

## Piece debuffs

Applied to an enemy piece. The status sits on the piece for the stated duration; on expiry, the piece reverts to normal behavior.

### Freeze

A frozen piece **cannot move and cannot capture** on its next turn. It still occupies its square and still threatens the squares it would normally threaten (i.e., other pieces still treat it as defending those squares for check evaluation), but it cannot itself act.

- **Duration:** opponent's next turn.
- **Edge cases:** if the frozen piece is the only piece that can block a check, the opponent is in trouble — that's the point. Freezing a king is allowed; the king simply cannot move on its next turn.

### Root

A rooted piece **cannot move except to capture an immediately adjacent piece**. The capture target must be one square away in any direction (king-step distance); long-range captures (a sliding piece capturing across the board, a knight L-shape) are not legal under Root.

- **Duration:** opponent's next turn.
- **Contrast with Freeze:** Freeze stops captures; Root permits them but only at melee range.
- **Contrast with Disarm:** Disarm forbids captures and permits non-capturing moves; Root is the inverse, and further restricts the captures it permits to adjacent ones.

### Disarm

A disarmed piece **may move but may not capture**. Any move it makes must end on an empty square.

- **Duration:** opponent's next turn.
- **Edge cases:** a disarmed piece still threatens squares for check purposes — it just cannot resolve those threats this turn.

### Compel

A compelled piece **must move on its next turn**. If any capture is legal for it, it must make one of the capturing moves; otherwise it must make any legal move it has.

- **Duration:** opponent's next turn.
- **Edge cases:** if the compelled piece has no legal moves at all (fully blocked, or moving would put own king in check), Compel does nothing — the constraint is on top of legality, not a replacement for it.

## Piece buffs

Applied to one of your own pieces.

### Shield

While a piece is shielded, **captures targeting it are not legal moves**. The opponent's move generation excludes any move that would capture this piece. The attacker is *not* destroyed; the move simply isn't available.

- **Duration:** until the start of your next turn (covers the opponent's next turn).
- **Edge cases:** if every capture-out-of-check option targets a shielded piece, that branch is closed — the opponent must escape check another way. If no escape exists, that's checkmate against them.

### Haste

A hasted piece **may move a second time on the same turn, but may not capture** (on either move). The two moves must be otherwise legal in the chess sense (no moving into check, etc.).

- **Duration:** the current turn only.
- **Edge cases:** the second move counts as a normal move for any rules that count moves (e.g., en passant only off the immediately preceding move).

### Empower

An empowered piece **gains an additional movement pattern**, defined per card (e.g., "knight L-shape", "diagonal slide", "pawn forward step + diagonal capture"). The piece keeps its normal moveset *and* the granted pattern; it picks one to use. Patterns stack — multiple Empower effects on the same piece coexist.

- **Duration:** card-specified. The **Patch** family (Pawn / Knight / Bishop / Rook / Queen Patch) is **single-use this turn**: the status lasts the current turn AND drops immediately if the player moves a different piece first. Either way, the status drops if the empowered piece is captured or sacrificed.
- **Patterns currently in the prototype:**
  - **knight** — knight L-shape (ignores blockers).
  - **bishop** — diagonal slide (blocked normally).
  - **rook** — straight slide along files and ranks (blocked normally).
  - **queen** — both straight and diagonal slides (= bishop + rook).
  - **pawn** — one square forward in your direction, plus diagonal-forward captures. No double-push, no en passant, no promotion — those are intrinsic to actual pawns.
  - **king-step** — one square in any direction (the king's native move). Used by the Polished Bishop and Cavalry Doctrine artifacts to give bishops and knights a 1-square ortho-step option.
- **Edge cases:** the granted pattern follows the same blocking rules as a real piece of that move-type. Granting a pattern the piece already covers is a no-op (e.g. Bishop Patch on a queen).

## Square / board effects

Painted onto a board square. See `docs/design/board.md` for general overlay rules.

### Wall

An impassable square. **No piece may enter or pass through it**, and it blocks attack rays for sliding pieces. For check evaluation, a wall counts as a blocker (friendly to whichever side is calculating).

- **Duration:** card-specified (timed in turns, or permanent).
- **Edge cases:** en passant is blocked if the capture target square is walled. A piece cannot be placed on a walled square by Summon, Swap, Switch Files, or any other effect.

### Sanctuary

A square on which **pieces cannot be captured**. While a piece (yours or theirs) stands on a Sanctuary square, no capture move targeting it is legal.

- **Duration:** card-specified (timed in turns).
- **Edge cases:** Sanctuary protects the *square*, not a specific piece — your shielded piece moving off and an enemy piece moving on means the enemy piece becomes uncapturable. If a piece on a Sanctuary square is delivering check, the opponent cannot capture it to escape; they must block or move the king.

### Trap

A square that **triggers an effect when an enemy piece enters or passes through it**. Each Trap card specifies one trigger effect:

- **Trap (capture)** — the entering piece is removed from the board (counts as a capture for any "on capture" effects).
- **Trap (freeze)** — the entering piece is frozen for 1 turn (see Freeze).
- **Trap (push)** — the entering piece is pushed back 1 square along its movement path; if that square is occupied or off the board, the push fails and the Trap remains armed.

The Trap dissolves on trigger. It does not affect your own pieces.

- **Duration:** card-specified (timed in turns); also dissolves on trigger.
- **Edge cases:** a sliding piece passing *through* a Trap square (not stopping on it) still triggers it — the trigger fires on first entry. A Trap on a square that the player intends to move into via Remote Access still fires (the targeted enemy piece is the one moving).

## Card-flow keywords

The hand discards at end of turn. A new hand of 5 is drawn at the start of every player turn. The discard pile reshuffles into the draw pile when the draw pile is empty mid-draw. Two keywords carve out exceptions to that default.

### Retain

A card with **Retain** stays in your hand at end-of-turn discards. It only leaves your hand when you play it. Retain can be applied two ways:

- **Inherent**: the card definition declares `retain: true`. None of the prototype cards have inherent Retain.
- **Granted**: the **Bookmark** card applies Retain to a chosen card in your hand for the rest of the match. Bookmark itself does not have Retain.

Retain cannot be applied to a curse card (Bookmark filters them out). Retain ends when the card is played.

### Consume

A card with **Consume** is removed from the match when played — it lands in the consumed pile and never re-enters the cycle. Cards in the consumed pile are not eligible for revival via Restore Point or Restore from Backup.

- Used for haymakers (Format C:, Exploit), Patches (Pawn / Knight / Bishop / Rook / Queen), Remote Access, Restore from Backup, kill -9.
- Without Consume, cards land in the discard pile when played and cycle back into the draw pile when it empties.

### Discard & cycle

Played cards without Consume go to the **discard pile**. End-of-turn dumps every non-curse, non-retained hand card into the discard pile. When the draw pile is empty mid-draw, the discard pile is shuffled to form a new draw pile and drawing continues. Curses vanish on play and are not part of the cycle (see `docs/design/bosses.md`).

### Revive

A card whose effect returns one card from your **discard pile** to your hand. Restore Point picks at random; Restore from Backup prompts you to choose. Revivers cannot reach into the consumed pile — Consume cards are gone for the match.
