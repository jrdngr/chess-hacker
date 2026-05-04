# Starter Deck

The 20 cards every fresh run begins with. The deck is sized to the top of the 16–20 band: enough variety to expose effect families, light enough to feel finite under the consume-all rule (every played card is removed for the rest of the match — see [`docs/design/cards.md`](../design/cards.md)).

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
| 1 | [Martyr's Gift](sacrifice.md#martyrs-gift) | Sacrifice | Destroy own piece; +2 cards, +1 energy. |
| 1 | [Quickstep](tempo.md#quickstep) | Tempo | Own piece takes 2 actions (moves and captures). |
| 1 | [Switch Files](swap.md#switch-files) | Swap | Swap two of your own pieces. |
| 1 | [Vine Pull](generators.md#vine-pull) | Swap | Swap one of your pieces with a rooted enemy. |
| 1 | [Marionette](swap.md#marionette) | Swap | Move an enemy piece using one of its legal moves. |
| 1 | [Cheap Destroy](burst.md#cheap-destroy) | Burst | Destroy enemy non-King piece your forces are attacking. |
| 1 | [Big Destroy](burst.md#big-destroy) | Burst | Destroy any enemy non-King piece. |

**Total: 20 cards.**

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

- **Disruption-heavy core.** 7 of the 20 cards are status disablers (Frostbite/Tangled Roots/Fumble/Provoke). Multiples on Frostbite, Tangled Roots, and Fumble keep the deck reactive — the consume-all rule punishes single-shots, so duplicates exist for the workhorse disruption.
- **Spatial coverage.** Two Barricades plus one each of Snare and Hallowed Ground give the player wall, trap, and sanctuary tools without overloading the deck on overlapping spatial effects.
- **Two destroy haymakers.** Cheap Destroy (cost 4, attacked-only) and Big Destroy (cost 10, any non-King) bracket the burst archetype: one playable mid-match after a few turns of banking, one true late-game finisher.
- **Swap toolkit.** Switch Files reorganises your own back rank; Vine Pull pays off the rooted enemies created by Tangled Roots; Marionette is the late-game single-shot. Three different swap angles for one slot each — variety over redundancy.
- **Souls come from captures, not the starter.** Capture-grants-Soul (see `docs/design/cards.md`) means each enemy you take feeds a matching empower card into your draw pile. Starting with Pawn/Knight/etc. Soul cards in the deck would double up the supply line without adding decision space, so they're left to organic acquisition.

## Future shape

When drafts and shops land, the starter shrinks further (12–14 cards), and the rest of the library becomes draft-pool only. The capture-grants-Soul pipeline already gives a structural reason to leave Souls out of the starter.
