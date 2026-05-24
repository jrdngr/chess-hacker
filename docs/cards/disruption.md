# Disruption cards

Disruption cards apply debuffs to enemy pieces — freeze, root, disarm, compel — to break the opponent's plans without removing material.

See [`keywords.md`](keywords.md) for keyword definitions.

## Freeze Process

- **Cost:** 2
- **Rarity:** Common
- **Target:** enemy piece
- **Effect:** Target enemy piece: **Freeze** for its next turn.
- **Design note:** the iconic disruption card. Freezes a defender to open a capture, freezes an attacker to escape a threat, or freezes a king to delay an escape from check. Two copies in the starter so the player meets Freeze early and often.

## chroot

- **Cost:** 1
- **Rarity:** Common
- **Target:** enemy piece
- **Effect:** Target enemy piece: **Root** for its next turn.
- **Design note:** half of a Freeze, but cheaper. Sliders (queen, rook, bishop) lose all their reach — Root only permits *adjacent* captures, so a long-range bishop pin is defanged. Knights are completely shut down (their L-shape is too far). Pawns and the king remain dangerous when an adjacent capture is on offer. Designed as a finer-grained, cheaper disruption.

## Read-Only

- **Cost:** 1
- **Rarity:** Common
- **Target:** enemy piece
- **Effect:** Target enemy piece: **Disarm** for its next turn.
- **Design note:** the inverse of chroot — the piece may move freely but cannot capture. Best used to defang a piece that's about to take one of yours, while leaving its mobility (and thus its threats) intact.

## Phishing

- **Cost:** 2
- **Rarity:** Uncommon
- **Target:** enemy piece
- **Effect:** Target enemy piece: **Compel** on its next turn.
- **Design note:** compels the piece into a forced move. Combos with Trap squares and Connection Reset zones — Compel a piece adjacent to a Logic Bomb and (if a capture isn't legal) it must walk into the trap. If a capture *is* legal, the piece is forced to take it: useful when you've baited an exposed pawn.

## Rollback

- **Cost:** 2
- **Rarity:** Uncommon
- **Target:** none
- **Effect:** Reverse the opponent's most recent chess move: their piece returns to where it came from, and any captured player piece is restored. **It remains your turn** — the move is undone, but you do not lose tempo.
- **Design note:** Named for the database / VCS term. The net effect is the player getting two consecutive turns with the opponent's "preview" move shown in between — useful intel about what they would have done, gone. Distinct from the dev-panel **Undo** button: Undo rewinds an entire player turn (cards + chess move) and flips the turn back; Rollback only walks back the *opponent's* last board action and **keeps the player's turn**. No effect on turn 1 (no opponent move yet); the energy is still spent. Statuses that were sitting on the moved piece follow it back to the origin square. Promotions, captures, and castling are all reversed cleanly because the engine restores the full prior position rather than reconstructing it move-by-move.

## Downgrade

- **Cost:** 2
- **Rarity:** Uncommon
- **Target:** enemy non-King piece
- **Effect:** Target enemy piece is **Downgraded** for 2 turns: it loses its native movement and moves as a pawn (1 square forward, diagonal capture only).
- **Upgrade (Downgrade+):** Lasts 3 turns.
- **Design note:** devastating against high-value sliders — a queen reduced to pawn movement is nearly dead weight. Knights lose their L-shape entirely; bishops and rooks lose all reach. Introduces a new debuff keyword (Downgrade) alongside the existing Freeze/Root/Disarm/Compel family. Non-Consume so it cycles back for repeat use; the 2-turn duration is long enough to matter but short enough that it doesn't permanently lock out a piece.

## Bit Flip

- **Cost:** 3
- **Rarity:** Rare
- **Keywords:** **Consume**
- **Target:** enemy minor piece (knight, bishop, or pawn)
- **Effect:** Convert the target enemy piece to your side. It stays on its current square but is now yours — you control it from your next move onward.
- **Upgrade (Bit Flip+):** Can also target rooks.
- **Design note:** the single most disruptive card in the pool — a net two-piece material swing (they lose one, you gain one). Restricted to minor pieces to prevent instant-win scenarios (no queen/king conversion). The upgrade opening rooks is a significant power spike. Consume + Rare + cost 3 means this is a one-shot haymaker that competes for the turn's budget.
