# CLAUDE.md

Guidance for AI agents working in this repository.

## Project: Chess Hacker

A single-player chess + cards + roguelite + deckbuilder. Inspirations: Slay the Spire, Balatro, classical chess. Web prototype, single-player only.

## Where to find what

When you start work, **read `docs/README.md` first** — it is the index for everything.

| If you need...                                  | Read                                                              |
|-------------------------------------------------|-------------------------------------------------------------------|
| The big picture                                 | `docs/design/overview.md`                                         |
| Game modes (Skirmish vs Royal)                  | `docs/design/modes.md`                                            |
| How cards / energy / hand work                  | `docs/design/cards.md`                                            |
| Per-card reference + keyword definitions        | `docs/cards/` (see `docs/cards/README.md`)                        |
| How pieces are drafted and placed               | `docs/design/pieces.md`                                           |
| Board overlays (walls, zones, square effects)   | `docs/design/board.md`                                            |
| Artifacts / relics                              | `docs/design/artifacts.md`                                        |
| Gold, shop, interest, pricing                   | `docs/design/economy.md`                                          |
| Bosses (3 hand-crafted)                         | `docs/design/bosses.md`                                           |
| Status effects (replaces boss curse cards)      | `docs/design/status-effects.md`                                   |
| Run flow + meta-progression (Ascension)         | `docs/design/progression.md`                                      |
| Chess rules (standard + custom extensions)      | `docs/design/chess-rules.md`                                      |
| Visual / audio direction                        | `docs/design/theme.md`                                            |
| Tech stack and rationale                        | `docs/technical/stack.md`                                         |
| Code architecture / state model                 | `docs/technical/architecture.md`                                  |
| Chess engine (custom, wall-aware)               | `docs/technical/chess-integration.md`                             |
| Dev sandbox mode                                | `docs/technical/dev-mode.md`                                      |
| AI opponent (Stockfish.wasm + curse-AI layer)   | `docs/technical/ai.md`                                            |
| Save / load                                     | `docs/technical/persistence.md`                                   |
| Implementation milestones / what to build next  | `docs/roadmap/milestones.md`                                      |
| Things still TBD                                | `docs/roadmap/open-questions.md`                                  |
| Term definitions                                | `docs/glossary.md`                                                |

## Working principles

- **The docs in `docs/` are the source of truth for design intent.** If code disagrees with docs, treat docs as canonical and update the code. If a doc disagrees with a more recent decision, update the doc and call it out in the commit.
- Before adding a new design rule or mechanic, search `docs/` to see if it's already specified or contradicted.
- Open questions live in `docs/roadmap/open-questions.md`. Don't quietly invent answers in code — record decisions in the relevant design doc.
- Prefer editing the smallest, most specific doc. Cross-cutting changes should update both the local doc and `docs/glossary.md` if a term changes.
- This is a **prototype**. Favor simplicity, working code, and fast iteration over architectural purity.

## Branch policy

- Develop on `claude/chess-roguelite-deckbuilder-G70qQ`.
- Don't open pull requests unless explicitly asked.

## Source control

This repo uses [Jujutsu (`jj`)](https://github.com/jj-vcs/jj), not plain `git`, for source control.

- **Whenever a unit of work is completed, commit it** with `jj commit -m "<commit msg>"`. Don't batch unrelated changes into one commit.
- Only use these `jj` commands: `jj commit`, `jj new`, `jj describe`. Do not run any other `jj` subcommands (no `jj rebase`, `jj squash`, `jj abandon`, `jj git push`, etc.) — if something else seems needed, stop and ask.

## Tech reminders

- Stack: TypeScript + React (Vite) + custom chess engine (`src/game/chess/`) + Stockfish.wasm + localStorage. See `docs/technical/stack.md` for rationale.
- State management: per-match state in `src/components/Match.tsx` (+ sibling hooks under `src/components/Match/`); per-run state in `src/components/Run/Run.tsx`. Both are local `useState`.
- The game is single-player only; do not add multiplayer scaffolding (`docs/design/overview.md` records this).

## Pre-commit checks

CI (`.github/workflows/ci.yml`) runs on every push and pull request, and **all of these must pass**. After editing code, run them locally before reporting work complete or committing:

1. `npm run format` — auto-formats with Prettier. **Always run this after editing code** so `format:check` passes in CI.
2. `npm run lint` — ESLint.
3. `npx tsc --noEmit` — TypeScript type-check.
4. `npm test` — Vitest suite.
5. `npm run build` — production build (`tsc -b && vite build`).

If any step fails, fix the underlying issue before committing — do not bypass with `--no-verify` or by skipping checks. Treat a red CI run as a bug to fix, not noise to ignore.
