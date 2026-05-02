# Pieces & Placement

This doc covers the **piece economy** (Skirmish-only) and the **placement system** (mode-dependent: Royal uses fixed setup, Skirmish lets the player place).

## Skirmish: starting roster

A Skirmish run begins with a small army:

- 1 King (always)
- 2 Pawns
- 2 minor pieces (a "minor" is a knight or a bishop)

Total: 5 pieces. Specific minor-piece composition (KN+B, 2KN, 2B) is a tuning knob — see `roadmap/open-questions.md`.

This roster grows over the 9 matches by drafting pieces between matches.

## Skirmish: piece drafts

After each match (including bosses), the player is offered **1-of-3 pieces** to add to their roster. The draft happens in the post-match reward step alongside the card draft and gold reward.

### Rarity tiers

Pieces appear in drafts with weights based on their chess value. The base weighting:

| Piece     | Tier      | Relative draft frequency |
|-----------|-----------|--------------------------|
| Pawn      | Common    | High                     |
| Knight    | Common    | Medium-high              |
| Bishop    | Common    | Medium-high              |
| Rook      | Uncommon  | Medium-low               |
| Queen     | Rare      | Low                      |

Exact draw weights are tuning knobs. Implementations should keep them centralized so they can be tweaked without touching draft-flow code.

### Skip & rerolls

- The player may **skip** a piece draft for a small gold bonus (Balatro-style skip). Same skip-bonus pool as card-draft skip.
- Piece drafts do **not** have a reroll service tied to them; the only reroll currency goes against the shop.

### Soft caps per piece type

To prevent degenerate piles of the same piece, each piece type has a **soft cap** on how many you can hold. Reaching the cap removes that type from future drafts.

Starting soft caps (tuning knobs):

| Piece  | Soft cap |
|--------|----------|
| Pawn   | 8        |
| Knight | 4        |
| Bishop | 4        |
| Rook   | 3        |
| Queen  | 2        |
| King   | 1 (hard) |

The king cap is hard (you can never have more than one king); the others are soft in the sense that drafts simply don't offer them once you hit the cap. Artifacts may raise specific caps.

## Skirmish: piece-buying in the shop

In the current shop spec (see `economy.md`), the shop offers **single cards + booster packs + artifacts**. Specific pieces are **not** sold in the shop in the prototype — pieces only enter the roster via drafts. (This is a deliberate choice to keep drafts the primary roster mechanic and avoid making gold the dominant lever.)

Reconsider after playtesting if drafts feel too random — see `roadmap/open-questions.md`.

## Piece persistence within a run

Within a Skirmish run, pieces are **persistent across matches**. Pieces lost during a match (captured) **are not permanently lost** — they return at full strength for the next match. This keeps Skirmish's roguelite power-curve fun. The roster effectively only grows.

The "death is permanent" question is filed under future difficulty modifiers (Ascension / heat). See `progression.md` and `roadmap/open-questions.md`.

## Placement (both modes)

Piece placement at match start is **mode-dependent**:

### Royal placement

Standard FIDE chess starting setup, both sides:

```
8  r n b q k b n r
7  p p p p p p p p
6  . . . . . . . .
5  . . . . . . . .
4  . . . . . . . .
3  . . . . . . . .
2  P P P P P P P P
1  R N B Q K B N R
   a b c d e f g h
```

No customization. Castling rights are standard.

### Skirmish placement

Before each match, the player enters a **placement screen**:

- The player has their full current roster of pieces.
- They place pieces in their two back ranks (ranks 1–2 from the player's perspective).
- The king must be placed somewhere on rank 1.
- Pawns may be placed on rank 2 only. (Tuning knob — we may relax this.)
- All other pieces (knight, bishop, rook, queen) may be placed on rank 1 or 2.
- No two pieces share a square.
- The player may place fewer pieces than they own (skipping placement of a piece leaves that piece off the board for that match). This may be useful with very large rosters.

The AI's army is placed by the engine following its own rules per match (see `bosses.md` and `roadmap/open-questions.md` for AI placement details — placement is generally standard chess, but in some Skirmish matches the AI's force may be smaller and centered).

### Castling in Skirmish

Castling is allowed (see `chess-rules.md`) when:

- The king ended up placed on its standard square (e1 for white, e8 for black) AND
- A rook is on its standard square (a1 / h1 / a8 / h8) AND
- All other castling preconditions hold (no prior moves of those pieces, no squares attacked, etc.).

Most placements won't satisfy these conditions, so castling is rare in Skirmish — that's intended.

## Promotion in Skirmish

Pawn promotion follows standard chess rules: a pawn that reaches the back rank promotes. The player chooses any piece type **other than king** (not limited to pieces already in roster).

Promoted pieces exist for the rest of that match only. They do **not** add to the roster permanently. Otherwise farming promotions would be a degenerate strategy.

## Summary

| Concept                       | Royal             | Skirmish                                |
|-------------------------------|-------------------|-----------------------------------------|
| Starting roster               | 16 (standard)     | 5 (K + 2P + 2 minors)                   |
| Drafts between matches        | None              | 1-of-3, tiered by rarity                |
| Soft caps                     | n/a               | Yes, per piece type                     |
| Piece persistence in run      | n/a (resets)      | Persistent (deaths revive next match)   |
| Placement                     | Fixed FIDE setup  | Player-placed, ranks 1–2                |
| Castling                      | Standard          | Possible if pieces happen to align      |
| Promotion                     | Standard          | Standard; promotes for the match only   |
