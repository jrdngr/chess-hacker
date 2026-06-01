# Artifacts

Artifacts (Slay-the-Spire "relics" / Balatro "jokers") are the **second persistent power layer** of a run. While cards live in your deck, artifacts sit in a sidebar and apply their effects passively or as triggers. They define your build alongside your deck.

## Acquisition

Artifacts are acquired from exactly two sources in the prototype:

1. **Boss rewards.** Each boss win grants a 1-of-3 artifact choice from a boss-tier (rare) artifact pool. 3 bosses → up to 3 boss artifacts per run.
2. **Shop.** The shop offers artifacts among its rotating inventory (alongside single cards and booster packs). Shop artifacts are typically common or uncommon; rares appear occasionally.

Artifacts are **not** part of regular post-match drafts. Drafts give cards (and pieces in Skirmish) only.

## Slots and capacity

The player can hold up to **20 artifacts** at any time. When the player would acquire one beyond the cap:

- The acquisition flow asks the player to choose: take the new artifact (and discard one of the existing artifacts), or refuse the new artifact.
- Discarded artifacts are removed for the rest of the run; they do not return.

The slot cap is a tuning knob. Specific artifacts may raise the cap (rare).

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

- "Spatial cards cost 25% less (round down, minimum 0)."
- "The first card you play each turn costs 2 less (minimum 0)."
- "Draw an extra card at the start of each turn."

### 2. Piece-related

Modify how the player's pieces behave globally for the rest of the run.

- "Your knights may also step 1 square in any direction."
- "Your pawns promote at rank 7 (instead of 8)."
- "When one of your pawns reaches rank 4, draw a card."

### 3. Resource / match-rule

Modify the match's resources or rules.

- "Start each match with 3 energy instead of 0."
- "Hand size +1."
- "On turn 1 of every match, gain 1 gold."

### 4. Conditional triggers

React to in-match events.

- "When you put the opponent in check, draw a card."
- "When you capture an enemy piece, gain 1 bonus energy."
- "On the first capture of every match, place a wall on a chosen square."

The trigger / piece-modifying / energy-modifying / card-modifying split is a useful taxonomy when designing new artifacts and when balancing power level by category.

## Artifact pool sizing

For the prototype, target roughly:

- 12–18 commons
- 8–12 uncommons
- 6–10 rares

Smaller than a final design, large enough to feel different across runs. Refine after playtesting.

## Removing / selling artifacts

There is **no mechanic for selling artifacts** in the prototype. The only way to lose an artifact is to refuse one or to be displaced from the slot cap. (Compare Balatro, which lets you sell jokers — we may add this if it improves the loop.)

## UI

Artifacts live as **emoji badges in the top banner** of the run, persistent across match / reward / shop / summary screens. Each artifact has a unique emoji chosen to evoke its name or effect. Hovering a badge shows the artifact's name and full description. Active triggers should briefly flash when they fire (the player should always be able to tell *what* triggered).

## Artifact balance principles

- Common artifacts should rarely change strategy; they nudge.
- Uncommon artifacts should reward existing strategy.
- Rare artifacts should *enable* a strategy (a deck that wasn't viable before now is).
- No single artifact should be the obvious "always pick" — pickability depends on deck.
- Avoid artifacts that grant *both* unconditional power and combo potential. Pick a lane.

## Current pool (post power-curve overhaul)

The prototype's artifact pool sits at **27 entries** (7 common, 12 uncommon, 8 rare) — within the target range above. The full list:

> **"Capture" for on-capture artifacts means a chess-move capture only.** Bug
> Bounty and Keylogger fire when one of your pieces captures by moving onto an
> enemy piece. Destroying enemy pieces with a *card* (Garbage Collect, Self
> Destruct, Heartbleed, …) does **not** trigger them — card kills still count
> toward capture-payoff effects like Heartbleed's `gain-energy-per-capture`,
> but never toward on-capture artifacts. (Implemented via
> `recordCardDestruction` in `src/game/cards/match.ts`; see CH-006.)

**Common (7)**
- *Bug Bounty:* When you capture an enemy piece, gain 1 energy this turn.
- *Keylogger:* When you capture an enemy piece, draw 1 card.
- *Polished Bishop* (default starting artifact for Standard mode): Your bishops may also step 1 square in any direction (king-step) in addition to their diagonal slides. The granted ortho-step is non-capturing — bishops still capture only on their diagonal slides.
- *Pawn Storm:* Your pawns may double-push from any rank, not just the start rank.
- *Drill Sergeant:* Your pawns may move 1 square backward (no capture).
- *War Chest:* Start each match with +20 gold. (Economy ramp — buy bigger, sooner.)
- *Toolkit:* Resource cards cost 1 less (minimum 0).

**Uncommon (12)**
- *Threat Detector:* When you put the opponent in check, draw 1 card.
- *Scavenger:* Whenever you sacrifice one of your own pieces, gain 2 energy. (Anchors the sacrifice archetype — pairs with Martyr Protocol, Self-Destruct, Buffer Overflow.)
- *Foothold:* Hand size +1 while you have a friendly piece on a center square (d4 / e4 / d5 / e5 on 8×8; the central 2×2 on even-sized boards, the single middle square on odd).
- *Map Editor:* Spatial cards cost 25% less (round down, minimum 0).
- *Cavalry Doctrine:* Your knights may also step 1 square in any direction in addition to the L-shape. The granted king-step is non-capturing — knights still capture only on the L-shape.
- *Promotion Engine:* Your pawns promote at rank 7 instead of rank 8.
- *Build Pipeline:* Movement cards cost 1 less (minimum 0).
- *Sysadmin Token:* Disruption cards cost 1 less (minimum 0).
- *Quartermaster:* Sacrifice cards cost 1 less (minimum 0).
- *Stopwatch:* Tempo cards cost 1 less (minimum 0).
- *Mainframe:* Hand size +1 (unconditional).
- *Trapsmith:* Your Walls, Traps, and square marks (Beacon / Repulsor) last 2 extra turns. (Spatial anchor.)

**Rare (8)**
- *Sniper Optics:* Your rooks may capture an enemy piece even with one wall in the path between attacker and target. Movement to empty squares past a wall is still blocked.
- *Phalanx:* At the start of your turn, every friendly piece orthogonally adjacent to another friendly piece is shielded until your next turn.
- *Hive Mind:* Summon cards cost 2 less, and the first pawn you summon each turn gains Shield until your next turn. (Anchors the summon archetype — pairs with Fork, Reinforce, Swarm Protocol.)
- *Zero-Day:* When you put the opponent in check, gain 3 energy. (Aggressive tempo payoff.)
- *Compound Interest:* At the start of your turn, gain 1 energy per 6 energy banked (max +3). Rewards saving the persistent energy pool.
- *Cryostasis:* Your Freeze / Root / Disarm / Downgrade effects on enemy pieces last 1 extra turn. (Disruption anchor — pairs with chroot, Freeze Process, Quarantine.)
- *Demolition Charge:* Burst cards cost 25% less (round down, minimum 0). (Enables Format C: / Garbage Collect haymakers sooner.)
- *Loadbalancer:* At the start of your turn, if you hold more of the center 2×2 than the opponent, draw 1 card and gain 1 energy. (Rewards contesting the center — pairs with Power Node / Foothold.)

The "piece-related" effect domain — flagged earlier in this doc as a design goal — is now wired up via the `piece-rule-modifier` artifact effect (see `src/game/types.ts`). Six modifier kinds cover the current pool: pawn-double-from-any-rank, pawn-backward-step, pawn-promotion-rank, piece-empower-all, rook-attack-through-wall, and phalanx-adjacent-shield.

Beyond piece-rules, the pool now exercises the trigger / resource domains with on-check energy (Zero-Day), banked-energy interest (Compound Interest), on-sacrifice energy (Scavenger), status- and overlay-duration bonuses (Cryostasis, Trapsmith), and per-archetype cost discounts spanning resource / sacrifice / tempo / movement / spatial / disruption / summon / burst.
