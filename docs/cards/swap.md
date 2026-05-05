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

- **Cost:** 5
- **Rarity:** Rare
- **Keywords:** **Consume**
- **Target:** enemy piece
- **Effect:** Choose an enemy piece. Move it using one of its legal moves. You may not have it capture one of your own pieces.
- **Design note:** the trap-payoff card. Place a Spike Pit, then Marionette an enemy piece into it. Or Marionette a defender off the square it's protecting and capture into the gap on your next move. The "may not capture your own pieces" rider makes the card about *positioning* the enemy, not feeding them captures. Consume keeps each copy a once-per-match power play.

  The chosen move must be legal *for the opponent* — it cannot put their own king into check (since it wouldn't be legal for them). After Marionette resolves, it is the opponent's turn next as normal; they don't get a re-do for the move you used.

## Vine Pull

- **Cost:** 2
- **Rarity:** Uncommon
- **Target:** a rooted enemy non-King piece + one of your pieces (two-step pick)
- **Effect:** Swap the two pieces' positions. The rooted enemy ends up where your piece was; your piece takes the rooted square.
- **Design note:** pairs with Tangled Roots: root the enemy, then drag them off their square. Generally the rooted enemy keeps its root status after the swap (statuses follow the piece). A tempo swing rather than material.
