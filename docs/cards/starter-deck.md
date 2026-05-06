# Starter Deck

The 12 cards every fresh run begins with. The deck is intentionally small and focused — solid disruption + tempo cards plus two "fun" flagship cards that show the player what high-impact plays can feel like. With the dev panel's deck editor available for testing, the starter no longer has to expose the full library; everything else is acquired through the shop between matches.

## Composition

| Count | Card | Type | Effect |
|---|---|---|---|
| 1 | [Encrypted](defensive.md#iron-guard) | Defensive | Shield own piece. |
| 1 | [Read-Only](disruption.md#fumble) | Disruption | Disarm enemy piece. |
| 1 | [chroot](disruption.md#tangled-roots) | Disruption | Root enemy piece. |
| 1 | [Firewall](spatial.md#barricade) | Spatial | Place wall, 3 turns. |
| 1 | [Honeypot](spatial.md#snare) | Spatial | Trap (freeze), 3 turns. |
| 1 | [Sprint](movement-extension.md#sprint) | Movement-extension | Give Haste to a friendly piece. |
| 2 | [Freeze Process](disruption.md#frostbite) | Disruption | Freeze enemy piece. |
| 1 | [Phishing](disruption.md#provoke) | Disruption | Compel enemy piece. |
| 1 | [Overclock](tempo.md#quickstep) | Tempo · **fun** | Own piece takes 2 actions this turn. |
| 1 | [Exploit](burst.md#cheap-destroy) | Burst | **Consume.** Destroy enemy non-King piece your forces are attacking. |
| 1 | [Remote Access](swap.md#marionette) | Swap · **fun** | **Consume.** Move an enemy piece using one of its legal moves. |

**Total: 12 cards. Max card cost: 3. 2 of them have Consume.**

## Cost curve

| Cost | Count | Cards |
|---|---|---|
| 1 | 6 | Encrypted, Read-Only, chroot, Firewall, Honeypot, Sprint |
| 2 | 4 | 2× Freeze Process, Phishing, Overclock |
| 3 | 2 | Exploit, Remote Access |

Average cost: ~1.67. Energy is 3/turn (no banking), so the 3-cost cards each consume a full turn's budget — they are committal plays.

## Rationale

- **Disruption-heavy core.** 5 of the 12 cards are status disablers (Read-Only, chroot, 2× Freeze Process, Phishing). Multiples on Freeze Process keep the workhorse disruption reliably available even after end-of-turn discards.
- **Spatial tools without bloat.** One Firewall (wall) and one Honeypot (trap) cover the basic spatial vocabulary. Trusted Zone, additional Firewalls, and Power Node are shop pickups.
- **One destroy haymaker, attacked-only.** Exploit (cost 3) is the sole removal card; the bigger Format C: (cost 4) is over the cap and lives in the shop pool. Players who want unconditional destroy buy Format C: later.
- **Two flagship "fun" cards.** Overclock (cost 2 — own piece takes 2 actions this turn) and Remote Access (cost 3 Consume — puppet an enemy piece) are the marquee picks. Both produce dramatic single-turn swings and showcase the card-system's design space.
- **One opener, one defensive.** Sprint (1-cost Haste on a friendly piece) gives the player something proactive to do on turn 1; Encrypted (1-cost shield) keeps the deck reactive when the AI threatens an exchange.
- **No Cache Warmup, no Bookmark.** Cache Warmup (the +2-energy-next-turn card) is intentionally a shop pickup so the player feels the friction of a true 3-energy ceiling first. Bookmark (Retain) is similarly a shop pickup so the player runs into discard-pile pressure before the cycling-deck banking tool arrives.
- **Patches come from captures, not the starter.** Capture-grants-Patch keeps the deck fresh organically.

## Future shape

The starter is now at the lower end of the design target. As more cards land in the catalog, candidates for swap-in include additional 1-cost openers, alternative cost-2 disruption, and small flavor variants. The shop / booster-pack pool is where the rest of the library lives.
