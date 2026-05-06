# Persistence

The prototype uses **browser localStorage** as the only persistence layer. No backend, no IndexedDB, no service workers.

## What gets persisted

Two categories:

### 1. Meta state (across runs)

Persisted under key `choss:meta`. Survives all runs.

```ts
type MetaState = {
  version: number;             // schema version for migrations
  unlocks: {
    cards: string[];           // unlocked card IDs
    artifacts: string[];       // unlocked artifact IDs
    // any other content unlocks
  };
  ascensionRecord: {
    royal: number;             // highest ascension cleared in royal
    skirmish: number;          // highest ascension cleared in skirmish
  };
  stats: {
    runsStarted: number;
    runsWon: number;
    matchesPlayed: number;
    // optional: per-mode breakdown
  };
};
```

### 2. Active run (in-progress save)

Persisted under key `choss:run`. Cleared when the run ends (win or loss).

```ts
type SavedRun = {
  version: number;
  rngSeed: number;
  mode: "royal" | "skirmish";
  ascension: number;
  act: 1 | 2 | 3;
  matchInAct: 1 | 2 | 3;
  state: "preMatch" | "match" | "reward" | "shop";
  gold: number;
  deck: Card[];
  artifacts: Artifact[];
  roster?: Piece[];            // skirmish only
  match?: SavedMatch;          // present when state === "match"
  // shop, reward, drafted-cards: depending on `state`
};

type SavedMatch = {
  fen: string;
  overlays: { walls: Wall[]; squareEffects: SquareEffect[]; zoneBuffs: ZoneBuff[] };
  hand: Card[];
  drawPile: Card[];
  consumedPile: Card[];   // every played card lives here for the rest of the match
  energy: number;         // resets to 3 each turn; no banking
  turn: number;
  whoseTurn: Side;
  bossModifier?: BossModifier;
  curseSchedule?: CurseSchedule;
};
```

## Save points

The active run is saved:

- After each player move.
- After each opponent move.
- When entering a reward / shop / placement screen.
- When making a shop purchase.
- When taking a draft pick.

Saves are **synchronous JSON.stringify into localStorage**. Total size should stay under 100KB even at the largest. localStorage write is fast (<5ms) and not visible to the player.

If saves become a perf concern, debounce them (e.g., save only every N seconds), but for the prototype the simple every-action save is fine and bug-resistant.

## Resume on load

On app boot:

1. Load `choss:meta` (or initialize empty).
2. Load `choss:run` (if present, offer "resume" UI; otherwise show new-run UI).
3. If schema version mismatch, run migration or invalidate (see below).

## Schema versioning and migrations

Both keys store a `version: number`. Bump the version any time the schema changes incompatibly.

Migration policy:

- **Forward migrations:** small schema tweaks should ideally come with a migration function. Test with synthetic save data.
- **No migration available:** drop the saved run with an in-app warning ("Your save was from an older version and could not be migrated. Starting fresh.") — preserve `choss:meta` (unlocks).
- **Meta migrations:** for unlocks, prefer to never lose progress. Forward-migrate whenever possible.

## Card / artifact / boss data

These are NOT in localStorage. They are **shipped with the build** — `cards.json`, `artifacts.json`, `bosses.ts`, etc. (See `architecture.md`.)

Saved decks reference these by ID. On load, hydrate IDs back into full Card/Artifact objects.

If a saved run references a card ID that no longer exists in the build (we removed a card between versions), drop that card silently from the deck and continue. If too many references are missing (>10% of the deck), invalidate the saved run.

## Privacy and data

- **No personal data is collected or stored.** localStorage is purely local to the user's browser.
- **No analytics**, no third-party trackers, no telemetry.
- **No cloud sync.** The user's progress lives in their browser. If they clear their cache, they lose progress.

## Export / import (future)

A future nice-to-have: an "Export save" button that copies the meta JSON to clipboard, and an "Import save" textarea. Lets users back up their unlocks. Out of scope for the prototype.

## Multi-tab safety

If the user has the game open in two tabs, both are reading/writing the same localStorage. The simple defense: **the most recent save wins**. The active tab assumes it owns the save. This is acceptable for a single-player game; document it in the FAQ.

## Testing

- Unit-test the persistence adapter: serialize/deserialize round-trip, schema version migrations.
- Test resume: simulate quitting mid-match and reloading.
- Test corrupted save handling: simulate `JSON.parse` throwing and verify graceful fallback.
