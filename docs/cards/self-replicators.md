# Self-replicators

Cards that, when played, **shuffle a fresh copy of themselves into your draw pile**. The played copy still consumes (it lands in the spent pile); the spawned copy is a brand-new card in the deck. Net effect: each play "replaces" the card in your deck at the cost of one energy and one effect resolution.

## Pace

- **Cost:** 1 energy
- **Rarity:** Common
- **Type:** Resource (compound)
- **Target:** None
- **Effect:** Scry 1 (look at the top card of your draw pile, leave or move to bottom). Shuffle a copy of Pace into your draw pile.

The lightweight tempo card. Each play is a +1-energy investment for one peek at your deck plus a future Pace.

## Hum

- **Cost:** 1 energy
- **Rarity:** Common
- **Type:** Resource (compound)
- **Target:** None
- **Effect:** Draw 1 card. Shuffle a copy of Hum into your draw pile.

A perpetual cycle. Each play replaces the Hum *and* gives you a fresh card from the top of the deck. Caveat: under consume-all, the deck eventually runs out — Hum slows the bleed but doesn't stop it.

## Drift

- **Cost:** 1 energy
- **Rarity:** Uncommon
- **Type:** Spatial (compound)
- **Target:** Empty square
- **Effect:** Place a wall on the chosen square (lasts 1 turn). Shuffle a copy of Drift into your draw pile.

The positional self-replicator: a one-turn wall is short, but free in the sense that the deck keeps the card. Block a single square per turn for as long as you keep drawing Drift.

Drift is draft-pool only.

## Why they exist

A 20-card deck under consume-all is a finite resource. Self-replicators turn that resource into a *renewable* one, but at a cost — every play consumes energy and a turn's worth of card-priority. They're the slowest ramp in the prototype: the value comes not from any single play but from being in the deck across the whole match.

The named "self-replicating" keyword (see [`keywords.md`](keywords.md)) signals this clearly. Card text on these reads "Shuffle a copy of [name] into your draw pile" so the loop is visible.

## Open balance question

Pace and Hum at cost 1 may be too dominant — they're effectively perpetual scry/draw at fixed marginal cost. If playtest shows them oppressive, see `TODO.md` for tuning options (raise cost, fatigue counter, replication cap).
