# Starter Deck

The 20 cards every fresh run begins with. The deck is sized to the top of the 16–20 band: enough variety to expose effect families, light enough to feel finite under the consume-all rule (every played card is removed for the rest of the match — see [`docs/design/cards.md`](../design/cards.md)).

## Composition

| Count | Card | Type | Effect |
|---|---|---|---|
| 2 | [Reconnaissance](resource.md#reconnaissance) | Resource | Draw 2. |
| 2 | [Frostbite](disruption.md#frostbite) | Disruption | Freeze enemy piece. |
| 1 | [Foresight](resource.md#foresight) | Resource | Scry top 3 of deck. |
| 1 | [Tangled Roots](disruption.md#tangled-roots) | Disruption | Root enemy piece. |
| 1 | [Fumble](disruption.md#fumble) | Disruption | Disarm enemy piece. |
| 1 | [Provoke](disruption.md#provoke) | Disruption | Compel enemy piece. |
| 1 | [Barricade](spatial.md#barricade) | Spatial | Place wall, 3 turns. |
| 1 | [Spike Pit](spatial.md#spike-pit) | Spatial | Trap (capture), 4 turns. |
| 1 | [Snare](spatial.md#snare) | Spatial | Trap (freeze), 3 turns. |
| 1 | [Quickstep](tempo.md#quickstep) | Tempo | Haste on own piece. |
| 1 | [Crooked Path](movement-extension.md#crooked-path) | Movement-extension | Empower own piece w/ knight L (this turn). |
| 1 | [Iron Guard](defensive.md#iron-guard) | Defensive | Shield own piece. |
| 1 | [Martyr's Gift](sacrifice.md#martyrs-gift) | Sacrifice | Destroy own piece; +2 cards, +1 energy. |
| 1 | [Cheap Destroy](burst.md#cheap-destroy) | Burst | Destroy enemy non-King piece your forces are attacking. |
| 1 | [Improvise](generators.md#improvise) | Resource | Add a random common card to your hand. |
| 1 | [Recall](revival.md#recall) | Resource | Return a random spent card to your hand. |
| 1 | [Pace](self-replicators.md#pace) | Resource | Scry 1; shuffle a copy of Pace into draw. |
| 1 | [Hum](self-replicators.md#hum) | Resource | Draw 1; shuffle a copy of Hum into draw. |

**Total: 20 cards.**

## Cost curve

| Cost | Count | Cards |
|---|---|---|
| 0 | 1 | Foresight |
| 1 | 12 | 2× Reconnaissance, Tangled Roots, Fumble, Barricade, Snare, Iron Guard, Martyr's Gift, Improvise, Recall, Pace, Hum |
| 2 | 6 | 2× Frostbite, Provoke, Spike Pit, Quickstep, Crooked Path |
| 4 | 1 | Cheap Destroy |

Average cost: ~1.45. Turn 1 is workable on a 1-energy budget — half the deck is cost-1.

## Rationale

- **Tempo-feasible from turn 1.** Banking energy starts at 1; the heavy cost-1 weighting means the player can almost always play something on the first turn. Frostbite/Quickstep/etc. need turn 2+ banking before they fire.
- **Multiples on the cheap utilities.** Reconnaissance and Frostbite get duplicates because they're both highly versatile and the consume-all rule weakens single-shot copies. Two of each creates a soft "if you've used it, there's another coming."
- **Empty-deck mitigation as a *floor*, not a feature.** Improvise + Recall + Pace + Hum are the four common card-economy tools. Together they keep the deck from collapsing in 20 plays — every card you spend can be partially recouped.
- **Souls come from captures, not the starter.** Capture-grants-Soul (see `docs/design/cards.md`) means each enemy you take feeds a matching empower card into your draw pile. Starting with Pawn/Knight/etc. Soul cards in the deck would double up the supply line without adding decision space, so they're left to organic acquisition.
- **Cheap Destroy as a showcase.** One copy demonstrates the upper-tier of the new banking system: at 4 energy it asks the player to set up the threat first (an enemy attacked by one of your pieces) before paying to remove the target.
- **Drops vs current main:** Hallowed Ground (uncommon, niche), Spring Trap (redundant with Snare), Switch Files (corner-case), Pawn Soul (replaced by capture grant), and the Lightning Strike / Marionette / Knight/Bishop/Rook/Queen Soul / Big Destroy haymakers (all priced at 4–10 energy and unplayable from a 1-energy start without significant banking). Those cards live in the data folder for the future draft pool.

## Future shape

When drafts and shops land, the starter shrinks further (12–14 cards), and the rest of the library — including the haymaker tier (Lightning Strike, Big Destroy, Queen Soul, Marionette) — becomes draft-pool only. The capture-grants-Soul pipeline already gives a structural reason to leave Souls out of the starter.
