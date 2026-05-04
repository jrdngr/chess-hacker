// Shared types for the game logic layer.
// Keep this file free of React/DOM imports — see docs/technical/architecture.md.

// Indexes are wide `number`s now that boards can be 3..8 on each axis. Standard
// mode walks the board from 4×6 → 8×8 across a run (seven distinct sizes); the
// dev sandbox supports any combination from 3×3 to 8×8. Compile-time coordinate
// safety is traded for runtime board-size flexibility.
export type FileIndex = number;
export type RankIndex = number;

export type Square = { file: FileIndex; rank: RankIndex };

/**
 * Board dimensions. `files` is the number of columns (a..h), `ranks` is the
 * number of rows. Standard chess is 8×8; Standard mode walks across seven
 * distinct sizes from 4×6 to 8×8. The sandbox editor supports any size from
 * 3×3 to 8×8 on each axis.
 */
export type BoardSize = { files: number; ranks: number };

export const STANDARD_BOARD_SIZE: BoardSize = { files: 8, ranks: 8 };

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
  | { kind: "king-captured"; winner: Side }
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

// ---- Scaffolding for M5+ milestones -----------------------------------------
//
// These types are placeholders for the run loop, shop, artifacts, bosses, and
// zone-control buffs. Each is minimal — just enough so future PRs can compile-
// check against intended shapes without dead implementations. See `docs/
// roadmap/milestones.md` for the per-milestone scope. Types will be expanded
// in their respective PRs (M5/M6/M7/M8/M10).

// === Run state (M5) ===
//
// Three modes are scoped:
//   - "standard": the active default. Variable board size + points-budget piece
//     curve from K + 4P on 4×6 → full armies on 8×8 across a 9-match run.
//     Starting positions are Chess960-generalized to whatever board / piece
//     set the current match uses.
//   - "royal":   classic chess armies on 8x8. Spec'd post-prototype to default
//                to Chess960 with a "standard start" opt-in. Currently disabled
//                in the menu while Standard is the focus.
//   - "skirmish": roguelite army-builder (M10). Currently disabled.
export type RunMode = "standard" | "royal" | "skirmish";
/**
 * Phases a run cycles through. M5 implements `match | reward | shop | won |
 * lost`; `boss-preview` lands in M8 once bosses arrive.
 */
export type RunPhase = "match" | "reward" | "shop" | "boss-preview" | "won" | "lost";

/**
 * How many matches each act contains. Real Royal runs are 3 acts × 3 matches;
 * the M5 mini-run is 1 act × 3 matches and uses no boss. Held in run config so
 * the shape is shared — extending to the full 9-match run in M9 only changes
 * `actCount`/`matchesPerAct`, not the surrounding logic.
 */
export type RunConfig = {
  actCount: 1 | 2 | 3;
  matchesPerAct: 1 | 2 | 3;
};

/**
 * The non-pawn piece set used to seed a back rank for Standard mode. `pawns`
 * is symmetric per side. `backRank` is the multiset of pieces placed on white's
 * back rank by the Chess960 generator (mirrored to black). The generator
 * accepts any size up to `files`; if `backRank.length > files`, it throws.
 */
export type PieceSet = {
  backRank: PieceType[];
  pawns: number;
};

export type RunState = {
  mode: RunMode;
  ascension: number;
  config: RunConfig;
  /** 1-indexed current act. */
  act: 1 | 2 | 3;
  /** 1-indexed match within the current act. */
  matchInAct: 1 | 2 | 3;
  /** 1-indexed total match number across the run (for display + scaling). */
  matchNumber: number;
  gold: number;
  deck: Card[];
  artifacts: Artifact[];
  /** Skirmish only — the player's persistent army roster. */
  roster?: Piece[];
  rngSeed: number;
  /** PRNG state — bumped each time a draft / shop / etc. consumes randomness. */
  rngCursor: number;
  /**
   * Number of card removals already performed this run. The Nth removal in a
   * run costs `BASE + STEP * N` (see shop economy doc).
   */
  removalsUsed: number;
  phase: RunPhase;
};

/** Outcome of a single match, surfaced from <Match> back to the run shell. */
export type RunMatchOutcome = {
  won: boolean;
  /** Standard outcome wrapper from the engine. */
  outcome: MatchOutcome;
  /** Total player turns played in the match — used by performance bonuses. */
  turnsPlayed: number;
};

/** A single card-draft offer, as shown to the player after a match win. */
export type DraftOffer = {
  /** 1-of-N cards the player picks between. */
  cards: Card[];
  /** Gold awarded if the player skips the draft. */
  skipGold: number;
};

// === Artifacts (M6) ===
export type ArtifactRarity = "common" | "uncommon" | "rare";

/**
 * Artifact effects — discriminated union covering all four effect domains
 * documented in `docs/design/artifacts.md`:
 *
 *  - card-related: card-cost-discount
 *  - resource / match-rule: hand-size-bonus, start-energy-bonus,
 *    energy-per-turn-bonus, gold-on-match-start
 *  - conditional triggers: draw-on-capture, energy-on-capture, draw-on-check
 *
 * Piece-related effects (e.g. "pawns promote at rank 6") need engine plumbing
 * and land in a follow-up. Single artifact may declare multiple effects.
 */
export type ArtifactEffect =
  | { kind: "hand-size-bonus"; amount: number }
  | { kind: "start-energy-bonus"; amount: number }
  | { kind: "energy-per-turn-bonus"; amount: number }
  | { kind: "card-cost-discount"; archetype?: CardArchetype; amount: number }
  | { kind: "gold-on-match-start"; amount: number }
  | { kind: "draw-on-capture"; count: number }
  | { kind: "energy-on-capture"; amount: number }
  | { kind: "draw-on-check"; count: number };

export type Artifact = {
  id: string;
  name: string;
  rarity: ArtifactRarity;
  description: string;
  effects: ReadonlyArray<ArtifactEffect>;
};

/** Cap on artifacts a single run can hold — see docs/design/artifacts.md. */
export const ARTIFACT_SLOT_CAP = 5;

// === Shop (M5) ===
export type ShopOfferKind = "card" | "booster" | "artifact";

/**
 * Booster pack — opens to a 1-of-N pick from the contained cards. Pack types
 * could be archetype-themed later (`flavor` enum), but the prototype generates
 * random commons.
 */
export type BoosterPack = {
  /** Pack id (e.g. "common-pack"). Distinct from a pack instance in shop. */
  id: string;
  name: string;
  /** Cards revealed when the pack is opened — player picks 1. */
  contents: Card[];
};

export type ShopOffer =
  | { kind: "card"; card: Card; price: number; sold?: boolean }
  | { kind: "booster"; pack: BoosterPack; price: number; sold?: boolean }
  | { kind: "artifact"; artifact: Artifact; price: number; sold?: boolean };

export type Shop = {
  offers: ShopOffer[];
  /** Gold cost of the next reroll in this shop visit. */
  rerollCost: number;
  /** Number of rerolls used so far in this shop visit. */
  rerollsUsed: number;
  /** Gold cost of the next card-removal — scales across the run. */
  removalCost: number;
};

// === Bosses (M8) ===
export type BossId = string;
export type BossModifier = {
  bossId: BossId;
  // Modifier-rule shape lands in M8 — examples in docs/design/bosses.md
  // include "all your pawns are rooted on turn 1", "the boss starts with
  // an extra rook", etc.
};
export type CurseSchedule = {
  curses: Card[];
  // Scheduling shape lands in M8 — likely a list of triggers (turn N, on
  // capture, on player check) each pointing at a curse to insert.
};

// === Zone-control buffs (M7) ===
export type ZoneBuff = {
  square: AlgebraicSquare;
  pattern: "adjacent-orthogonal" | "adjacent-diagonal" | "king-radius";
  /** Tightened in M7 — likely a discriminated union of buff effects. */
  effect: string;
};

// === Skirmish piece identity (M10) ===
// Piece today is just { type, side }. M10 needs identity so individual
// pieces can be tracked across drafts and placement. The optional `id`
// keeps existing call sites valid; M10 will tighten it to required for
// roster pieces while leaving in-match Piece references unchanged.
// (No type change here yet — documented for future reference.)

// -----------------------------------------------------------------------------

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
  /**
   * Artifacts active for this match — copied from the run state at match
   * start. Immutable across the match. Drives hand size, energy bonuses,
   * card discounts, and conditional triggers (see game/artifacts/effects.ts).
   */
  artifacts: ReadonlyArray<Artifact>;
};
