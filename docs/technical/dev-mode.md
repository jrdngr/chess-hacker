# Dev Mode (Sandbox)

The **Sandbox** is the development testing surface — a permanent tool, not a stepping-stone toward the real game. It exists so designers / agents can poke at any board state, any card, any AI configuration without going through a run.

Reach it via `App.tsx`'s mode menu → **Sandbox**. Code-side this mounts `<Match runMode="dev" />`.

The same panel is also available **inside a real Royal run** — a thin "Dev" tab on the right edge of the match view toggles it open. When closed it is fully unmounted, so no dev-only state leaks into the run. Opening it in a run defaults the AI to "on" (so the match still plays normally); the player can flip it off via the panel to drive both sides for debugging.

## What it gives you

- **Board editor.** Click a piece in the palette to "load" a brush, then click a square to place / overwrite. Click "Erase" then a square to clear it. Drag from the palette directly to a square as a shortcut. Editor edits do not flip the side to move; use the side-to-move toggle for that.
- **Resizable board.** Independent file (3..8) and rank (3..8) pickers — any rectangle from 3x3 to 8x8 is allowed. Resizing drops pieces that no longer fit on the new board and clears per-piece statuses (the squares may have moved out of bounds). The AI is Fairy-Stockfish, which plays non-8x8 boards natively via variants (`variantFor` in `src/ai/stockfish.ts` maps 8x8 → built-in `chess` and 6x6 / 7x7 → the `chess-hacker6x6` / `chess-hacker7x7` variants declared in `public/fairy-stockfish/variants.ini`). For any other rectangle there's no declared variant, so the engine can't search and `useAiLoop` falls back to playing a random legal move — there is no separate toy-AI implementation.
- **Live position validation.** After every change to the board (place / remove / move piece, side-to-move toggle, size change), the editor re-runs `validatePosition` and updates highlights. The board gets a red outline and offending pieces tint red. The panel lists every violation in plain English. Validation rules (see `src/game/chess/validate.ts`):
  - Each side must have exactly one king.
  - The two kings cannot be on adjacent squares.
  - No pawn on rank 0 or rank `ranks - 1` (back ranks).
  - The side **not** to move cannot already be in check (only the side to move may be).
  - The editor flags invalid positions but **does not block** edits — odd positions can still be set up (a dev might be reproducing a bug).
- **Standard start / Clear** buttons. Standard start sets up the canonical 8x8 opening position (also resizes back to 8x8 if needed); Clear empties the board entirely (kings included — useful for stress-testing edge cases).
- **Side-to-move toggle.** Forces white or black to move next without playing a move.
- **Energy controls.** Bump energy ±1; useful for testing high-cost cards.
- **Optional AI.** "AI on" switches the dev sandbox into the same AI loop the prototype uses (Fairy-Stockfish, with the variant chosen per board size) so you can play against the AI from any custom position. Off by default — most editor work doesn't want the AI replying.
- **Card library overlay.** Browse the full card library grouped by archetype. Drag a card onto the board (or click "Play") to play it for free — energy is restored after the play resolves and the card is scrubbed from the consumed pile, so you can experiment with sequences without permanent state cost.
- **Load named deck.** The Deck overlay lists any decks authored in the [Content Designer](./content-designer.md) (written to `src/game/cards/decks/named/*.json`). Clicking **Load** replaces the run's deck and the current match's draw / discard / consumed piles wholesale; the hand is left untouched.
- **Chess-vision overlay.** Toggle to colour squares by attacker side: blue (player only), red (opponent only), purple (both). Helpful for spotting threats and overworked defenders.
- **Action-granular undo / redo.** Snapshots are pushed at each turn rollover *and* at each editor edit, energy bump, library card play, or resize. Undo rewinds across that whole stream — including across the AI's preceding move. Redo replays. The stack is unbounded. When the AI is on, mid-turn snapshots (player chess move, card play) are skipped so one undo rewinds the entire player→AI cycle to the player's previous turn start. Undo/redo remain enabled after checkmate / stalemate so the player can rewind out of a losing line.

## What it deliberately does not have

- No win / loss screen — the sandbox doesn't end. (`outcome` is still computed and rendered for inspection, but doesn't gate anything.)
- No run state, gold, artifacts, or shop. Dev mode is pure match-state experimentation.
- No card-draft prompts — the deck stays whatever the dev panel + library card plays produce.

## Architecture

Match.tsx holds the core match state directly (`engine` and `cardState` as local `useState`) and composes a set of hooks from `src/components/Match/`: `usePlacement`, `useAiLoop`, `useCardPlay`, `useBoardInteraction`, `usePlayerAnalysis`, and `useUndoRedo`. Two further hooks own the dev surface:

- `useDevEditor` — the editor's continuous-interaction state: which brush is loaded, edit-mode reposition, the in-flight palette / piece drags, and the per-edit handler `applyEditorEdit` (which scrubs per-piece statuses on edited squares).
- `useDevSandbox` — the one-shot dev actions that reseed or mutate a scenario: `clearBoard`, `standardStart`, `bumpEnergy`, `playLibraryCard`, the deck / artifact editor saves, skip-match-and-win, and the side-to-move toggle.

Snapshots that drive undo/redo capture engine + card state together (`{engineSnapshot, cardState}`) — see `useUndoRedo.ts`. When run state lands in M5 the snapshot model will need to extend (so undo across a shop spend is sensible), but match-only undo today is correct.

The DevPanel component (`src/components/Match/DevPanel/index.tsx`, with its overlays in the same folder) is purely presentational; all state belongs to `useDevEditor` / `useDevSandbox` and is passed down as props.

## When to extend it

- Add new dev controls to `useDevEditor` / `useDevSandbox` (state + actions) and `DevPanel/index.tsx` (UI).
- M5 will likely grow it with run-side debug toggles (give yourself gold, force a specific reward, etc.) — those should mount only when a run is in progress, on the same panel.

## Why it exists

Hand-authored match scenarios are essential for tuning cards, testing rule edge cases (walls, freezes, traps interacting weirdly), and reproducing reported bugs. The sandbox is the cheapest way to get there. Keep it working.
