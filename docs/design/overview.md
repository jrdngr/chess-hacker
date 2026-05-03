# Overview

**choss** is a single-player roguelite deckbuilder built on a foundation of chess. Each run is a sequence of chess matches in which both sides play standard chess pieces with mostly-standard rules; the player additionally has a deck of cards that bend, break, or extend the rules of chess in their favor. Between matches the player drafts new cards (and, in Skirmish mode, new pieces) and visits a shop, building toward a unique deck and roster that can defeat the act-end bosses.

## Design pillars

1. **Chess is the core.** The board, the pieces, and the move set are recognizable chess. A player who understands chess should immediately understand 80% of what's happening. Cards modify chess; they don't replace it.
2. **Decks express identity.** Two players who reach the act-3 boss should have arrived with very different decks and pursued very different lines of play. Drafting and shop choices are the central self-expression mechanic.
3. **Every match has a story.** Cards introduce variance and combos — small board states should be able to explode into memorable swings. Bosses introduce constraints that force the player to use their deck differently.
4. **Short runs, replayable.** A run is bounded (9 matches across 3 acts). A single run finishes in one sitting. Replay value comes from build variety and the Ascension difficulty ladder, not from grinding.
5. **Single-player, prototype-first.** No multiplayer, no live ops, no asymmetric balance work. Tune for one player having a great time.

## The run loop (the macro view)

```
START RUN
  ├─ Act 1
  │    ├─ Match 1   → reward (card draft + gold [+ piece draft in Skirmish]) → Shop
  │    ├─ Match 2   → reward → Shop
  │    └─ Match 3 (Boss A) → reward (card + gold + artifact) → Shop
  ├─ Act 2
  │    ├─ Match 4   → reward → Shop
  │    ├─ Match 5   → reward → Shop
  │    └─ Match 6 (Boss B) → reward → Shop
  ├─ Act 3
  │    ├─ Match 7   → reward → Shop
  │    ├─ Match 8   → reward → Shop
  │    └─ Match 9 (Boss C — finale)
  └─ END RUN (win or loss)
```

- The path is **linear** — no branching map.
- **Lose any match → run ends.** No HP system, no second chances. Stalemate / draw also ends the run.
- After every match (including normal ones) the player gets reward choices, then shops, then plays the next match.
- Each act-end boss is hand-crafted, visible at act start so the player can plan, and grants an artifact reward.

See [`progression.md`](progression.md) for the post-match flow in detail and the Ascension/heat ladder.

## The match loop (the micro view)

A single match is a chess game with two augmentations:

1. The player's side has a **deck of cards** drawn from across the run. They start the match with 5 cards in hand and refill to 5 at the start of each of their turns.
2. The player gains **+1 energy per turn** (turn 1 starts at 1, unspent energy banks up to a cap of 10) to spend playing cards. Cards cost 0–10 energy. Every played card is removed for the rest of the match — no reshuffle.

On the player's turn, the player may **play any number of cards** (limited only by energy and hand contents), then make exactly one chess move. Cards are mostly played during the player's own turn, before or after the move; some specific card effects may target the move itself (e.g. "this turn, your knight may also move 1 square diagonally"). There are **no reactions** on the opponent's turn in the prototype.

The opponent (Stockfish.wasm at depth-tuned strength, plus a custom layer for boss curse-cards) plays standard chess plus any boss-specified rule modifiers. The opponent does **not** have a deck of cards in any current design.

A match ends when one side achieves checkmate (player wins / loses), is stalemated (draw, counts as loss), or any standard draw rule fires (50-move, threefold repetition).

See [`cards.md`](cards.md), [`chess-rules.md`](chess-rules.md) for details.

## Modes

There are two run modes the player picks at the start of a run:

- **Royal** — both sides start with standard chess armies (16 pieces each). Variety comes only from cards. Closer to "chess + spells".
- **Skirmish** — player starts with a small army (king + 2 pawns + 2 minor pieces). Drafts pieces between matches alongside cards. Player-places pieces on the board before each match. Closer to "chess + army builder + spells".

See [`modes.md`](modes.md).

## What this game is *not*

- Not a chess teacher / tutor. Players are assumed to understand basic chess.
- Not a chess variant in the FIDE-rules sense. We use chess as a substrate for a card game.
- Not multiplayer. No PvP, no leaderboards, no async play. Single-player only — see `roadmap/open-questions.md` for the multiplayer revisit gate.
- Not a long campaign. A run is short (9 matches); long-tail replay is the Ascension ladder + content-unlocks.
- Not an asset-rich game (for the prototype). The visual theme is **abstract minimalist** — geometric shapes and color, not illustrated art. See [`theme.md`](theme.md).

## Influences (recurring touchstones)

- **Slay the Spire** — deck-building, run shape, post-match reward draft, artifact (relic) layer. The major divergence: we have no branching map (Balatro-style linear progression instead).
- **Balatro** — shop-after-every-encounter rhythm, interest mechanic, skip-for-gold reward design, booster packs, single playable character at first.
- **Classical chess** — the board, the pieces, the rule baseline. We don't reinvent the chess board; cards layer on top.
