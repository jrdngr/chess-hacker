// Run state machine + reward generation.
//
// Pure helpers — no React, no DOM. The Run shell holds a single RunState and
// drives the phase transitions through these functions.
//
// M5 implements a 1-act × 3-match Royal mini-run:
//   match → reward → shop → match → ... → reward → won
// A loss at any match ends the run with phase = "lost". Bosses (M8), full
// 3-act Royal (M9), and Skirmish (M10) layer on top of the same shape — the
// per-milestone delta is the RunConfig and reward generation, not this state
// machine.

import { CARD_LIBRARY, makeStarterDeck } from "../cards/library";
import { makeRng, shuffle, type Rng } from "../cards/match";
import { generateChess960Position } from "../chess/positions";
import { resolvePieceSet, standardMatchConfig } from "./standard";
import { bossForMatch } from "../bosses/library";
import { ARTIFACT_LIBRARY, pickRandomArtifacts } from "../artifacts/library";
import type {
  Artifact,
  BoardSize,
  BossArtifactOffer,
  BossDef,
  BossPickOffer,
  BossPickOption,
  Card,
  CardId,
  CardRarity,
  RunConfig,
  RunMatchOutcome,
  RunMode,
  RunState,
} from "../types";

// ---- Tuning knobs (prototype starting values, see docs/design/economy.md) --

/** Per-match gold reward for a normal (non-boss) win. */
export const WIN_BONUS_NORMAL = 10;
/** Per-match gold reward for a boss win — large bonus per docs/design/bosses.md. */
export const WIN_BONUS_BOSS = 25;

/** Number of artifacts offered in a boss-reward pick. */
export const BOSS_ARTIFACT_COUNT = 3;
/** Gold awarded for skipping a boss artifact pick. */
export const SKIP_BOSS_ARTIFACT_GOLD = 10;

/** Mini-run shape for M5 — 1 act × 3 matches, no boss. */
export const MINI_RUN_CONFIG: RunConfig = { actCount: 1, matchesPerAct: 3 };
/** Full Standard run — 3 acts × 3 matches, with bosses on matches 3, 6, 9. */
export const STANDARD_RUN_CONFIG: RunConfig = { actCount: 3, matchesPerAct: 3 };

// ---- Run lifecycle ---------------------------------------------------------

export type CreateRunOptions = {
  mode: RunMode;
  ascension?: number;
  rngSeed?: number;
  config?: RunConfig;
  /** Override starting deck — tests pass a deterministic deck. */
  startingDeck?: Card[];
  /**
   * Override the starting-artifact ids. Defaults to `["polished-bishop"]`
   * for standard mode and `[]` for everything else. Pass `[]` explicitly to
   * opt out (e.g. tests asserting initial artifact emptiness).
   */
  startingArtifacts?: string[];
};

/** Default starting artifacts for a run in `mode`. */
const DEFAULT_STARTING_ARTIFACTS: Record<RunMode, string[]> = {
  standard: ["polished-bishop"],
  royal: [],
  skirmish: [],
};

export function createRun(opts: CreateRunOptions): RunState {
  const config = opts.config ?? (opts.mode === "standard" ? STANDARD_RUN_CONFIG : MINI_RUN_CONFIG);
  const startingIds = opts.startingArtifacts ?? DEFAULT_STARTING_ARTIFACTS[opts.mode];
  const artifacts: Artifact[] = [];
  for (const id of startingIds) {
    const a = ARTIFACT_LIBRARY[id];
    if (a) artifacts.push(a);
    // Silently skip unknown ids — test fixtures sometimes pass a stale id;
    // we don't want createRun() to throw and bring down the whole UI.
  }
  return {
    mode: opts.mode,
    ascension: opts.ascension ?? 0,
    config,
    act: 1,
    matchInAct: 1,
    matchNumber: 1,
    gold: 0,
    deck: opts.startingDeck ?? makeStarterDeck(),
    artifacts,
    rngSeed: opts.rngSeed ?? Math.floor(Math.random() * 0xffffffff),
    rngCursor: 0,
    removalsUsed: 0,
    phase: "match",
  };
}

/**
 * Per-match starting position. Standard mode generates a Chess960-style
 * position from the per-match piece set; Royal (and the M5 mini-run) just
 * use the standard FEN at 8x8. Returned alongside the run state with the
 * RNG cursor advanced by one tick so successive matches don't share seeds.
 */
export function nextMatchSetup(state: RunState): {
  fen?: string;
  size: BoardSize;
  next: RunState;
} {
  if (state.mode === "standard") {
    const cfg = standardMatchConfig(state.matchNumber);
    const { rng, next } = consumeRng(state);
    const pieceSet = resolvePieceSet(cfg, rng);
    const generated = generateChess960Position(pieceSet, cfg.size, rng);
    return { fen: generated.fen, size: generated.size, next };
  }
  // Royal / Skirmish / mini-run — standard 8x8 chess.
  return { fen: undefined, size: { files: 8, ranks: 8 }, next: state };
}

/**
 * RNG for a single deterministic draw from the run's seed. Each call bumps
 * `rngCursor` so subsequent calls are independent — important for tests where
 * we want the draft after match 1 to differ from the shop after match 1.
 */
export function consumeRng(state: RunState, n: number = 1): { rng: Rng; next: RunState } {
  const rng = makeRng(state.rngSeed + state.rngCursor);
  // Pre-burn `n` calls so callers that pull a single value share the same
  // cursor advance regardless of how many random numbers they consume.
  for (let i = 0; i < n; i++) rng();
  return { rng, next: { ...state, rngCursor: state.rngCursor + Math.max(1, n) } };
}

/**
 * Whether the current match is a boss match. The Standard run uses bosses
 * on matches 3 / 6 / 9 (the per-match config tells us which); the M5
 * mini-run has none.
 */
export function isBossMatch(state: RunState): boolean {
  if (state.mode === "standard") {
    try {
      return standardMatchConfig(state.matchNumber).isBoss;
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * The boss for the current match in `state`, or null if it's not a boss
 * match (or the boss isn't defined yet — only Boss A is implemented in M8).
 */
export function activeBossFor(state: RunState): BossDef | null {
  if (state.mode !== "standard") return null;
  return bossForMatch(state.matchNumber);
}

// ---- Match → reward transition ---------------------------------------------

/**
 * Apply the outcome of a finished match. Winning a non-boss match advances
 * straight to the shop (cards are now shop-only — no card-draft step). Boss
 * wins go through the reward phase for the boss-pick + boss-artifact picks
 * and then to the shop. Losing transitions to `phase: "lost"`.
 *
 * Winning the final match short-circuits straight to `won` — there's no
 * next match to spend on, so the reward + shop steps would be cosmetic.
 */
export function applyMatchOutcome(state: RunState, outcome: RunMatchOutcome): RunState {
  if (!outcome.won) {
    return { ...state, phase: "lost" };
  }
  const boss = isBossMatch(state);
  const winGold = boss ? WIN_BONUS_BOSS : WIN_BONUS_NORMAL;
  const isFinalMatch = state.matchNumber >= totalMatches(state);
  return {
    ...state,
    gold: state.gold + winGold,
    phase: isFinalMatch ? "won" : boss ? "reward" : "shop",
  };
}

// ---- Card pools ------------------------------------------------------------

/** Cards eligible to appear in shops and drafts — excludes Patches and Shivs. */
function rewardEligibleCards(): Card[] {
  return Object.values(CARD_LIBRARY).filter((c) => {
    if (c.id.endsWith("-patch")) return false; // Patches are earned via captures.
    if (c.id.startsWith("shiv-")) return false; // Shivs only spawn from Trick Bag.
    return true;
  });
}

const EXCLUDED_FROM_REWARDS: ReadonlySet<CardId> = new Set<CardId>();

export function eligibleCardsByRarity(rarity: CardRarity): Card[] {
  return rewardEligibleCards().filter(
    (c) => c.rarity === rarity && !EXCLUDED_FROM_REWARDS.has(c.id),
  );
}

/**
 * Pick `count` distinct random cards weighted by rarity. We bias toward
 * commons (~70%) with a long tail of uncommons (~25%) and rares (~5%). The
 * weights are tuning knobs — bumped via the rare-rate roll per pick.
 */
export function pickRandomCards(count: number, rng: Rng): Card[] {
  const commons = eligibleCardsByRarity("common");
  const uncommons = eligibleCardsByRarity("uncommon");
  const rares = eligibleCardsByRarity("rare");

  const out: Card[] = [];
  const usedIds = new Set<CardId>();
  // Defensive: guard against asking for more cards than the pool can provide.
  const cap = Math.min(count, commons.length + uncommons.length + rares.length);
  while (out.length < cap) {
    const r = rng();
    let pool: Card[];
    if (r < 0.05 && rares.length > 0) pool = rares;
    else if (r < 0.3 && uncommons.length > 0) pool = uncommons;
    else pool = commons;
    const candidates = pool.filter((c) => !usedIds.has(c.id));
    if (candidates.length === 0) {
      // Pool exhausted at this rarity — fall back to whatever's left.
      const all = [...commons, ...uncommons, ...rares].filter((c) => !usedIds.has(c.id));
      if (all.length === 0) break;
      const pick = all[Math.floor(rng() * all.length)];
      out.push(pick);
      usedIds.add(pick.id);
      continue;
    }
    const pick = candidates[Math.floor(rng() * candidates.length)];
    out.push(pick);
    usedIds.add(pick.id);
  }
  return out;
}

// ---- Reward (boss pick + boss artifact) ------------------------------------

/**
 * Generate the boss-reward artifact offer. Skews rare per docs/design/bosses.md
 * by drawing from the rare pool first and falling back to the regular weighted
 * pool to fill out the slate. Already-owned artifacts are excluded.
 */
export function generateBossArtifactOffer(state: RunState): {
  offer: BossArtifactOffer;
  next: RunState;
} {
  const { rng, next } = consumeRng(state);
  const owned = new Set(state.artifacts.map((a) => a.id));
  const artifacts: Artifact[] = pickRandomArtifacts(BOSS_ARTIFACT_COUNT, rng, owned);
  return {
    offer: { artifacts, skipGold: SKIP_BOSS_ARTIFACT_GOLD },
    next,
  };
}

/**
 * Pick a boss-reward artifact — appends to the run's artifact list. Does not
 * enforce the slot cap (M6's modal-pick flow is post-prototype polish — Boss A
 * arrives long before the player can plausibly fill 5 slots).
 */
export function pickBossArtifact(state: RunState, artifact: Artifact): RunState {
  return { ...state, artifacts: [...state.artifacts, artifact] };
}

/** Skip the boss artifact pick for gold instead. */
export function skipBossArtifact(state: RunState, skipGold: number): RunState {
  return { ...state, gold: state.gold + skipGold };
}

// ---- Boss reward 3-pick (Monster-Train-style) ------------------------------

/**
 * Fixed 3-option boss reward, shown on every boss win before the artifact
 * pick. The options are not RNG-driven; the player always sees the same
 * three choices.
 */
export function generateBossPickOffer(): BossPickOffer {
  return {
    options: [
      { kind: "energy-per-turn-bonus", amount: 1 },
      { kind: "draw-per-turn-bonus", amount: 1 },
      { kind: "delete-cards", count: 2 },
    ],
  };
}

/**
 * Resolve a boss-reward pick. Energy / draw bonuses become synthetic
 * artifacts on the run's artifact list — the existing artifact effect
 * machinery already plumbs `energy-per-turn-bonus` / `hand-size-bonus`
 * through `effectiveEnergyPerTurn` / `effectiveHandSize`. Delete-cards
 * sets a `bossDeleteCharges` counter; the Reward UI gates the next phase
 * until both deletions are made.
 */
export function pickBossOption(state: RunState, option: BossPickOption): RunState {
  switch (option.kind) {
    case "energy-per-turn-bonus": {
      const artifact: Artifact = {
        id: `boss-pick-energy-${state.matchNumber}`,
        name: "Boon: +1 Energy",
        rarity: "rare",
        description: "Gain +1 energy at the start of each of your turns for the rest of the run.",
        effects: [{ kind: "energy-per-turn-bonus", amount: option.amount }],
      };
      return { ...state, artifacts: [...state.artifacts, artifact] };
    }
    case "draw-per-turn-bonus": {
      const artifact: Artifact = {
        id: `boss-pick-draw-${state.matchNumber}`,
        name: "Boon: +1 Draw",
        rarity: "rare",
        description: "Draw 1 additional card each turn for the rest of the run.",
        effects: [{ kind: "hand-size-bonus", amount: option.amount }],
      };
      return { ...state, artifacts: [...state.artifacts, artifact] };
    }
    case "delete-cards": {
      return { ...state, bossDeleteCharges: option.count };
    }
  }
}

/**
 * Consume one boss-pick deletion charge, removing the card at `deckIndex`
 * from the run deck. Returns the next state, or null if `deckIndex` is out
 * of range or no charges remain.
 */
export function consumeBossDeleteCharge(state: RunState, deckIndex: number): RunState | null {
  const charges = state.bossDeleteCharges ?? 0;
  if (charges <= 0) return null;
  if (deckIndex < 0 || deckIndex >= state.deck.length) return null;
  const deck = state.deck.slice(0, deckIndex).concat(state.deck.slice(deckIndex + 1));
  const remaining = charges - 1;
  const next: RunState = { ...state, deck };
  if (remaining > 0) next.bossDeleteCharges = remaining;
  else delete next.bossDeleteCharges;
  return next;
}

// ---- Reward → shop transition ----------------------------------------------

/**
 * Move the run from the reward phase into the shop phase. After the final
 * match there's no next match to spend for, so we short-circuit to `won`.
 */
export function enterShop(state: RunState): RunState {
  const total = state.config.actCount * state.config.matchesPerAct;
  if (state.matchNumber >= total) return { ...state, phase: "won" };
  return { ...state, phase: "shop" };
}

// ---- Shop → next match (or run end) ----------------------------------------

/**
 * Leave the shop and either advance to the next match or end the run as a
 * win if all matches have been played. Caller should apply the interest
 * tally first via `applyInterest`.
 */
export function leaveShop(state: RunState): RunState {
  const total = state.config.actCount * state.config.matchesPerAct;
  if (state.matchNumber >= total) {
    return { ...state, phase: "won" };
  }
  let act = state.act;
  let matchInAct = state.matchInAct + 1;
  if (matchInAct > state.config.matchesPerAct) {
    matchInAct = 1;
    act = (act + 1) as 1 | 2 | 3;
  }
  return {
    ...state,
    act,
    matchInAct: matchInAct as 1 | 2 | 3,
    matchNumber: state.matchNumber + 1,
    phase: "match",
  };
}

// ---- Helpers ---------------------------------------------------------------

/** Total number of matches in the run (for progress UI). */
export function totalMatches(state: RunState): number {
  return state.config.actCount * state.config.matchesPerAct;
}

/**
 * Shuffle a deck with the run's seeded RNG. Used to deal a fresh draw pile
 * for the next match without cross-match correlation.
 */
export function dealDeck(state: RunState): { deck: Card[]; next: RunState } {
  const { rng, next } = consumeRng(state);
  return { deck: shuffle(state.deck, rng), next };
}
