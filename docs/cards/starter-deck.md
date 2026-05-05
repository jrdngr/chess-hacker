# Starter Deck

The 20 cards every fresh run begins with. The deck is sized to give the player a meaningful cycle through the deck several times per match while still feeling like a tight, identifiable set of tools (see [`docs/design/cards.md`](../design/cards.md) for the cycling rules and the Retain/Consume keywords).

## Composition

| Count | Card | Type | Effect |
|---|---|---|---|
| 2 | [Freeze Process](disruption.md#frostbite) | Disruption | Freeze enemy piece. |
| 2 | [chroot](disruption.md#tangled-roots) | Disruption | Root enemy piece. |
| 2 | [Read-Only](disruption.md#fumble) | Disruption | Disarm enemy piece. |
| 1 | [Phishing](disruption.md#provoke) | Disruption | Compel enemy piece. |
| 2 | [Firewall](spatial.md#barricade) | Spatial | Place wall, 3 turns. |
| 1 | [Honeypot](spatial.md#snare) | Spatial | Trap (freeze), 3 turns. |
| 1 | [Trusted Zone](spatial.md#hallowed-ground) | Spatial | Place sanctuary, 3 turns. |
| 2 | [Encrypted](defensive.md#iron-guard) | Defensive | Shield own piece. |
| 1 | [kill -9](sacrifice.md#martyrs-gift) | Sacrifice | **Consume.** Destroy own piece; +2 cards, +1 energy. |
| 1 | [Overclock](tempo.md#quickstep) | Tempo | Own piece takes 2 actions (moves and captures). |
| 1 | [Switch Files](swap.md#switch-files) | Swap | Swap two of your own pieces. |
| 1 | [Extract](swap.md#vine-pull) | Swap | Swap one of your pieces with a rooted enemy. |
| 1 | [Remote Access](swap.md#marionette) | Swap | **Consume.** Move an enemy piece using one of its legal moves. |
| 1 | [Exploit](burst.md#cheap-destroy) | Burst | **Consume.** Destroy enemy non-King piece your forces are attacking. |
| 1 | [Format C:](burst.md#big-destroy) | Burst | **Consume.** Destroy any enemy non-King piece. |

**Total: 20 cards. 4 of them have Consume.**

## Cost curve

| Cost | Count | Cards |
|---|---|---|
| 1 | 10 | 2× Encrypted, 2× Read-Only, 2× chroot, 2× Firewall, kill -9, Honeypot |
| 2 | 7 | 2× Freeze Process, Phishing, Trusted Zone, Switch Files, Overclock, Extract |
| 4 | 1 | Exploit |
| 5 | 1 | Remote Access |
| 10 | 1 | Format C: |

Average cost: ~2.4. Half the deck is cost-1, so turn 1 is workable on a 1-energy budget; the cost-4/5/10 haymakers reward banking through midgame.

## Rationale

- **Disruption-heavy core.** 7 of the 20 cards are status disablers (Freeze Process/chroot/Read-Only/Phishing). Multiples on the workhorses keep the deck reactive — even with cycling, end-of-turn discards mean the "right" disruption isn't always in hand on the right turn.
- **Spatial coverage.** Two Firewalls plus one each of Honeypot and Trusted Zone give the player wall, trap, and sanctuary tools without overloading the deck on overlapping spatial effects.
- **Two destroy haymakers, both Consume.** Exploit (cost 4, attacked-only) and Format C: (cost 10, any non-King) bracket the burst archetype: one playable mid-match, one true late-game finisher. Both are Consume so each copy is one piece-removal per match.
- **Swap toolkit.** Switch Files reorganises your own back rank; Extract pays off the rooted enemies created by chroot; Remote Access is the late-game Consume single-shot. Three different swap angles for one slot each — variety over redundancy.
- **No Retain in the starter.** Bookmark is intentionally a draft/shop pickup so the player feels the friction of un-banked haymakers before the cycling-deck banking tool arrives.
- **Patches come from captures, not the starter.** Capture-grants-Patch means each enemy you take feeds a matching empower card into your draw pile. Patches all have Consume, so each capture grants exactly one empower trigger — starting with Patch cards in the deck would dilute the supply line.

## Future shape

When drafts and shops land, the starter shrinks further (12–14 cards), and the rest of the library becomes draft-pool only. Bookmark, Port Scan, Stack Trace, Restore Point, Restore from Backup, and Power Node all live in the draft/shop pool.
