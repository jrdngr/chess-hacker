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
- **Target:** enemy piece
- **Effect:** Choose an enemy piece. Move it using one of its legal moves. You may not have it capture one of your own pieces.
- **Design note:** the trap-payoff card. Place a Spike Pit, then Marionette an enemy piece into it. Or Marionette a defender off the square it's protecting and capture into the gap on your next move. The "may not capture your own pieces" rider makes the card about *positioning* the enemy, not feeding them captures; the rider is essentially never a constraint that bites real lines.

  The chosen move must be legal *for the opponent* — it cannot put their own king into check (since it wouldn't be legal for them). After Marionette resolves, it is the opponent's turn next as normal; they don't get a re-do for the move you used.

## Mark Target

- **Cost:** 2
- **Rarity:** Uncommon
- **Target:** enemy non-King piece
- **Effect:** Root the targeted enemy for **2 turns** (it cannot move on either of its next two turns except to capture an adjacent piece). Add Vine Pull to your hand.
- **Design note:** the setup half of a 2-turn combo. The 2-turn root window is the deliberate mismatch from Tangled Roots' 1-turn root: you need the extra turn to bank energy for Vine Pull and pick the swap target. Mark Target is also the standard generator for Vine Pull cards in your deck — Vine Pull is otherwise unobtainable in the prototype.

  Listed under Generators in the per-archetype docs ([`generators.md`](generators.md)) because the "add a card to hand" half is what makes this archetype tick. Listed under Swap here because the *combo's payoff* is a swap.

## Vine Pull

- **Cost:** 2
- **Rarity:** Uncommon
- **Target:** a rooted enemy non-King piece + one of your pieces (two-step pick)
- **Effect:** Swap the two pieces' positions. The rooted enemy ends up where your piece was; your piece takes the rooted square.
- **Design note:** the payoff half of the Mark Target combo. Generally the rooted enemy keeps its root status after the swap (statuses follow the piece). 2 + 2 = 4 energy total across two turns to bring an enemy out of position and slot one of your pieces into a deep square — a tempo swing rather than material.
