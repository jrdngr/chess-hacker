# Swap / Displace cards

Swap and displace cards move pieces around the board outside of normal chess movement. They re-arrange the position rather than playing through it.

See [`keywords.md`](keywords.md) for keyword definitions.

## Switch Files

- **Cost:** 2
- **Rarity:** Uncommon
- **Target:** two of your own pieces
- **Effect:** Swap the positions of two of your own pieces.
- **Design note:** a positional reshuffle. Useful for pulling a stranded piece back into the action, or aligning a defender behind a key piece. Both pieces' move-history is preserved (a king that's swapped still loses castling rights as before; a pawn swapped to rank 2 does *not* regain its 2-square first move). Swapping onto a square does not trigger Traps (Trap only triggers on enemy entry).

## Marionette

- **Cost:** 3
- **Rarity:** Rare
- **Target:** enemy piece
- **Effect:** Choose an enemy piece. Move it using one of its legal moves. You may not have it capture one of your own pieces. **Consume.**
- **Design note:** the trap-payoff card. Place a Spike Pit, then Marionette an enemy piece into it. Or Marionette a defender off the square it's protecting and capture into the gap on your next move. The "may not capture your own pieces" rider makes the card about *positioning* the enemy, not feeding them captures; the rider is essentially never a constraint that bites real lines.

  The chosen move must be legal *for the opponent* — it cannot put their own king into check (since it wouldn't be legal for them). After Marionette resolves, it is the opponent's turn next as normal; they don't get a re-do for the move you used. Consume so the card is a memorable tactical moment, not a recurring puppet engine.
