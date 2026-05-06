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
  | "swap"
  | "power";

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
 *  - "enemy-and-own-piece":        any enemy non-king piece, then one of your pieces (multi-step).
 *  - "hand-card":                  another card currently in your hand (Bookmark).
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
  | { kind: "rooted-enemy-and-own-piece" }
  | { kind: "enemy-and-own-piece" }
  | { kind: "hand-card" };

/** Trap variant — picked per-card when the trap is placed. */
export type TrapEffect = "capture" | "freeze" | "push";

/** Empower pattern — extra movement granted to a piece. */
export type EmpowerPattern = "pawn" | "knight" | "bishop" | "rook" | "queen" | "king-step";

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
  | { kind: "haste-piece"; durationTurns?: number }
  | { kind: "haste-all-of-type"; pieceType: PieceType; durationTurns?: number }
  | {
      kind: "empower-piece";
      pattern: EmpowerPattern;
      /**
       * "Use it or lose it" empower (e.g. Patch cards). Lasts the current turn,
       * but is dropped immediately if the player moves any other piece first.
       */
      singleUse?: boolean;
      durationTurns?: number;
    }
  | {
      kind: "lightning-piece";
      actions: number;
      /** Optional: only target pieces of this type (e.g. Vanguard = pawn). */
      pieceTypeFilter?: PieceType;
    }
  | { kind: "place-wall"; durationTurns: number }
  | { kind: "place-sanctuary"; durationTurns: number }
  | { kind: "place-trap"; trapEffect: TrapEffect; durationTurns: number }
  | { kind: "swap-own-pieces" }
  | { kind: "swap-rooted-with-own" }
  | { kind: "swap-with-enemy" }
  | { kind: "summon-piece"; pieceType: PieceType }
  | { kind: "sacrifice-piece"; drawCount: number; energyGain: number }
  | { kind: "marionette" }
  | { kind: "destroy-piece"; filter: "any" | "attacked-by-player" }
  | { kind: "add-card-to-draw"; source: "self" | "card-id"; cardId?: CardId }
  | { kind: "revive"; selection: "random" | "choose" }
  | {
      kind: "place-zone-buff";
      /** Anchored region pattern — uses the targeted square as anchor. */
      pattern: "square-radius-1" | "square-orthogonal-1";
      /** What the buff grants while the controlling side occupies the region. */
      buff: ZoneBuffEffect;
      durationTurns: number;
      /** Sidebar label shown while the buff is active. */
      sourceLabel: string;
    }
  /**
   * Curse-only: constrains the next chess move. Currently the only variant
   * is `must-not-check`, used by Boss A's Throttled curse.
   */
  | { kind: "next-move-constraint"; constraint: "must-not-check" }
  /**
   * Curse-only (Boss B / Memory Leak): if the player makes no capture this turn,
   * lose `amount` energy at the start of the next turn. Implemented via the
   * `pendingEnergyLossOnNoCapture` flag on `MatchCardState`.
   */
  | { kind: "pending-energy-loss-on-no-capture"; amount: number }
  /**
   * Curse-only (Boss C / Hardened): no further 0-cost cards may be
   * played for the remainder of the current player turn.
   */
  | { kind: "forbid-zero-cost-this-turn" }
  /**
   * Curse-only (Boss C / Echo): grants the boss `count` extra chess moves
   * after its next normal move resolves.
   */
  | { kind: "boss-extra-move"; count: number }
  /**
   * Curse-only (Boss C / Bit Rot): immediately destroys one of the
   * player's minor pieces (knight or bishop), chosen at random.
   */
  | { kind: "capture-random-own-minor" }
  /**
   * Bookmark: grant Retain to another card in the player's hand. Resolves against
   * the targeted hand index; the chosen slot's `retained` flag flips to true
   * and the card stays in hand at end-of-turn discards until played.
   */
  | { kind: "apply-retain-to-hand-card" }
  /**
   * Cache Warmup et al. Queues `amount` extra energy onto the *next* player
   * turn's start-of-turn budget. Stored on `MatchCardState.pendingEnergyNextTurn`
   * and consumed (cleared) by the next `startPlayerTurn`.
   */
  | { kind: "pending-energy-next-turn"; amount: number }
  /**
   * Power cards (Slay-the-Spire-style). The played card is consumed and its
   * `effect.effect` is appended to `MatchCardState.activePowers`, where it
   * applies for the rest of the match. Each power kind feeds into a different
   * start-of-turn calculation (energy, hand size, extra chess moves).
   */
  | { kind: "play-power"; effect: PowerEffect }
  | { kind: "compound"; effects: CardEffect[] };

/**
 * Match-scoped passive effects granted by Power cards. Each kind is summed
 * across all currently-active powers and read at the start of every player
 * turn. Powers persist for the rest of the match — they are dropped when the
 * match ends (a fresh `MatchCardState` is created for the next match).
 */
export type PowerEffect =
  | { kind: "energy-per-turn"; amount: number }
  | { kind: "draw-per-turn"; amount: number }
  | { kind: "extra-chess-move-per-turn"; amount: number }
  /**
   * At the start of each player turn, every player pawn gains Haste until end
   * of turn. `amount` is reserved for stacking semantics; in this PR a card
   * always sets it to 1 (one application per turn).
   */
  | { kind: "haste-pawns-per-turn"; amount: number }
  /**
   * At the start of each player turn, every non-king player piece on rank 1
   * is shielded until the player's next turn. `amount` reserved for stacking;
   * always 1 in the prototype.
   */
  | { kind: "shield-back-rank-per-turn"; amount: number };

export type Card = {
  id: CardId;
  name: string;
  cost: CardCost;
  rarity: CardRarity;
  archetype: CardArchetype;
  curse?: boolean;
  /**
   * Consume keyword: the card is removed from the match (lands in the
   * `consumedPile`) when played, instead of cycling through the discard
   * pile. Used for haymakers, Patches, and other one-shot cards. See
   * `docs/cards/keywords.md`.
   */
  consume?: boolean;
  /**
   * Retain keyword (inherent): the card stays in your hand at end-of-turn
   * discards until played. Currently no card definition uses this; the
   * Retain mechanic is applied dynamically by Bookmark via the `HandCard`
   * wrapper. Reserved for future cards that retain natively.
   */
  retain?: boolean;
  description: string;
  target: CardTarget;
  effect: CardEffect;
};

/**
 * One slot in the player's hand: a card definition plus the per-instance
 * retain flag. The flag is set by Bookmark (or by an inherent `retain` keyword
 * on the card) and survives end-of-turn discards. It is dropped when the
 * card leaves hand by being played.
 */
export type HandCard = {
  card: Card;
  retained: boolean;
};

// ---- Board overlays (M3 stores; M4 enforces walls in chess engine) ----------

export type Wall = {
  square: AlgebraicSquare;
  /**
   * Player-turn number at which the wall is removed (at start of that turn).
   * Ignored when `permanent` is true (boss hazards live for the whole match).
   */
  expiresOnTurn: number;
  /** Boss-hazard walls — never tick down, never removable by cards. */
  permanent?: boolean;
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
  /** Drops as soon as the player moves a different piece (Patch cards). */
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
  /**
   * Free deck-deletion charges held over from a boss-reward "delete 2 cards"
   * pick. Decremented when the player completes a deletion in the reward UI;
   * reaching 0 unblocks the next reward step.
   */
  bossDeleteCharges?: number;
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

/**
 * Boss artifact offer — 1-of-3 from a rare-skewed pool. Shown alongside the
 * regular card draft on the post-boss reward step.
 */
export type BossArtifactOffer = {
  artifacts: Artifact[];
  /** Gold awarded if the player skips the artifact pick. */
  skipGold: number;
};

/**
 * Boss-reward 3-pick — Monster-Train-style fixed options shown after every
 * boss win. The player picks exactly one (no skip). Resolves into either a
 * synthetic artifact appended to `RunState.artifacts` (energy / draw bonus)
 * or a deck-edit charge tracked on `RunState.bossDeleteCharges` (delete-2).
 */
export type BossPickOption =
  | { kind: "energy-per-turn-bonus"; amount: 1 }
  | { kind: "draw-per-turn-bonus"; amount: 1 }
  | { kind: "delete-cards"; count: 2 };

export type BossPickOffer = {
  options: BossPickOption[];
};

// === Artifacts (M6) ===
export type ArtifactRarity = "common" | "uncommon" | "rare";

/**
 * Artifact effects — discriminated union covering all four effect domains
 * documented in `docs/design/artifacts.md`:
 *
 *  - card-related: card-cost-discount
 *  - resource / match-rule: hand-size-bonus, start-energy-bonus,
 *    energy-per-turn-bonus, gold-on-match-start, zone-buff
 *  - conditional triggers: draw-on-capture, energy-on-capture, draw-on-check
 *  - piece-related: piece-rule-modifier (pawn flags, promotion rank,
 *    side-wide empowers, sniper-optics rook ray, phalanx adjacency shield)
 *
 * A single artifact may declare multiple effects.
 */
export type ArtifactEffect =
  | { kind: "hand-size-bonus"; amount: number }
  | { kind: "start-energy-bonus"; amount: number }
  | { kind: "energy-per-turn-bonus"; amount: number }
  | { kind: "card-cost-discount"; archetype?: CardArchetype; amount: number }
  | { kind: "gold-on-match-start"; amount: number }
  | { kind: "draw-on-capture"; count: number }
  | { kind: "energy-on-capture"; amount: number }
  | { kind: "draw-on-check"; count: number }
  /**
   * Grants a zone-buff at match start. The region is materialised verbatim
   * into `MatchCardState.zoneBuffs` with no expiry; the buff is active for
   * the whole match (subject to the usual control check on the chess board).
   */
  | { kind: "zone-buff"; region: ZoneRegion; buff: ZoneBuffEffect; sourceLabel: string }
  /**
   * Side-wide rule overrides — the "piece-related" effect domain. Each
   * artifact bumps a flag the rule engine reads off `Overlays`, or schedules
   * a per-turn application (for piece-empower-all and phalanx-adjacent-shield).
   */
  | {
      kind: "piece-rule-modifier";
      modifier: PieceRuleModifier;
    };

/**
 * Side-wide piece-rule modifier — the discriminated payload of the
 * `piece-rule-modifier` ArtifactEffect.
 */
export type PieceRuleModifier =
  /** Pawn Storm: pawns may double-push from any rank, not just the start rank. */
  | { kind: "pawn-double-from-any-rank" }
  /** Drill Sergeant: pawns may also move 1 square backward (no capture). */
  | { kind: "pawn-backward-step" }
  /**
   * Promotion Engine: pawns promote when reaching `rank` (1-indexed).
   * If multiple artifacts declare this, the lowest rank wins.
   */
  | { kind: "pawn-promotion-rank"; rank: number }
  /**
   * Polished Bishop / Cavalry Doctrine: every player piece of `pieceType`
   * gains the empower `pattern` for as long as the artifact is held.
   */
  | { kind: "piece-empower-all"; pieceType: PieceType; pattern: EmpowerPattern }
  /**
   * Sniper Optics: rooks may capture an enemy piece even with up to
   * `maxWalls` walls in the path between attacker and target. Movement
   * to empty squares past a wall is still blocked.
   */
  | { kind: "rook-attack-through-wall"; maxWalls: number }
  /**
   * Phalanx: at the start of each player turn, every player piece that has
   * at least one orthogonally-adjacent friendly piece is shielded until the
   * player's next turn.
   */
  | { kind: "phalanx-adjacent-shield" };

export type Artifact = {
  id: string;
  name: string;
  rarity: ArtifactRarity;
  description: string;
  effects: ReadonlyArray<ArtifactEffect>;
  /** Optional display glyph; falls back to a generic talisman in `artifactEmoji`. */
  emoji?: string;
};

/** Cap on artifacts a single run can hold — see docs/design/artifacts.md. */
export const ARTIFACT_SLOT_CAP = 20;

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

// === Bosses (M8 + M9) ===
export type BossId = "the-firewall" | "the-whale" | "the-singularity";

/** Match-modifier identifiers — all three are now wired end-to-end. */
export type BossModifier =
  | { kind: "no-player-walls" }
  | { kind: "captures-grant-captured-energy" }
  | { kind: "no-promotion" };

/**
 * When the boss inserts a curse into the player's hand. Triggers fire
 * deterministically; "max one curse per turn" is enforced by the scheduler.
 */
export type CurseTrigger =
  /** Once, at the start of player turn N (1-indexed). */
  | { kind: "turn"; turn: number }
  /** Every N player turns, starting at turn `n` (so turns N, 2N, 3N…). */
  | { kind: "every-n-turns"; n: number }
  /** Whenever the player puts the boss in check. */
  | { kind: "on-player-check" }
  /** Whenever the player captures any boss piece. */
  | { kind: "on-player-capture" };

export type CurseScheduleEntry = {
  trigger: CurseTrigger;
  /** Card id from the curse pool — looked up via `getCardById`. */
  curseId: CardId;
};

/**
 * A boss encounter: name + modifier + hazards + curse schedule. Bosses are
 * hand-crafted (one per act), not generated. See `docs/design/bosses.md`.
 */
export type BossDef = {
  id: BossId;
  name: string;
  /** Which match in the run this boss occupies (3, 6, or 9). */
  matchNumber: 3 | 6 | 9;
  modifier: BossModifier;
  /** Plain-English description of the modifier (shown in preview). */
  modifierDescription: string;
  /** Permanent walls placed at match start. */
  hazardWalls: AlgebraicSquare[];
  /**
   * "Void" squares — any piece ending its turn on one of these is destroyed.
   * Boss C (The Singularity) places a 2x2 void on d4/d5/e4/e5.
   */
  voidSquares?: AlgebraicSquare[];
  /**
   * Pre-placed zone-buffs the boss starts with. Boss B uses a single-square
   * buff at d1 (player must contest the back-rank center).
   */
  zoneBuffs?: ReadonlyArray<{ region: ZoneRegion; buff: ZoneBuffEffect; sourceLabel: string }>;
  /** Curse schedule — fired by the per-match scheduler. */
  curses: ReadonlyArray<CurseScheduleEntry>;
  /** Tag-line shown in the boss preview. */
  description: string;
};

// === Zone-control buffs (M7) ===
//
// A zone-buff is a passive effect that activates while its controlling side
// has at least one piece on a square in the buff's region. See
// `docs/design/board.md` ("Zone-control buffs") for the design intent.
//
// Sources of zone-buffs in the prototype:
//   - cards (`place-zone-buff` effect) — anchored to the targeted square,
//     timed via `expiresOnTurn`.
//   - artifacts (`zone-buff` effect)   — typically board-relative regions
//     (e.g. a specific rank), no expiry.
//
// Evaluation runs at the start of each player turn against the current chess
// position; the active set drives both the energy / hand bonuses applied by
// `startPlayerTurn` and the aura rendered on the board.

export type ZoneRegion =
  /** Just the anchor square. */
  | { kind: "square"; anchor: AlgebraicSquare }
  /** The anchor square plus its 4 orthogonal neighbours. */
  | { kind: "square-orthogonal-1"; anchor: AlgebraicSquare }
  /** The anchor square plus its 8 surrounding neighbours (king-radius). */
  | { kind: "square-radius-1"; anchor: AlgebraicSquare }
  /** Every square on the given rank (1-indexed). */
  | { kind: "rank"; rank: number }
  /**
   * The board's central square(s). Odd-sized boards: the single middle square.
   * Even-sized boards: the central 2×2 block. On 8×8 = d4, e4, d5, e5.
   */
  | { kind: "center" };

export type ZoneBuffEffect =
  | { kind: "energy-per-turn"; amount: number }
  | { kind: "hand-size"; amount: number };

export type ZoneBuff = {
  region: ZoneRegion;
  effect: ZoneBuffEffect;
  /** Whose pieces "control" the region. The prototype only spawns player buffs. */
  side: Side;
  /**
   * Player-turn number at which the buff is removed (start-of-turn tick).
   * `undefined` means the buff lasts the entire match — used by artifacts.
   */
  expiresOnTurn?: number;
  /** Display label (e.g. "Power Node") used by the aura tooltip / sidebar. */
  sourceLabel: string;
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
  hand: HandCard[];
  drawPile: Card[];
  /**
   * Cards played without the Consume keyword (and end-of-turn discards) land
   * here. The discard pile is reshuffled into the draw pile when the draw
   * pile empties — see `docs/cards/keywords.md` for the cycling rule.
   */
  discardPile: Card[];
  /**
   * Cards played with the Consume keyword land here. They never re-enter
   * the cycle and are not eligible for revival via Restore Point / Restore from Backup.
   */
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
   * Active zone-control buffs. Card-placed buffs carry an `expiresOnTurn`
   * and are ticked at start-of-turn; artifact-granted buffs have no expiry
   * and persist for the whole match. A buff's effects only apply while the
   * controlling side has at least one piece on a region square — see
   * `game/overlays/zoneBuffs.ts` for the evaluator.
   */
  zoneBuffs: ZoneBuff[];
  /**
   * Artifacts active for this match — copied from the run state at match
   * start. Immutable across the match. Drives hand size, energy bonuses,
   * card discounts, and conditional triggers (see game/artifacts/effects.ts).
   */
  artifacts: ReadonlyArray<Artifact>;
  /**
   * Boss-driven flag: when true, the player's next chess move must not
   * deliver check. Set by the Throttled curse; cleared by the next move or
   * by the next start-of-turn refresh.
   */
  mustNotCheckNextMove?: boolean;
  /**
   * Boss-driven (Memory Leak curse, Boss B): when true, if no capture happens
   * before the start of the next player turn the player loses 1 energy at
   * that point. Cleared on capture or after the penalty applies.
   */
  pendingEnergyLossOnNoCapture?: boolean;
  /**
   * Tracks whether the player made a capture during the current player
   * turn — used by the Memory Leak curse's start-of-turn check. Reset to false
   * by `startPlayerTurn`.
   */
  capturedThisTurn?: boolean;
  /**
   * Boss-driven (Hardened curse, Boss C): when true, the player may
   * not play 0-cost cards for the remainder of the current player turn.
   * Reset by `startPlayerTurn`.
   */
  noZeroCostCardsThisTurn?: boolean;
  /**
   * Boss-driven (Echo curse, Boss C): grants the boss this many extra
   * chess moves before turn flips back to the player. The Match shell
   * decrements the counter after each AI move.
   */
  bossExtraMoves?: number;
  /**
   * Boss-driven (Boss B modifier): pending energy bonus for the player at
   * the next start-of-turn. Incremented when a player piece is captured by
   * the AI. Cleared when applied.
   */
  pendingPlayerEnergyOnTurnStart?: number;
  /**
   * Cache Warmup (and any future "+N energy next turn" cards): bonus energy
   * applied at the next start-of-turn and then cleared. Stacks if multiple
   * cache-warmups are played in the same turn.
   */
  pendingEnergyNextTurn?: number;
  /**
   * Power-card effects active for the rest of the match. Append-only by
   * `play-power`; never decremented. Read each turn-start to compute energy,
   * hand-size, and extra-chess-move bonuses.
   */
  activePowers: PowerEffect[];
  /**
   * Extra chess moves the player still has this turn (granted by the
   * "extra-chess-move-per-turn" Power). Set at start-of-turn from
   * `activePowers` and decremented by `Match.tsx` after each player chess
   * move. Mirrors the existing `bossExtraMoves` flow.
   */
  playerExtraMovesRemaining?: number;
};
