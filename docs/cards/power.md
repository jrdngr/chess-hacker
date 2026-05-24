# Power cards

Slay-the-Spire-style match-scoped passives. A Power is played once, **consumed** from the deck for the rest of the match, and grants a persistent effect that fires at the start of every subsequent player turn until the match ends. Powers do **not** carry across matches — a fresh `MatchCardState` is created at the next match start, and the player must re-acquire and re-play the Power to benefit again.

Powers cost **10–12** — the expensive-to-haymaker range. They require significant energy banking or a big capture to play.

See [`keywords.md`](keywords.md) for keyword definitions.

## Garrison Mode

- **Cost:** 10
- **Rarity:** Rare
- **Keywords:** **Consume**
- **Target:** none
- **Effect:** Power. At the start of each of your turns, your pieces on rank 1 (except the king) are shielded until your next turn.
- **Design note:** Defensive Power restricted to the back rank, **king excluded**. Castling pieces get a permanent insurance policy as long as the Power is active; the king itself is still capturable so checkmate remains possible. Skips a piece on rank 1 only if it's the king — a rook, knight, or bishop sitting on rank 1 is shielded every turn.

## Intrusion Detection

- **Cost:** 12
- **Rarity:** Rare
- **Keywords:** **Consume**
- **Target:** none
- **Effect:** Power. At the start of each of your turns, **Root** every enemy piece that moved into your half of the board on the opponent's last turn.
- **Upgrade (Intrusion Detection+):** Also **Disarm** the affected pieces (Root + Disarm — they can only capture adjacent enemies, and even that is forbidden).
- **Design note:** a defensive Power that punishes the opponent for pushing into your territory. "Your half" = ranks 1–⌊totalRanks/2⌋. The engine diffs enemy piece positions between your last turn-start and the current turn-start; any piece that crossed the midline triggers the Root. Pieces already in your half before the Power was played are not affected — only new entrants. Combos with Firewall (wall off key entry squares, funneling enemies into the Root zone) and chroot (stack Root durations). The upgrade adding Disarm creates a near-Freeze for entrants — they can't move freely (Root) and can't capture (Disarm), so they're stuck until both wear off.

## Why Powers are expensive

Powers are exponential: every turn after they land, they pay back roughly the equivalent of a cheap card (shield application, persistent root, etc.). Across a 20+ turn match, that compounds far past the energy spend. Cost 10–12 reflects this — you need a rook capture's worth of energy or patient saving over many turns. Powers are rare, build-defining investments.

## Deferred Power: Tactical Override

A third Power — a free 1-square non-capture move per turn — was scoped during the power-curve overhaul but deferred. It needs a dedicated player-action mechanic (a per-turn 1-square king-step budget distinct from the existing `extra-chess-move-per-turn` budget, which counts whole moves). See `docs/roadmap/open-questions.md` if you pick it up.
