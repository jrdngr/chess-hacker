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

A disarmed piece **may not capture**. Any move it makes must end on an empty square. Disarm can apply to any piece — your own or the opponent's.

- **Duration:** card-specified. Resets at the end of the turn. When combined with Haste, Disarm restricts only the first of the two moves.
- **Edge cases:** a disarmed piece still threatens squares for check purposes — it just cannot resolve those threats while disarmed.

### Compel

A compelled piece **must move on its next turn**. If any capture is legal for it, it must make one of the capturing moves; otherwise it must make any legal move it has.

- **Duration:** opponent's next turn.
- **Edge cases:** if the compelled piece has no legal moves at all (fully blocked, or moving would put own king in check), Compel does nothing — the constraint is on top of legality, not a replacement for it.

### Downgrade

A downgraded piece **loses its native movement and moves as a pawn** — one square forward, diagonal capture only. All other movement options are gone for the duration. Effectively reduces any piece to pawn-level mobility.

- **Duration:** card-specified (2 turns base, 3 turns upgraded).
- **Edge cases:** a downgraded knight cannot use its L-shape; a downgraded rook/bishop/queen cannot slide. Downgrade does not affect the piece's capture ability via diagonal-forward — it captures exactly like a pawn. The piece's type is unchanged (a downgraded queen is still a queen for targeting purposes, e.g. Bit Flip cannot target it). Downgrade does not stack with itself; reapplying refreshes the duration.

## Piece buffs

Applied to one of your own pieces.

### Shield

While a piece is shielded, **captures targeting it are not legal moves**. The opponent's move generation excludes any move that would capture this piece. The attacker is *not* destroyed; the move simply isn't available.

- **Duration:** until the start of your next turn (covers the opponent's next turn).
- **Edge cases:** if every capture-out-of-check option targets a shielded piece, that branch is closed — the opponent must escape check another way. If no escape exists, that's checkmate against them.

### Haste

A hasted piece **moves twice this turn**. Both moves must be otherwise legal in the chess sense (no moving into check, etc.). Whether the piece can capture on each move depends on whether it also has Disarm — Haste itself imposes no capture restriction.

- **Duration:** the current turn only.
- **Common pairing:** Overclock applies Haste with Disarm on the first move — the piece moves twice but can only capture on the second move. Overclock+ removes the Disarm, granting full Haste.
- **Edge cases:** the second move counts as a normal move for any rules that count moves (e.g., en passant only off the immediately preceding move).

### Empower

An empowered piece **gains an additional movement pattern**, defined per card (e.g., "knight L-shape", "diagonal slide", "pawn forward step"). The piece keeps its normal moveset *and* the granted pattern; it picks one to use. Patterns stack — multiple Empower effects on the same piece coexist.

**Empower-granted patterns are never capturing.** A piece may only capture using its native moveset; the granted pattern is movement-only. This rule applies to every Empower source — the pawn-flavored Side Channel / Lateral Movement cards, and the Polished Bishop / Cavalry Doctrine artifacts. A rook with a granted knight L-shape can use the L-shape to reposition to an empty square, but it cannot use the L-shape to take an enemy piece; the rook still captures normally along files and ranks.

- **Duration:** card-specified. Side Channel and Lateral Movement are **single-use this turn**: the status lasts the current turn AND drops immediately if the player moves a different piece first. Either way, the status drops if the empowered piece is captured or sacrificed.
- **Patterns currently in the prototype:**
  - **knight** — knight L-shape (ignores blockers).
  - **bishop** — diagonal slide (blocked normally).
  - **rook** — straight slide along files and ranks (blocked normally).
  - **queen** — both straight and diagonal slides (= bishop + rook).
  - **pawn** — one square forward in your direction. (Native pawns also have diagonal-forward captures and double-push; those are intrinsic to actual pawns and are not granted by Empower.)
  - **king-step** — one square in any direction (the king's native move). Used by the Polished Bishop and Cavalry Doctrine artifacts to give bishops and knights a 1-square ortho-step option.
  - **diagonal-step** — one square in any of the four diagonal directions. Used by Side Channel.
  - **horizontal-step** — one square left or right. Used by Lateral Movement.
- **Edge cases:** the granted pattern follows the same blocking rules as a real piece of that move-type. Granting a pattern the piece already covers is a no-op (e.g. bishop slide on a queen). Because Empower never captures, occupied destinations are simply not legal under the granted pattern, even if the same square would be a legal capture under the piece's native moveset.

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

The Trap dissolves on trigger. It does not affect your own pieces.

- **Duration:** card-specified (timed in turns); also dissolves on trigger.
- **Edge cases:** a sliding piece passing *through* a Trap square (not stopping on it) still triggers it — the trigger fires on first entry. A Trap on a square that the player intends to move into via Remote Access still fires (the targeted enemy piece is the one moving).

## Card-flow keywords

Cards persist in hand between turns. The player draws 2 cards at the start of each turn (up to hand limit 7) and must discard exactly 1 card at end of turn. The discard pile reshuffles into the draw pile when the draw pile is empty mid-draw.

### Consume

A card with **Consume** is removed from the match when played — it lands in the consumed pile and never re-enters the cycle. Cards in the consumed pile are not eligible for revival via Restore from Backup.

- Used for haymakers (Format C:, Exploit, Garbage Collect), Remote Access, Restore from Backup, Self-Destruct, Buffer Overflow, and others.
- Without Consume, cards land in the discard pile when played and cycle back into the draw pile when it empties.

### Discard & cycle

Played cards without Consume go to the **discard pile**. At end of turn, the forced discard sends 1 card from hand to the discard pile. When the draw pile is empty mid-draw, the discard pile is shuffled to form a new draw pile and drawing continues.

### Revive

A card whose effect returns one card from your **discard pile** to your hand. Restore from Backup prompts you to choose. Revivers cannot reach into the consumed pile — Consume cards are gone for the match.

### "+" (Upgraded)

A card whose name ends in **+** is the upgraded variant of its base card —
stronger numbers, lower cost, an added keyword, or some combination thereof.
Every base card has exactly one `+` form. The `+` variant is never offered in
shops or packs; the only way to acquire one is to use the
shop's **Smith** service on an existing deck card. Upgrade is single-tier —
there are no `++` cards. See [`../design/cards.md`](../design/cards.md) for
authoring and [`../design/economy.md`](../design/economy.md) for pricing.
