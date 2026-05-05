# Starter Deck

The 20 cards every fresh run begins with. The deck is sized to give the player a meaningful cycle through the deck several times per match while still feeling like a tight, identifiable set of tools (see [`docs/design/cards.md`](../design/cards.md) for the cycling rules and the Retain/Consume keywords).

## Composition

| Count | Card | Type | Effect |
|---|---|---|---|
| 2 | [Frostbite](disruption.md#frostbite) | Disruption | Freeze enemy piece. |
| 2 | [Tangled Roots](disruption.md#tangled-roots) | Disruption | Root enemy piece. |
| 2 | [Fumble](disruption.md#fumble) | Disruption | Disarm enemy piece. |
| 1 | [Provoke](disruption.md#provoke) | Disruption | Compel enemy piece. |
| 2 | [Barricade](spatial.md#barricade) | Spatial | Place wall, 3 turns. |
| 1 | [Snare](spatial.md#snare) | Spatial | Trap (freeze), 3 turns. |
| 1 | [Hallowed Ground](spatial.md#hallowed-ground) | Spatial | Place sanctuary, 3 turns. |
| 2 | [Iron Guard](defensive.md#iron-guard) | Defensive | Shield own piece. |
| 1 | [Martyr's Gift](sacrifice.md#martyrs-gift) | Sacrifice | **Consume.** Destroy own piece; +2 cards, +1 energy. |
| 1 | [Quickstep](tempo.md#quickstep) | Tempo | Own piece takes 2 actions (moves and captures). |
| 1 | [Switch Files](swap.md#switch-files) | Swap | Swap two of your own pieces. |
| 1 | [Vine Pull](swap.md#vine-pull) | Swap | Swap one of your pieces with a rooted enemy. |
| 1 | [Marionette](swap.md#marionette) | Swap | **Consume.** Move an enemy piece using one of its legal moves. |
| 1 | [Cheap Destroy](burst.md#cheap-destroy) | Burst | **Consume.** Destroy enemy non-King piece your forces are attacking. |
| 1 | [Big Destroy](burst.md#big-destroy) | Burst | **Consume.** Destroy any enemy non-King piece. |

**Total: 20 cards. 4 of them have Consume.**

## Cost curve

| Cost | Count | Cards |
|---|---|---|
| 1 | 10 | 2× Iron Guard, 2× Fumble, 2× Tangled Roots, 2× Barricade, Martyr's Gift, Snare |
| 2 | 7 | 2× Frostbite, Provoke, Hallowed Ground, Switch Files, Quickstep, Vine Pull |
| 4 | 1 | Cheap Destroy |
| 5 | 1 | Marionette |
| 10 | 1 | Big Destroy |

Average cost: ~2.4. Half the deck is cost-1, so turn 1 is workable on a 1-energy budget; the cost-4/5/10 haymakers reward banking through midgame.

## Rationale

- **Disruption-heavy core.** 7 of the 20 cards are status disablers (Frostbite/Tangled Roots/Fumble/Provoke). Multiples on the workhorses keep the deck reactive — even with cycling, end-of-turn discards mean the "right" disruption isn't always in hand on the right turn.
- **Spatial coverage.** Two Barricades plus one each of Snare and Hallowed Ground give the player wall, trap, and sanctuary tools without overloading the deck on overlapping spatial effects.
- **Two destroy haymakers, both Consume.** Cheap Destroy (cost 4, attacked-only) and Big Destroy (cost 10, any non-King) bracket the burst archetype: one playable mid-match, one true late-game finisher. Both are Consume so each copy is one piece-removal per match.
- **Swap toolkit.** Switch Files reorganises your own back rank; Vine Pull pays off the rooted enemies created by Tangled Roots; Marionette is the late-game Consume single-shot. Three different swap angles for one slot each — variety over redundancy.
- **No Retain in the starter.** Stash is intentionally a draft/shop pickup so the player feels the friction of un-banked haymakers before the cycling-deck banking tool arrives.
- **Souls come from captures, not the starter.** Capture-grants-Soul means each enemy you take feeds a matching empower card into your draw pile. Souls all have Consume, so each capture grants exactly one empower trigger — starting with Soul cards in the deck would dilute the supply line.

## Future shape

When drafts and shops land, the starter shrinks further (12–14 cards), and the rest of the library becomes draft-pool only. Stash, Reconnaissance, Foresight, Recall, Recover, and Standing Stone all live in the draft/shop pool.
