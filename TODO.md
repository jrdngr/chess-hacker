# TODO

Design follow-ups deferred from the energy + card-disposal redesign. Not blocking, but worth revisiting after some playtest miles.

## Card naming

The 14 new card ids are placeholders: `cheap-destroy`, `big-destroy`, `improvise`, `trick-bag`, `mark-target`, `vine-pull`, `recall`, `recover`, `pace`, `hum`, `drift`, `shiv-strike`, `shiv-step`, `shiv-snag`. Pick final names that fit the theme (see `docs/design/theme.md`).

## Self-replicator balance

Pace and Hum at cost 1 may be too dominant — they're perpetual scry-1 / draw-1 cards. If playtest shows them oppressive, options: raise the cost, add a fatigue counter (each replication weakens or eventually stops), or cap replications per match.

## Drift's effect

Currently Drift is a 1-cost compound that walls a square for 1 turn and shuffles a copy of itself back into the deck. The minor positional utility is a placeholder. Candidates for a swap-in: tag a piece for +1 movement next turn, briefly reveal opponent threats. Pick after seeing how Pace and Hum feel.

## Shiv-pool roster

Three shivs (`shiv-strike`, `shiv-step`, `shiv-snag`) is an arbitrary starting point. Tune the pool size and per-shiv effects in playtest. Goal: each shiv should be useful but unspectacular — the value comes from getting three at once via Trick Bag.
