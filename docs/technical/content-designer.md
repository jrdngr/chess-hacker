# Content Designer

A sibling browser app in the same repo for authoring cards, artifacts, bosses, and named decks. Lives at `src/designer/` and runs on its own Vite port (5174) so it doesn't share localStorage with the game (different origin).

## Running

```sh
just content      # or: npm run dev:designer
```

The game stays on port 5173 (`just run` / `npm run dev`); the designer lives on 5174.

## Tabs

- **Cards** — schema-driven editor for every card in `src/game/cards/data/*.json` plus any user-created cards. Forms generated from the validators in `src/game/cards/library.ts`.
- **Artifacts** — same pattern over `src/game/artifacts/data/*.json`.
- **Bosses** — same pattern over `src/game/bosses/data/*.json`, with a click-to-toggle 8×8 grid for `hazardWalls` / `voidSquares` and a curse-schedule list whose `curseId` dropdown is populated from cards marked `curse: true`.
- **Decks** — compose named decks from any cards in the library (game-defined and user-created) and write them to disk.

## State

Persisted to `localStorage["choss:content-designer:v1"]`. Top-bar actions:

- **Export full state** — downloads `choss-content-state.json` containing every card, artifact, boss, and deck the designer knows about.
- **Import full state** — restore the workspace from a previously exported file.
- **Reset library snapshot** — re-pull library entries from the running source tree (preserves user-created items and decks). Useful after editing the game's source JSON outside the designer.

Each editable entry is tagged `source: "library"` (snapshotted from the game's runtime libraries on first launch / reset) or `source: "user"` (created in the designer). The list view shows a `●` next to modified entries and a `USER` tag on user-created items.

## "New" property markers

For known extension points the designer can introduce a brand-new value via the **+ Add new value…** option in the dropdown:

| Path                       | Where it appears                              |
|----------------------------|-----------------------------------------------|
| `card.archetype`           | Cards tab → archetype picker                  |
| `card.target.kind`         | Cards tab → Target → target.kind              |
| `card.effect.kind`         | Cards tab → Effect → effect.kind              |
| `artifact.effect.kind`     | Artifacts tab → effect[i].kind                |
| `boss.modifier.kind`       | Bosses tab → modifier.kind                    |

Adding a new value asks for an identifier, a free-text description (mandatory — the implementing agent reads it), and an optional list of payload field descriptors (`name` / `type`). The annotation is stored on the entry under `newProperties`. Per-item exports include a top-level `__designerNew` array; full-state exports embed it inside each entry.

## Per-item export format

Each editor's per-item **Export JSON** button downloads a file byte-compatible with the game's `data/` directories (so dropping it into `src/game/cards/data/` works directly), with one optional addition: a top-level `__designerNew` key listing any new-property annotations the entry carries.

```json
{
  "id": "frostfire",
  "name": "Frostfire",
  "cost": 3,
  "rarity": "uncommon",
  "archetype": "disruption",
  "description": "Freeze and burn the target.",
  "target": { "kind": "enemy-piece" },
  "effect": { "kind": "freeze-and-burn", "burnDuration": 2 },
  "__designerNew": [
    {
      "path": "card.effect.kind",
      "value": "freeze-and-burn",
      "description": "Freezes target and applies burn for N turns",
      "payloadFields": [{ "name": "burnDuration", "type": "number" }]
    }
  ]
}
```

A downstream agent should:

1. Read `__designerNew` to discover any new identifiers the engine doesn't yet support.
2. Extend the relevant union types in `src/game/types.ts` and the validators in `src/game/{cards,artifacts,bosses}/library.ts`.
3. Wire the new behaviour into the resolvers (`src/game/cards/match.ts` for card effects, `src/game/artifacts/effects.ts` for artifact effects, etc.).
4. Strip the `__designerNew` key and drop the JSON into the appropriate `data/` directory.

## Named decks → game

The designer's Vite dev server registers a single endpoint, `POST /__designer/decks`, that writes the deck JSON to `src/game/cards/decks/named/<slug>.json`. The slug is the deck name lowercased with non-alphanumerics collapsed to `-`.

This endpoint is only registered in `vite.designer.config.ts` — the game's dev server does not expose it.

The game picks up the directory via `getNamedDecks()` (see `src/game/cards/library.ts`), which uses `import.meta.glob`. Vite HMR reloads the affected module when files appear or change, so a deck written by the designer becomes available in the game without a manual refresh.

In the game, open the dev panel (Sandbox mode, or the Dev tab in a run) → Deck → the **Named decks** section lists every deck under `src/game/cards/decks/named/`. Clicking **Load**:

1. Replaces the run's `deck` (so the change persists into the next match).
2. Replaces the current match's `drawPile` and clears `discardPile` and `consumedPile`.
3. Leaves `hand` untouched (cards already in play stay in play).
4. Pushes a snapshot for undo.

## Adding a new content type

To extend the designer with a new content category (e.g. boosters), follow the existing pattern:

1. Add a `data/*.json` directory to the corresponding `src/game/<type>/` folder, plus a `validate<Type>()` function and JSON-glob loader (mirror cards/artifacts/bosses).
2. Export the canonical `VALID_*` arrays from that library file.
3. Add a new `Designer<Type>Entry` shape in `src/designer/state/types.ts`, hydrate it in `src/designer/state/seed.ts`.
4. Build a `<Type>Editor.tsx` under `src/designer/editors/`, mirroring the existing two-pane + schema-driven-form pattern.
5. Add a tab in `src/designer/App.tsx`.
