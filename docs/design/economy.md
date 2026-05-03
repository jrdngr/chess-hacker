# Economy & Shop

The run economy is **gold-based and Balatro-flavored**: a single currency, an interest mechanic that rewards saving, a shop after every match, and skip-rewards that let you trade post-match goodies for more gold.

## Currency

There is exactly **one currency: gold**. No premium currency, no skill currency, no act-locked currency. Everything is priced in gold.

## Sources of gold

Gold is earned from four sources:

1. **Per-match win bonus.** A flat amount for winning any match. Bosses pay more.
2. **Performance bonuses.** Modest extra gold for in-match feats. Examples (final list TBD):
   - Win in N or fewer turns.
   - Lose no major pieces (rook/queen/king-equivalent).
   - Win without playing any cards on a turn (banking energy spends 0 by default; this measures restraint, not "free" play).
   - Capture the enemy queen.
   - Win with cards still in your draw pile (consume-all means the deck thins quickly; finishing before it empties is a feat).

   These are designed to reward a specific style without pressuring every player into the same play pattern.

3. **Skip rewards.** When the player is offered a card draft (or piece draft in Skirmish), they may **skip** the reward and receive a gold bonus instead. The skip-bonus gold scales mildly with run progression — early acts pay less, later acts more — to keep skipping a real choice late.

4. **Boss / act-end bonus.** Defeating a boss grants a large gold bonus on top of the boss artifact reward.

## Interest (Balatro-style saving)

At the **end of each shop visit**, the player gains **+1 gold per 5 unspent gold** they hold, capped at **+5 gold** (so the saving cap is 25 gold to maximize interest).

This rewards budgeting: it's better to save 25 gold and earn +5 per shop than to spend everything every shop.

The cap is a tuning knob — too high and saving dominates; too low and interest is irrelevant.

## Shop

A **shop opens after every match** (between the post-match reward step and the next match). The shop is the central spending venue.

### What the shop offers

| Slot type        | What                                                      | Pricing (rough)           |
|------------------|-----------------------------------------------------------|---------------------------|
| Single cards     | A small rotating selection (3–5) of cards available to buy directly. Mix of commons / uncommons. | ~5–15 gold each. Higher rarity = higher cost. |
| Booster packs    | A small selection (1–3) of card-pack bundles. Open the pack, pick 1–N cards from its contents (Balatro booster style). Different pack types for different archetypes. | ~3–8 gold per pack       |
| Artifacts        | A small selection (1–2) of artifacts. Mostly common/uncommon; rares appear occasionally. | ~10–25 gold each. Rare = expensive. |

All offerings are randomly selected each time the shop is generated. Prices are slot-based with some randomness.

### Shop services

| Service          | What                                                      | Pricing                   |
|------------------|-----------------------------------------------------------|---------------------------|
| Reroll           | Refresh all shop offerings (and pack contents not yet opened) for the current shop visit. | Scales **per shop visit**: 1st reroll = X gold, 2nd = X+1, 3rd = X+2, ... Resets at next shop. |
| Card removal     | Permanently remove one card from the player's deck. | Scales **per use over the run**: 1st removal cheap, each subsequent more expensive. (e.g., 50 → 75 → 100 → 125 ...) |

The two services have **different scaling philosophies** on purpose:

- Reroll cost resets per-shop because the player should be free to roll once per shop without it spiraling.
- Card removal cost compounds across the run because we want pruning the deck to be a real and increasingly hard tradeoff.

### What the shop does NOT offer

- ❌ No card upgrades. (Considered, cut from prototype scope. See `cards.md`.)
- ❌ No piece purchases (Skirmish pieces only via drafts).
- ❌ No vouchers / permanent run upgrades. (Considered, cut. Reconsider after playtest.)
- ❌ No "leave the shop" reward — leaving is free and unmotivated.

### Skip / leave

The player may leave the shop at any time. Gold left in pocket is preserved for next shop and counts toward interest.

## Skip-for-gold flow

After each match, the reward step shows the card draft (and Skirmish piece draft) options. Each draft offers a **Skip** button. Choosing Skip:

- Forfeits the draft.
- Awards a gold bonus (typed by which draft was skipped — "skip card draft" vs "skip piece draft" can have different bonuses, with piece-skip slightly more valuable on average since piece drafts are more impactful).

Skipping is **not** punished. It's a real economic lever and players who run "skip-heavy" gold-hoarding builds should be supported.

## Pricing principles

- Always charge enough that buying everything is impossible.
- Cards under ~10 gold should feel like impulse buys; artifacts should feel like commitments.
- Removal should be powerful but rare-use.
- Reroll should be available in moderation — paying ~5 gold to fish for a key card is reasonable.

## Summary numbers (prototype starting values)

| Knob                              | Value                                  |
|-----------------------------------|----------------------------------------|
| Currencies                        | Gold only                              |
| Per-match win bonus               | TBD (e.g., 8 gold normal, 25 gold boss) |
| Interest rate                     | +1 gold per 5 saved                    |
| Interest cap                      | +5 gold per shop visit                 |
| Reroll cost                       | Scales **per shop visit**              |
| Card removal cost                 | Scales **per use over the run**        |
| Skip card-draft bonus             | TBD (e.g., 4 → 6 → 10 across acts)     |
| Skip piece-draft bonus            | TBD, slightly higher than card-skip    |
| Shop card price range             | ~5–15 gold                             |
| Shop pack price range             | ~3–8 gold                              |
| Shop artifact price range         | ~10–25 gold                            |
