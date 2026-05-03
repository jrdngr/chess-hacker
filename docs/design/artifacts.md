# Artifacts

Artifacts (Slay-the-Spire "relics" / Balatro "jokers") are the **second persistent power layer** of a run. While cards live in your deck, artifacts sit in a sidebar and apply their effects passively or as triggers. They define your build alongside your deck.

## Acquisition

Artifacts are acquired from exactly two sources in the prototype:

1. **Boss rewards.** Each boss win grants a 1-of-3 artifact choice from a boss-tier (rare) artifact pool. 3 bosses → up to 3 boss artifacts per run.
2. **Shop.** The shop offers artifacts among its rotating inventory (alongside single cards and booster packs). Shop artifacts are typically common or uncommon; rares appear occasionally.

Artifacts are **not** part of regular post-match drafts. Drafts give cards (and pieces in Skirmish) only.

## Slots and capacity

The player can hold up to **5 artifacts** at any time. When the player would acquire a 6th:

- The acquisition flow asks the player to choose: take the new artifact (and discard one of the existing five), or refuse the new artifact.
- Discarded artifacts are removed for the rest of the run; they do not return.

The 5-slot cap is a tuning knob. Specific artifacts may raise the cap (rare).

## Rarity tiers

Three tiers:

| Tier      | Power level                                        | Source                                |
|-----------|----------------------------------------------------|---------------------------------------|
| Common    | Small modifier or buff                             | Shop (frequent), boss reward (rare)   |
| Uncommon  | Notable buff / minor build-shaping                 | Shop (occasional), boss reward        |
| Rare      | Build-defining, often combo-enabling               | Shop (rare), boss reward (frequent)   |

Boss reward artifacts skew rare. Shop artifacts skew common.

## Effect domains

Artifacts can affect any of the following domains. The prototype design space spans **all four**:

### 1. Card-related

Modify the card system globally.

- "All Tempo cards cost 1 less (minimum 0)."
- "The first card you play each turn is free."
- "When you draw your last card, draw 2 instead."

### 2. Piece-related

Modify how the player's pieces behave globally for the rest of the run.

- "Your knights may also move 1 square diagonally."
- "Your pawns promote at rank 6 (instead of 8)."
- "When one of your pawns reaches rank 4, draw a card."

### 3. Resource / match-rule

Modify the match's resources or rules.

- "Start each match with +1 energy on turn 1 only." (i.e., turn 1 begins at 2 energy instead of 1.)
- "Hand size +1."
- "On turn 1 of every match, gain 1 gold."

### 4. Conditional triggers

React to in-match events.

- "When you put the opponent in check, draw a card."
- "When you capture an enemy piece, gain 1 energy this turn."
- "On the first capture of every match, place a wall on a chosen square."

The trigger / piece-modifying / energy-modifying / card-modifying split is a useful taxonomy when designing new artifacts and when balancing power level by category.

## Artifact pool sizing

For the prototype, target roughly:

- 12–18 commons
- 8–12 uncommons
- 6–10 rares

Smaller than a final design, large enough to feel different across runs. Refine after playtesting.

## Removing / selling artifacts

There is **no mechanic for selling artifacts** in the prototype. The only way to lose an artifact is to refuse one or to be displaced from the 5-slot cap. (Compare Balatro, which lets you sell jokers — we may add this if it improves the loop.)

## UI

Artifacts live in a **persistent sidebar** during matches and in the run-overview screen between matches. Hovering an artifact shows its full description. Active triggers should briefly flash when they fire (the player should always be able to tell *what* triggered).

## Artifact balance principles

- Common artifacts should rarely change strategy; they nudge.
- Uncommon artifacts should reward existing strategy.
- Rare artifacts should *enable* a strategy (a deck that wasn't viable before now is).
- No single artifact should be the obvious "always pick" — pickability depends on deck.
- Avoid artifacts that grant *both* unconditional power and combo potential. Pick a lane.

## Examples (sketch only — not the final list)

- *Common:* "The first time each match you play a card, gain 1 gold."
- *Common:* "Hand size +1."
- *Uncommon:* "Your knights may move 1 square diagonally instead of their L-shape, once per match."
- *Uncommon:* "When you draw a 0-cost card, draw 1 more."
- *Rare:* "Pawns promote on rank 6."
- *Rare:* "Whenever you cast a Spatial card, also place a wall on a random unoccupied square within 2 squares of the target."

These are illustrative, not committed. Final list lives in code (data files) and is subject to extensive playtesting.
