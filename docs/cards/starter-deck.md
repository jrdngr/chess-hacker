# Starter Deck

The 20 cards every fresh run begins with. The deck is sized to give the player a meaningful cycle through the deck several times per match while still feeling like a tight, identifiable set of tools (see [`docs/design/cards.md`](../design/cards.md) for the cycling rules and the Retain/Consume keywords).

## Composition

| Count | Card | Type | Effect |
|---|---|---|---|
| 2 | [Freeze Process](disruption.md#frostbite) | Disruption | Freeze enemy piece. |
| 2 | [chroot](disruption.md#tangled-roots) | Disruption | Root enemy piece. |
| 1 | [Read-Only](disruption.md#fumble) | Disruption | Disarm enemy piece. |
| 1 | [Phishing](disruption.md#provoke) | Disruption | Compel enemy piece. |
| 2 | [Firewall](spatial.md#barricade) | Spatial | Place wall, 3 turns. |
| 1 | [Honeypot](spatial.md#snare) | Spatial | Trap (freeze), 3 turns. |
| 1 | [Trusted Zone](spatial.md#hallowed-ground) | Spatial | Place sanctuary, 3 turns. |
| 1 | [Encrypted](defensive.md#iron-guard) | Defensive | Shield own piece. |
| 1 | [kill -9](sacrifice.md#martyrs-gift) | Sacrifice | **Consume.** Destroy own piece; +2 cards, +1 energy. |
| 1 | [Overclock](tempo.md#quickstep) | Tempo | Own piece takes 2 actions (moves and captures). |
| 1 | [Sprint](movement-extension.md#sprint) | Movement-extension | Give Haste to a friendly piece (move twice, no captures). |
| 1 | [Vanguard](movement-extension.md#vanguard) | Movement-extension | Pawn-only Overclock: pawn takes 2 actions this turn. |
| 1 | [Switch Files](swap.md#switch-files) | Swap | Swap two of your own pieces. |
| 1 | [Extract](swap.md#extract) | Swap | Swap one of your pieces with any enemy non-King piece. |
| 1 | [Remote Access](swap.md#marionette) | Swap | **Consume.** Move an enemy piece using one of its legal moves. |
| 1 | [Exploit](burst.md#cheap-destroy) | Burst | **Consume.** Destroy enemy non-King piece your forces are attacking. |
| 1 | [Format C:](burst.md#big-destroy) | Burst | **Consume.** Destroy any enemy non-King piece. |

**Total: 20 cards. 4 of them have Consume.**

## Cost curve

| Cost | Count | Cards |
|---|---|---|
| 1 | 9 | Encrypted, Read-Only, 2× chroot, 2× Firewall, kill -9, Honeypot, Sprint, Vanguard |
| 2 | 6 | 2× Freeze Process, Phishing, Trusted Zone, Switch Files, Overclock |
| 3 | 3 | Exploit, Remote Access, Extract |
| 4 | 1 | Format C: |

Average cost: ~1.85. The cost-1 block now includes two proactive movement openers (Sprint, Vanguard); the cost-3 / cost-4 haymakers still want either a Cache Warmup the prior turn or the player's full per-turn budget.

## Rationale

- **Disruption-heavy core.** 6 of the 20 cards are status disablers (Freeze Process/chroot/Read-Only/Phishing). Multiples on the workhorses keep the deck reactive — even with cycling, end-of-turn discards mean the "right" disruption isn't always in hand on the right turn.
- **Spatial coverage.** Two Firewalls plus one each of Honeypot and Trusted Zone give the player wall, trap, and sanctuary tools without overloading the deck on overlapping spatial effects.
- **Two destroy haymakers, both Consume.** Exploit (cost 3, attacked-only) and Format C: (cost 4, any non-King) bracket the burst archetype: one fits inside a 3-energy turn, one demands the full budget (or a Cache Warmup the prior turn). Both are Consume so each copy is one piece-removal per match.
- **Swap toolkit.** Switch Files reorganises your own back rank; Extract repositions any enemy non-King piece (no rooted requirement); Remote Access is the late-game Consume single-shot. Three different swap angles for one slot each — variety over redundancy.
- **Proactive movement openers.** Sprint (1-cost Haste) and Vanguard (1-cost pawn-only Overclock) flag the new Haste / multi-action lines. Without them the starter felt purely reactive on turn 1; these two give the player something to *do* with a 3-energy first turn that builds toward a piece-capture or fork.
- **No Retain in the starter.** Bookmark is intentionally a draft/shop pickup so the player feels the friction of un-banked haymakers before the cycling-deck banking tool arrives.
- **Patches come from captures, not the starter.** Capture-grants-Patch means each enemy you take feeds a matching empower card into your draw pile. Patches all have Consume, so each capture grants exactly one empower trigger — starting with Patch cards in the deck would dilute the supply line.

## Future shape

When drafts and shops land, the starter shrinks further (12–14 cards), and the rest of the library becomes draft-pool only. Bookmark, Port Scan, Stack Trace, Restore from Backup, and Power Node all live in the draft/shop pool.
