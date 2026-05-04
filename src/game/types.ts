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
export type CardCost = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type CardRarity = "common" | "uncommon" | "rare";
export type CardArchetype =
  | "tempo"
  | "spatial"
  | "movement"
  | "disruption"
  | "resource"
  | "defensive"
  | "burst"
  | "sacrifice"
  | "summon"
  | "swap";

/**
 * What kind of input a card needs from the player when it's played.
 * See `docs/cards/` for the per-card target.
 *
 *  - "none":                       no target; resolve immediately on click.
 *  - "empty-square":               any empty, unwalled square on the board.
 *  - "empty-square-own-half":      empty square in the player's half (ranks 1–4).
 *  - "enemy-piece":                a square holding an opponent piece.
 *  - "enemy-non-king-piece":       same as enemy-piece, but the king is excluded.
 *  - "own-piece":                  a square holding one of the player's pieces.
 *  - "own-non-king-piece":         same as own-piece, but the king is excluded.
 *  - "two-own-pieces":             two squares each holding a player piece (multi-step).
 *  - "marionette":                 an enemy piece, then one of its legal destinations.
 *  - "rooted-enemy-and-own-piece": a rooted enemy piece, then one of your pieces (multi-step).
 */
export type CardTarget =
  | { kind: "none" }
  | { kind: "empty-square" }
  | { kind: "empty-square-own-half" }
  | { kind: "enemy-piece" }
  | { kind: "enemy-non-king-piece" }
  | { kind: "own-piece" }
  | { kind: "own-non-king-piece" }
  | { kind: "two-own-pieces" }
  | { kind: "marionette" }
  | { kind: "rooted-enemy-and-own-piece" };

/** Trap variant — picked per-card when the trap is placed. */
export type TrapEffect = "capture" | "freeze" | "push";

/** Empower pattern — extra movement granted to a piece. */
export type EmpowerPattern = "pawn" | "knight" | "bishop" | "rook" | "queen";

/**
 * Effect descriptor — interpreted by the resolver in `game/cards/match.ts`.
 * Kept as a plain discriminated union so cards remain pure data.
 */
export type CardEffect =
  | { kind: "gain-energy"; amount: number }
  | { kind: "draw"; count: number }
  | { kind: "scry"; count: number }
  | { kind: "freeze-piece" }
  | { kind: "root-piece"; durationTurns?: number }
  | { kind: "disarm-piece" }
  | { kind: "compel-piece" }
  | { kind: "shield-piece" }
  | { kind: "haste-piece" }
  | {
      kind: "empower-piece";
      pattern: EmpowerPattern;
      /**
       * "Use it or lose it" empower (e.g. Soul cards). Lasts the current turn,
       * but is dropped immediately if the player moves any other piece first.
       */
      singleUse?: boolean;
    }
  | { kind: "lightning-piece"; actions: number }
  | { kind: "place-wall"; durationTurns: number }
  | { kind: "place-sanctuary"; durationTurns: number }
  | { kind: "place-trap"; trapEffect: TrapEffect; durationTurns: number }
  | { kind: "swap-own-pieces" }
  | { kind: "swap-rooted-with-own" }
  | { kind: "summon-piece"; pieceType: PieceType }
  | { kind: "sacrifice-piece"; drawCount: number; energyGain: number }
  | { kind: "marionette" }
  | { kind: "destroy-piece"; filter: "any" | "attacked-by-player" }
  | {
      kind: "add-card-to-hand";
      source: "random-common" | "card-id" | "shiv-pool";
      cardId?: CardId;
      count?: number;
    }
  | { kind: "add-card-to-draw"; source: "self" | "card-id"; cardId?: CardId }
  | { kind: "revive"; selection: "random" | "choose" }
  | { kind: "compound"; effects: CardEffect[] };

export type Card = {
  id: CardId;
  name: string;
  cost: CardCost;
  rarity: CardRarity;
  archetype: CardArchetype;
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
 * A status applied to a single piece on a single square.
 *
 * Used for: freeze, root, disarm, compel (debuffs on enemy pieces);
 * shield, haste, lightning (buffs on player pieces).
 *
 * `expiresOnTurn` is a player-turn number; the status is dropped when
 * `startPlayerTurn` advances to (or past) that turn.
 */
export type PieceStatus = {
  square: AlgebraicSquare;
  side: Side;
  expiresOnTurn: number;
};

/** A frozen piece. Kept as a named alias for back-compat with M3 code. */
export type FrozenPiece = PieceStatus;

/** An empower status — like PieceStatus, plus the granted movement pattern. */
export type EmpowerStatus = PieceStatus & {
  pattern: EmpowerPattern;
  /** Drops as soon as the player moves a different piece (Soul cards). */
  singleUse?: boolean;
};

/** A lightning status — N extra actions on the same piece this turn. */
export type LightningStatus = PieceStatus & {
  /** Remaining actions (the first move costs 1). */
  remaining: number;
};

/** Sanctuary square overlay. Pieces standing on it cannot be captured. */
export type Sanctuary = {
  square: AlgebraicSquare;
  expiresOnTurn: number;
};

/** Trap square overlay. Triggers when an enemy piece enters. */
export type Trap = {
  square: AlgebraicSquare;
  effect: TrapEffect;
  expiresOnTurn: number;
};

/**
 * Match-scoped card / overlay state. The chess board itself lives in the
 * `ChoseEngine`; this struct is the rest of the per-match state.
 */
export type MatchCardState = {
  hand: Card[];
  drawPile: Card[];
  consumedPile: Card[];
  /**
   * Append-only ledger of every card that has ever entered the deck, in the
   * order it was acquired. Used by the Draw-pile inspector to show the deck
   * in acquisition order rather than in shuffled draw order. Includes cards
   * that have since been drawn or played; cross-reference against `drawPile`
   * to filter to the current contents.
   */
  acquisitionLog: Card[];
  energy: number;
  /** 1-indexed player turn count. Bumped by `startPlayerTurn`. */
  turn: number;
  walls: Wall[];
  freezes: FrozenPiece[];
  /** Enemy pieces that may only capture next turn. */
  roots: PieceStatus[];
  /** Enemy pieces that may move but not capture next turn. */
  disarms: PieceStatus[];
  /** Enemy pieces forced to move (and prefer captures) next turn. */
  compels: PieceStatus[];
  /** Player pieces immune to capture until the player's next turn starts. */
  shields: PieceStatus[];
  /** Player pieces with Haste (move twice, no captures) for the current turn. */
  hastes: PieceStatus[];
  /** Player pieces with extra-action (move twice, captures allowed). */
  lightnings: LightningStatus[];
  /** Player pieces with an extra movement pattern this turn. */
  empowers: EmpowerStatus[];
  /** Sanctuary square overlays. */
  sanctuaries: Sanctuary[];
  /** Trap square overlays. */
  traps: Trap[];
};
