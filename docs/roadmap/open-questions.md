# Open Questions

Things that are deliberately undecided, deferred, or marked TBD in the design docs. When you make a decision while implementing, **move the resolved item from this file into the appropriate design doc** in the same commit.

Loosely grouped by topic.

## Cards / energy / hand

- **Starter deck shape.** While the card pool is still small the starter deck is "one of every card in the library" (currently 19 cards) — see [`docs/cards/starter-deck.md`](../cards/starter-deck.md). Once drafts and the shop start contributing copies, this should narrow to a focused subset (8–12 commons) and the rest become draftable. The exact subset is TBD.
- **Card upgrades.** Currently cut from the prototype. Reconsider after basic loop is working: do we want a shop service or a card-tier system that lets cards become stronger versions of themselves?
- **Reactions on opponent turn.** Currently disallowed for all cards. Likely to revisit once base play feels good — having "interrupt" cards (e.g., "when an enemy moves to a square adjacent to your queen, freeze that piece") would deepen the design but is non-trivial.
- **Card art.** Plain text-only cards in the prototype. Add visual identity later as a polish pass.
- **End-of-turn cards.** Should there be cards that explicitly trigger at end of turn (vs the start)? Decide when first end-of-turn card is designed.

## Pieces / Skirmish

- **Exact starter roster composition.** Currently "king + 2 pawns + 2 minors" — should the 2 minors be (KN+B), (2 KN), (2 B), or player-chosen? Default: knight + bishop. Revisit after first-Skirmish playtests.
- **AI army scaling curve.** How does the opponent's army grow across the 9 matches in Skirmish? Need a concrete curve. Starting suggestion: match 1 = 8 pieces, match 9 = 16 pieces. Tune through play.
- **Pieces in shop.** Currently NOT sold in shop. Reconsider if drafts feel too random.
- **Permanent piece death.** Currently captured pieces revive next match. Persistent piece loss is filed as a candidate Ascension modifier (`progression.md`).
- **Pawn-only restriction on rank 2.** Strictly required, or relaxable? Default: pawns on rank 2 only.
- **Promotion as roster growth.** Currently promotion is match-only and doesn't add to roster. Worth revisiting: an artifact that says "promoted pieces persist" would be a unique build axis.
- **Fairy pieces.** Could we unlock non-standard piece types over time (e.g., archbishop, chancellor)? Out of MVP. Note for post-prototype design.

## Board / overlays

- **Stacking limits.** Currently: 1 wall per square, 1 square effect per square (overwrites), unlimited zone buffs. Verify after playtest.
- **Wall durability.** Currently most walls are timed (2–4 turns). Should permanent walls be more or less common?
- **"Hazard" squares vs "buff" squares.** Should the design distinguish these explicitly in the UI? Currently they're both "square effects" with different colors.
- **Pre-placed terrain in normal matches.** Currently only bosses use pre-placed hazards. Should occasional normal matches also feature them as variety? (Would require a "match modifier" pool similar to bosses.)

## Artifacts

- **Artifact pool size.** Currently target 12–18 commons, 8–12 uncommons, 6–10 rares. Verify whether this provides enough variety.
- **Selling artifacts.** Currently no sell mechanic. Consider after seeing how often the cap-displacement choice is painful.
- **Artifact-only pack type.** Should the shop offer "artifact booster packs" alongside card packs? Decided no for prototype; revisit.

## Bosses

- **Final boss specifics.** The Boss C sketch in `bosses.md` is a starting point; the real finale design is the most labor-intensive single piece of content and will iterate the most.
- **Multi-phase bosses.** Out of scope for prototype but interesting. Boss C as a finale could split into a "phase 1 / phase 2" with the phase 2 triggered by specific conditions (e.g., "when boss has fewer than 8 material points, transition").
- **Boss-pool variants.** Currently 3 fixed bosses. Adding 1–2 alternate bosses per act would massively boost replayability — defer to post-MVP.
- **Boss preview detail.** The act-start preview shows modifier + curse pool. Should it also show hazards? Decision: yes — players should be able to plan against everything.

## Economy / shop

- **Skip-bonus values.** Need concrete numbers for early/mid/late acts. Tune through play.
- **Reroll cost curve.** Linear (1, 2, 3, ...) or steeper (1, 3, 6, ...)? Default linear.
- **Card removal cost curve.** Should grow but not punishingly. Default 50, 75, 100, 125, 150 ...
- **Pack pricing vs single cards.** Are packs always better gold value? Should they be? Decide once we have a sense of the card pool.
- **Vouchers / permanent shop upgrades.** Cut from prototype. Consider re-adding once the base shop loop is established.

## Progression / meta

- **Ascension modifier ladder.** A1–A8 sketches in `progression.md` are illustrative. Real ladder depth and ordering are TBD; iterate as players reach higher Ascensions.
- **Per-mode Ascension records.** Confirmed yes (Royal and Skirmish track separately).
- **Cosmetic theme skins (cosmic, clockwork, fantasy).** Out of prototype scope. Designed-for in `theme.md` as a future overlay system.
- **Daily / weekly challenges.** Cut from MVP. Re-add when the seed/RNG system matures.
- **Multiple characters / decks.** Single character only for MVP. Slay-style multiple-character expansion is a possible post-prototype direction.
- **Achievement system.** Out of MVP scope.

## Multiplayer

- **Multiplayer at all.** Cut from prototype scope. Mentioned in `overview.md`. Revisit only if there's demonstrated interest after the single-player prototype lands. If revived, async PvP (deck vs deck, bot-vs-bot resolved) would be the lightest-touch entry.

## Technical

- **State management library.** Resolved: ship M0–M4 on React `useState`; adopt Zustand at M5 when run state crosses screens. See `docs/technical/stack.md`.
- **CSS approach.** Resolved: CSS modules. May switch to Tailwind later if authoring slows iteration; no current pressure.
- **Stockfish skill levels vs depth.** Default: depth-tuned only. Skill-level option is an additional knob if depth scaling is too coarse.
- **Walls in Stockfish.** Resolved: UCI `searchmoves` filter restricts the AI to our wall/freeze-aware legal-move set; Stockfish never sees overlays. `engine.move()` re-validates as a defensive fallback. See `docs/technical/chess-integration.md`.
- **Save format versioning.** Default: simple `version: number` integer. Migration policy: forward-only, fail-soft on incompatibility (drop saved run, preserve meta).
- **Web Worker placement of curse-AI.** Default main-thread. Move to worker only if profiling shows a problem.

## UI / UX

- **End-turn button.** Is "end turn" an explicit button or implied by making your move? Default: explicit "End Turn" button. Players may want to play cards after their move.
- **Card-play affordance.** Drag from hand to target, or click-to-pick-up + click-to-target? Default: click + click (simpler implementation, accessible).
- **Hand overflow.** Currently hand cap is 5 but curses can push it to 6+. Should the UI fan or stack cards in this case?
- **Reward / shop screen layout.** TBD by mockup.

## Misc / cross-cutting

- **Tutorial / onboarding.** Out of MVP. Consider a "first-run" mini-tutorial after content is stable.
- **Audio.** No music in MVP. Consider after gameplay is locked.
- **Debug tools.** Resolved: shipped as the **Sandbox** dev mode (board editor, free card library, optional AI, action-granular undo/redo). See `docs/technical/dev-mode.md`. M5 will likely add gold / artifact / boss debug toggles to the same panel.
- **Version display.** Show a small build version somewhere in the UI. Lets us reproduce reported bugs.

## UI / UX (continued)

- **End-turn button.** Resolved: making a chess move ends the turn. Cards must be played BEFORE the move. No explicit End-Turn button — see `docs/technical/architecture.md`.

## Card-design follow-ups

Deferred from the cycling + Retain/Consume redesign. Not blocking, but worth revisiting after some playtest miles.

- **Card naming.** 5 card ids remain placeholders: `cheap-destroy`, `big-destroy`, `vine-pull`, `recall`, `recover`. Pick final names that fit the theme (see `docs/design/theme.md`).
- **1-cost utility under cycling.** With cycling, 1-cost disruption (Freeze Process, chroot, Read-Only, Encrypted, Firewall) is potentially spammable: the player will see those cards multiple times per match. Watch the first end-to-end playtest for whether the spam is dominating the chess game, and consider bumping a few to cost 2 or sprinkling Consume.
- **Bookmark placement and rarity.** Bookmark is currently Uncommon and lives in the draft/shop pool only. If it turns out the prototype needs more end-of-turn agency from turn one, consider seeding one Bookmark in the starter deck.
- **Restore from Backup's pile.** Restore from Backup currently pulls from the discard pile only. A more ambitious ("dig anything back") version that could pull from the consumed pile would dramatically change Consume's contract; only revisit if Restore from Backup feels too weak.

## Process

When you resolve an open question, add a brief commit message note ("resolves OQ: starter deck composition") and move the resolved entry **out** of this file and **into** the relevant design doc. Don't leave stale entries here.
