# Progression

This doc covers two things: the **run flow** (what happens between matches within a single run) and **meta-progression** (what carries between runs).

## Run flow

A run is a linear sequence of 9 matches across 3 acts:

```
Act 1: Match 1 → Match 2 → Match 3 (Boss A)
Act 2: Match 4 → Match 5 → Match 6 (Boss B)
Act 3: Match 7 → Match 8 → Match 9 (Boss C, finale)
```

There is **no branching map**. After each match, the player follows the same flow:

```
MATCH ENDS (player wins)
   ↓
[BOSS MATCHES ONLY] REWARD STEP
   ├─ Boss boon (3 fixed options: +1 energy/turn, +1 draw/turn, delete 2 cards)
   ├─ Boss artifact pick (1 of 3 from the boss-tier pool, or skip for gold)
   └─ Gold reward (boss win bonus + performance bonuses)
   ↓
SHOP STEP
   ├─ Single cards / booster packs / artifacts (rotating inventory)
   ├─ Reroll service (scaling per shop visit)
   ├─ Card removal service (scaling per use)
   ├─ Interest tally at shop close: +1 gold per 5 saved (cap +5)
   └─ "Continue" → next match
   ↓
NEXT MATCH BEGINS
```

Non-boss wins skip the reward step and go straight to the shop. **All cards are acquired in the shop** (singles + booster packs); there is no post-match card draft. Capturing an enemy piece during a match still grants energy equal to the piece's chess value.

## Single-elimination

The run ends if the player **loses any match** (checkmate against, stalemate, or any draw rule firing). There is no HP system, no lives, no second chance.

This is intentional: it makes every match meaningful and forces players to play tight chess. The roguelite tension comes from the build-up over a run that can be lost in a single misstep.

If the player **wins the act-3 boss**, the run is **won**. Run-win triggers content unlocks (see meta-progression below).

## Run length and pacing

A run targets **30–60 minutes** of total play time (highly variable based on player and chess pace, since there is no clock). Decisions per run:

- 9 chess matches.
- 9 piece-draft choices (or skips) — Skirmish only.
- 9 shop visits, each with reroll, buy, and removal sub-decisions (all card acquisition flows through here).
- 3 boss boon picks + 3 boss-artifact choices.

This rhythm should feel snappy and not bloated. UI choices that minimize between-match friction are valued.

## Meta-progression

Meta-progression in Chess Hacker is **content-unlocks only**. There are **no persistent power buffs** that make subsequent runs easier.

### What unlocks

- New cards joining the card pool.
- New artifacts joining the artifact pool.
- New piece types? (Open question; the prototype starts with the standard chess pieces only. We may unlock "fairy" pieces later — see `roadmap/open-questions.md`.)
- New boss variants? (Open. The prototype starts with 3 fixed bosses.)
- Cosmetic skins / themes for the abstract minimalist aesthetic.

### What does NOT unlock

- ❌ No starting energy / hand-size buffs that persist *across* runs.
- ❌ No starting gold buffs.
- ❌ No "your starter deck improves" buffs.
- ❌ No multiple characters / decks (single character only — see `overview.md`).

(The boss-reward boon pick — +1 energy/turn, +1 draw/turn, delete 2 cards — is intentionally a permanent buff *within* a run. It is not meta-progression and resets when the run ends. See `bosses.md` for the post-boss reward flow.)

The intent: every run starts equal in power. Long-tail engagement is content variety + build exploration, not power creep.

### Unlock pacing

Unlocks tied to first-time achievements:

- Win your first run → unlock a few new commons.
- Win with X different builds → unlock a rare card.
- Defeat each boss → unlock a piece of variant content tied to that boss.

Specific unlock list TBD — see `roadmap/open-questions.md`.

## What this all enables

The progression system is intentionally minimalist. The player's progress story is:

1. **Learn the game.** Win a Royal run.
2. **Try Skirmish.** Win a Skirmish run.
3. **Explore builds.** As more cards/artifacts unlock, try wildly different builds.

There is no level-100 grind. There is no daily forced login. The game respects the player's time.
