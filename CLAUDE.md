# CLAUDE.md

Guidance for AI agents working in this repository.

## Project: choss

A single-player chess + cards + roguelite + deckbuilder. Inspirations: Slay the Spire, Balatro, classical chess. Web prototype, single-player only.

## Where to find what

When you start work, **read `docs/README.md` first** — it is the index for everything.

| If you need...                                  | Read                                                              |
|-------------------------------------------------|-------------------------------------------------------------------|
| The big picture                                 | `docs/design/overview.md`                                         |
| Game modes (Skirmish vs Royal)                  | `docs/design/modes.md`                                            |
| How cards / energy / hand work                  | `docs/design/cards.md`                                            |
| How pieces are drafted and placed               | `docs/design/pieces.md`                                           |
| Board overlays (walls, zones, square effects)   | `docs/design/board.md`                                            |
| Artifacts / relics                              | `docs/design/artifacts.md`                                        |
| Gold, shop, interest, pricing                   | `docs/design/economy.md`                                          |
| Bosses (3 hand-crafted)                         | `docs/design/bosses.md`                                           |
| Run flow + meta-progression (Ascension)         | `docs/design/progression.md`                                      |
| Chess rules (standard + custom extensions)      | `docs/design/chess-rules.md`                                      |
| Visual / audio direction                        | `docs/design/theme.md`                                            |
| Tech stack and rationale                        | `docs/technical/stack.md`                                         |
| Code architecture / state model                 | `docs/technical/architecture.md`                                  |
| chess.js integration + rule extension layer     | `docs/technical/chess-integration.md`                             |
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

## Tech reminders

- Stack: TypeScript + React (Vite) + chess.js + Stockfish.wasm + localStorage. See `docs/technical/stack.md` for rationale.
- The game is single-player only; do not add multiplayer scaffolding (`docs/design/overview.md` records this).
