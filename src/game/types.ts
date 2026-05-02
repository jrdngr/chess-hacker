// Shared types for the game logic layer.
// Keep this file free of React/DOM imports — see docs/technical/architecture.md.

export type FileIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type RankIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type Square = { file: FileIndex; rank: RankIndex };

export type PieceType = "pawn" | "knight" | "bishop" | "rook" | "queen" | "king";

/**
 * Logical sides. Mapped to chess.js colors ("w" / "b") at the engine boundary.
 * In the prototype the human player is always white = "player".
 */
export type Side = "player" | "opponent";

export type Piece = {
  type: PieceType;
  side: Side;
};

export type MatchOutcome =
  | { kind: "ongoing" }
  | { kind: "checkmate"; winner: Side }
  | { kind: "stalemate" }
  | {
      kind: "draw";
      reason: "insufficient-material" | "threefold-repetition" | "fifty-move" | "other";
    };

/** Algebraic-square string, e.g. "e4". Used at the engine boundary. */
export type AlgebraicSquare = string;

// ---- Cards (M3) -------------------------------------------------------------

export type CardId = string;
export type CardCost = 0 | 1 | 2 | 3 | 4;
export type CardRarity = "common" | "uncommon" | "rare";
export type CardArchetype =
  | "tempo"
  | "spatial"
  | "movement"
  | "disruption"
  | "resource"
  | "defensive"
  | "burst";

/**
 * What kind of input a card needs from the player when it's played.
 *  - "none":         no target; resolve immediately on click.
 *  - "empty-square": pick any board square that has no piece (and no wall).
 *  - "enemy-piece":  pick a square that holds an opponent piece.
 *
 * The full target taxonomy in `docs/design/cards.md` is broader; we add more
 * kinds (own piece, hand card, …) as cards demand them.
 */
export type CardTarget = { kind: "none" } | { kind: "empty-square" } | { kind: "enemy-piece" };

/**
 * Effect descriptor — interpreted by the resolver in `game/cards/match.ts`.
 * Kept as a plain discriminated union so cards remain pure data.
 */
export type CardEffect =
  | { kind: "gain-energy"; amount: number }
  | { kind: "draw"; count: number }
  | { kind: "freeze-piece" }
  | { kind: "place-wall"; durationTurns: number };

export type Card = {
  id: CardId;
  name: string;
  cost: CardCost;
  rarity: CardRarity;
  archetype: CardArchetype;
  consume: boolean;
  curse?: boolean;
  description: string;
  target: CardTarget;
  effect: CardEffect;
};

// ---- Board overlays (M3 stores; M4 enforces walls in chess engine) ----------

export type Wall = {
  square: AlgebraicSquare;
  /**
   * Player-turn number at which the wall is removed (at start of that turn).
   * `placedOnTurn + durationTurns`.
   */
  expiresOnTurn: number;
};

/**
 * A frozen piece skips its next move (per `docs/design/cards.md`).
 * We track the squares that are frozen for the opponent's upcoming turn.
 * In M3 the visual is wired but rule enforcement against the AI is M4 work.
 */
export type FrozenPiece = {
  square: AlgebraicSquare;
  side: Side;
  expiresOnTurn: number;
};

/**
 * Match-scoped card / overlay state. The chess board itself lives in the
 * `ChoseEngine`; this struct is the rest of the per-match state.
 */
export type MatchCardState = {
  hand: Card[];
  drawPile: Card[];
  discardPile: Card[];
  consumedPile: Card[];
  energy: number;
  energyMax: number;
  /** 1-indexed player turn count. Bumped by `startPlayerTurn`. */
  turn: number;
  walls: Wall[];
  freezes: FrozenPiece[];
};
