// Match shell.
//
// Two play modes:
//   - "local-pvp" — both sides controlled on the same screen (no cards).
//   - "vs-ai"     — the human plays White, Stockfish plays Black, with the
//                   M3 card system layered on top.
//
// Player turn (vs-ai):
//   1. startPlayerTurn refills hand + resets energy + ticks overlays.
//   2. Player may play any number of cards using their energy.
//   3. Player makes their chess move — this ends their turn and immediately
//      hands control to the AI. (Cards must be played BEFORE moving a piece.)
//   4. After the AI move, we kick off the next player turn.
//
// The chess engine and the card state are deliberately separate. The card
// state lives as React state here; pure helpers in `game/cards/match.ts`
// produce new states.
//
// Decomposition:
//   - Pure derivations of MatchCardState  → `Match/derivations.ts`
//   - Pure side-effect appliers + outcome → `Match/sideEffects.ts`
//   - Undo / redo snapshot stack          → `Match/useUndoRedo.ts`
//   - Stockfish + AI turn loop            → `Match/useAiLoop.ts`
//   - Targeting + tryPlay + tryResolveCard + library free-play synth
//                                         → `Match/useCardPlay.ts`
//   - Editor brush + palette + edit-mode  → `Match/useDevEditor.ts`
//   - Sandbox actions (resize, save deck, ...)
//                                         → `Match/useDevSandbox.ts`
//   - Click / drag routing                → `Match/useBoardInteraction.ts`
// Match itself owns top-level run state, history wiring, and the JSX shell.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { Board, type BoardMode } from "./Board/Board";
import { CapturedPieces } from "./Board/CapturedPieces";
import { materialAdvantage } from "./Board/material";
import { PromotionModal } from "./Board/PromotionModal";
import { DevPanel } from "./Match/DevPanel";
import { Hand } from "./Hand/Hand";
import { ReviveModal } from "./Hand/ReviveModal";
import { PileInspector } from "./Hand/PileInspector";
import { ScryModal } from "./Hand/ScryModal";
import {
  buildExtraOverlays,
  deriveControllableSides,
  deriveOverlaySets,
  derivePieceBadges,
  deriveSquareEffects,
} from "./Match/derivations";
import { HistoryModal } from "./Match/HistoryModal";
import type { HistoryEvent } from "./Match/history";
import { outcomeDetail, outcomeHeadline } from "./Match/sideEffects";
import { useAiLoop } from "./Match/useAiLoop";
import { useCardPlay } from "./Match/useCardPlay";
import { useBoardInteraction } from "./Match/useBoardInteraction";
import { useDevEditor } from "./Match/useDevEditor";
import { useDevSandbox } from "./Match/useDevSandbox";
import { useUndoRedo } from "./Match/useUndoRedo";
import { ChoseEngine, type EngineSnapshot, type LegalMove } from "../game/chess/engine";
import { type Difficulty, type StockfishEngine, type StockfishOptions } from "../ai/stockfish";
import { parseFen } from "../game/chess/rules";
import {
  offendingSquares as validationOffendingSquares,
  validatePosition,
} from "../game/chess/validate";
import {
  completeRevive,
  createMatchCardState,
  drawPileInAcquisitionOrder,
  hasWallOn,
  insertCurseIntoHand,
  isCardEffectForbidden,
  isInPlayerHalf,
  isRooted,
  setDeckTop,
  startPlayerTurn,
  type BoardContext,
  type MatchRules,
  type Rng,
} from "../game/cards/match";
import { fireCurses, makeSchedulerState, type SchedulerState } from "../game/bosses/scheduler";
import { getCardById, getNamedDecks, makeStarterDeck } from "../game/cards/library";
import type {
  AlgebraicSquare,
  Artifact,
  BoardSize,
  BossDef,
  Card,
  CardEffect,
  MatchCardState,
  MatchOutcome,
  RunMatchOutcome,
  Side,
  Wall,
} from "../game/types";
import {
  activeZoneBuffs,
  zoneBuffSquares,
  type ZoneBoardContext,
} from "../game/overlays/zoneBuffs";

import styles from "./Match.module.css";

export type MatchMode = "local-pvp" | "vs-ai";

/**
 * Top-level run mode.
 *  - "prototype": the existing vs-ai / local-pvp playground.
 *  - "dev":       the development sandbox (board editor, free card library,
 *                 optional AI).
 *  - "run":       a match inside a real run. The Run shell holds RunState and
 *                 owns post-match flow (reward + shop), so Match hides its
 *                 own "New game" / mode-toggle / Reset chrome and instead
 *                 reports the outcome via `onMatchEnd`.
 * Skirmish lives on top of "run" — that's just a different deck / starting
 * board passed in from the Run shell, not a different Match mode.
 */
export type RunMode = "prototype" | "dev" | "run";

/**
 * localStorage key remembering whether the player has the dev panel open
 * inside a real run. Persists across matches and runs so toggling once
 * sticks.
 */
const DEV_PANEL_OPEN_KEY = "choss:devPanelOpen";

type Props = {
  /** Top-level run mode. Defaults to "prototype" so existing tests keep working. */
  runMode?: RunMode;
  /** Called when the user wants to leave the match shell (back to menu). */
  onExit?: () => void;
  /**
   * Run mode: fires once when the match transitions out of "ongoing". The
   * Run shell consumes this to advance to the reward / loss phase.
   */
  onMatchEnd?: (outcome: RunMatchOutcome) => void;
  /** Default mode. Defaults to "vs-ai". Tests pass "local-pvp" to skip AI. */
  initialMode?: MatchMode;
  initialDifficulty?: Difficulty;
  /** Optional starting FEN. Used by tests to set up specific positions. */
  initialFen?: string;
  /**
   * Board dimensions. Defaults to 8×8 for back-compat. Standard-mode matches
   * pass per-match sizes (6×6 / 7×7 / 8×8, one square size per act in
   * `standard.ts`); the dev sandbox passes whatever the user picked from the
   * size dropdowns.
   */
  initialBoardSize?: BoardSize;
  /** Hook to swap the AI engine in tests. */
  createAi?: (opts?: StockfishOptions) => StockfishEngine;
  /**
   * Minimum time the AI must "think" before its move lands, in ms. Stops shallow
   * depths from snap-moving. Tests override this to 0 to skip the wait.
   */
  aiMinThinkMs?: number;
  /** Inject a deck for tests. */
  initialDeck?: Card[];
  /**
   * Artifacts active for this match — defaults to none. The Run shell passes
   * the run's current artifact list so per-match modifiers (hand size,
   * energy, cost discounts, capture / check triggers) take effect.
   */
  initialArtifacts?: ReadonlyArray<Artifact>;
  /**
   * Run mode: bubble dev-edited artifact changes back up to the run shell so
   * the new artifact list persists across the next match remount. Undefined
   * in prototype / sandbox where there's no run state to update.
   */
  onSaveArtifacts?: (artifacts: ReadonlyArray<Artifact>) => void;
  /**
   * Run mode: replace the run-level deck wholesale when the dev panel loads
   * a named deck (authored in the Content Designer). The match's piles are
   * also rebuilt locally so the change is felt immediately without a remount.
   */
  onLoadDeck?: (cards: ReadonlyArray<Card>) => void;
  /** Inject an RNG for tests so card order is deterministic. */
  rng?: Rng;
  /**
   * Override the starting energy for tests. Production starts at
   * STARTING_ENERGY (1) and banks +1 each turn; tests sometimes need a
   * larger pool so existing scenarios (cost-2+ cards on turn 1) keep working.
   */
  initialEnergy?: number;
  /**
   * Override the initial value of `devAiOn`. Defaults to true (player faces
   * an active AI in both `run` and `dev` modes). Tests use this to disable
   * the AI when they want to drive both sides.
   */
  initialDevAiOn?: boolean;
  /**
   * Active boss for this match, if any. The Run shell passes the BossDef when
   * the current match is a boss; Match enforces the modifier rules, places
   * the boss's permanent walls at match start, and runs the curse scheduler.
   */
  activeBoss?: BossDef | null;
  /**
   * Run mode: when the run has ended (won/lost), the Run shell passes the
   * end-of-run summary node here. Match renders it in place of the regular
   * side panel so the final board position stays visible alongside.
   */
  endOfRunPanel?: ReactNode;
  /**
   * Display-only mode: render the board frozen at the given starting state
   * with no Hand / CapturedPieces / dev toggle. Used by the Run shell to
   * re-mount a snapshot of the final position on the run-complete screen
   * after reward / shop have unmounted the live Match.
   */
  displayOnly?: boolean;
  /**
   * Optional engine snapshot to seed the match from — preserves move history
   * (so capture trays show real captures) and the exact ending position. Used
   * with `initialCardState` and `displayOnly` for the run-complete view.
   */
  initialEngineSnapshot?: EngineSnapshot;
  /**
   * Optional full card-system snapshot to seed the match from. Carries walls,
   * freezes, sanctuaries, traps, zone buffs, hand / piles, energy, etc. so
   * the snapshot view shows everything the live match was rendering.
   */
  initialCardState?: MatchCardState;
  /**
   * Run mode: fired once alongside `onMatchEnd` with the engine + card-system
   * snapshots, so the Run shell can re-mount a faithful display-only board on
   * the run-complete screen.
   */
  onCaptureFinalSnapshot?: (snap: {
    engineSnapshot: EngineSnapshot;
    cardState: MatchCardState;
    size: BoardSize;
  }) => void;
  /**
   * Run mode: fires when a dev-panel undo rolls the engine back across a
   * match-end boundary. The Run shell uses it to revert its own phase /
   * pendingWin (which were advanced by the matching `onMatchEnd`) so the
   * player can retry a losing line without leaving the run desynchronized.
   */
  onRevertMatchEnd?: () => void;
};

const DEFAULT_AI_MIN_THINK_MS = 500;

/**
 * Map a coordinate (file or rank) when the board grows or shrinks. Each +/-1
 * step adds or removes a single line at the middle index of the *new* size
 * (`floor(newSize/2)` on grow, `floor(oldSize/2)` on shrink), so back ranks
 * survive a step intact. Returns `null` if the coordinate falls on a removed
 * line. Multi-step deltas iterate so the result is consistent with stepping
 * one at a time through the dev panel.
 */
/**
 * Build a `ZoneBoardContext` view of the engine's current position. Used by
 * `startPlayerTurn` to evaluate which zone-buffs are active (the player must
 * have a piece in the buff's region for it to grant its bonus).
 */
function zoneBoardContextOf(engine: ChoseEngine): ZoneBoardContext {
  return {
    size: engine.size(),
    pieceSideAt: (sq) => engine.pieceAt(sq)?.side ?? null,
    pieceTypeAt: (sq) => engine.pieceAt(sq)?.type ?? null,
  };
}

const HUMAN_SIDE: Side = "player";
const AI_SIDE: Side = "opponent";

export function Match({
  runMode = "prototype",
  onExit,
  onMatchEnd,
  initialMode = "vs-ai",
  initialDifficulty = "normal",
  initialFen,
  initialBoardSize,
  createAi,
  aiMinThinkMs = DEFAULT_AI_MIN_THINK_MS,
  initialDeck,
  initialArtifacts,
  onSaveArtifacts,
  onLoadDeck,
  rng,
  initialEnergy,
  initialDevAiOn,
  activeBoss,
  endOfRunPanel,
  displayOnly = false,
  initialEngineSnapshot,
  initialCardState,
  onCaptureFinalSnapshot,
  onRevertMatchEnd,
}: Props = {}) {
  // Dev mode forces the card system on (mode = "vs-ai"); the per-match
  // vs-AI / Local-PvP toggle is hidden in the side panel. The AI itself is
  // gated separately by `devAiOn` below.
  const [mode, setMode] = useState<MatchMode>(runMode === "dev" ? "vs-ai" : initialMode);
  const [difficulty, setDifficulty] = useState<Difficulty>(initialDifficulty);
  const [engine, setEngine] = useState(() => {
    const e = new ChoseEngine(initialFen, initialBoardSize);
    if (initialEngineSnapshot) e.restore(initialEngineSnapshot);
    return e;
  });
  const [selected, setSelected] = useState<AlgebraicSquare | null>(null);
  // Bumped after each move so derived render values recompute.
  const [version, setVersion] = useState(0);
  const bumpVersion = useCallback(() => setVersion((v) => v + 1), []);
  const resetVersion = useCallback(() => setVersion(0), []);

  // ---- Dev-mode state ------------------------------------------------------
  /**
   * Whether the dev panel is visible. Always shown in sandbox; in real runs
   * it's hidden by default and the player toggles it from the right edge.
   * Prototype mode never exposes the dev panel.
   *
   * In a real run the toggle is persisted to localStorage so opening the
   * dev panel once keeps it open across subsequent matches and runs.
   */
  const [devPanelOpen, setDevPanelOpen] = useState(() => {
    if (runMode === "dev") return true;
    if (runMode !== "run") return false;
    try {
      return window.localStorage.getItem(DEV_PANEL_OPEN_KEY) === "true";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (runMode !== "run") return;
    try {
      window.localStorage.setItem(DEV_PANEL_OPEN_KEY, devPanelOpen ? "true" : "false");
    } catch {
      // Ignore — private mode / quota errors shouldn't break gameplay.
    }
  }, [runMode, devPanelOpen]);
  /**
   * The dev panel is "active" — i.e. its hooks (editor brush, library
   * free-play, side-to-move toggle) should affect Match interactions —
   * whenever it's visible.
   */
  const devPanelEnabled = runMode === "dev" || (runMode === "run" && devPanelOpen);
  // Eager-loaded JSON; `useMemo` is just to keep the prop reference stable.
  // Vite HMR rewrites the import.meta.glob result when files in
  // `src/game/cards/decks/named/` change, which triggers a re-render.
  const namedDecks = useMemo(() => getNamedDecks(), []);
  /**
   * AI plays Black? Defaults to on in both sandbox and real runs — the player
   * faces an active AI unless they explicitly toggle it off from the dev
   * panel. The prototype ignores this and always plays.
   */
  const [devAiOn, setDevAiOn] = useState(initialDevAiOn ?? true);
  /**
   * "Chess vision" — when on, every square attacked by either side gets a
   * coloured tint: blue for player-only, red for opponent-only, purple for
   * both. Useful for spotting threats and overworked defenders at a glance.
   */
  const [chessVision, setChessVision] = useState(false);

  // ---- Card-system state (vs-ai only) --------------------------------------

  const cardsEnabled = mode === "vs-ai";
  // Match is re-mounted between matches (Run shell uses `key={match-N}`), so
  // initializing from the prop is sufficient. The dev artifact editor mutates
  // this state, and bubbles changes up via `onSaveArtifacts` so the run shell
  // can persist them across the next remount.
  const [artifacts, setArtifacts] = useState<ReadonlyArray<Artifact>>(
    () => initialCardState?.artifacts ?? initialArtifacts ?? [],
  );
  const [cardState, setCardState] = useState<MatchCardState>(() => {
    if (initialCardState) return initialCardState;
    if (!cardsEnabled) return createMatchCardState([], rng, artifacts);
    let base = createMatchCardState(initialDeck ?? makeStarterDeck(), rng, artifacts);
    if (activeBoss && activeBoss.hazardWalls.length > 0) {
      // Boss hazards live for the whole match — `permanent: true` causes the
      // start-of-turn ticker (and any future card-removal flow) to skip them.
      const walls: Wall[] = activeBoss.hazardWalls.map((sq) => ({
        square: sq,
        expiresOnTurn: Number.POSITIVE_INFINITY,
        permanent: true,
      }));
      base = { ...base, walls };
    }
    if (activeBoss && activeBoss.zoneBuffs && activeBoss.zoneBuffs.length > 0) {
      // Boss-placed zone-buffs live for the whole match (no expiry).
      const buffs = activeBoss.zoneBuffs.map((b) => ({
        region: b.region,
        effect: b.buff,
        side: "player" as Side,
        sourceLabel: b.sourceLabel,
      }));
      base = { ...base, zoneBuffs: [...base.zoneBuffs, ...buffs] };
    }
    const fresh = startPlayerTurn(base, rng, zoneBoardContextOf(engine));
    return initialEnergy !== undefined ? { ...fresh, energy: initialEnergy } : fresh;
  });
  /** Per-match curse-scheduler state. Reset on new game / mode change. */
  const schedulerStateRef = useRef<SchedulerState>(makeSchedulerState());
  /** Tracks whether the first-turn scheduler tick has already fired. */
  const firstTurnSchedulerRef = useRef(false);

  // Boss modifiers materialised into a MatchRules object the playCard helper
  // and the Hand UI both consume. `no-player-walls` blocks place-wall cards.
  const matchRules: MatchRules = useMemo(() => {
    if (!activeBoss) return {};
    const forbidden = new Set<CardEffect["kind"]>();
    if (activeBoss.modifier.kind === "no-player-walls") forbidden.add("place-wall");
    const out: MatchRules = {};
    if (forbidden.size > 0) out.forbiddenCardEffectKinds = forbidden;
    if (activeBoss.modifier.kind === "no-promotion") out.noPromotion = true;
    return out;
  }, [activeBoss]);

  // Per-card boss-modifier veto, surfaced to <Hand> so forbidden cards render
  // as greyed-out (not just silently rejected on click).
  const forbiddenHandIndexes = useMemo<ReadonlySet<number>>(() => {
    if (!matchRules.forbiddenCardEffectKinds || matchRules.forbiddenCardEffectKinds.size === 0) {
      return new Set();
    }
    const out = new Set<number>();
    cardState.hand.forEach((slot, i) => {
      if (isCardEffectForbidden(slot.card.effect, matchRules)) out.add(i);
    });
    return out;
  }, [cardState.hand, matchRules]);
  /** Which pile inspector is open, if any. */
  const [pileInspector, setPileInspector] = useState<"draw" | "discard" | null>(null);

  // Undo / redo stack — one snapshot per turn rollover (prototype) plus one
  // per dev-mode action (editor edit, energy bump, library card play).
  const undoRedo = useUndoRedo(engine);

  // ---- History log ---------------------------------------------------------
  // A chronological, JSON-serializable log of every action taken in the match.
  // Powers the History modal + its export button. Carried inside each undo
  // snapshot, so undo / redo rewind the log alongside the engine and card
  // state. The ref is the canonical source so callbacks can append synchronously
  // without reading stale React state.
  const historyRef = useRef<HistoryEvent[]>([]);
  const [history, setHistory] = useState<HistoryEvent[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  const pushHistory = useCallback((event: HistoryEvent): HistoryEvent[] => {
    const next = [...historyRef.current, event];
    historyRef.current = next;
    setHistory(next);
    return next;
  }, []);

  const replaceHistory = useCallback((next: HistoryEvent[]) => {
    historyRef.current = next.slice();
    setHistory(next.slice());
  }, []);

  // Wrapper around the raw `pushSnapshot` so callers don't need to thread
  // history through every callsite — we always pull from the ref.
  const pushSnapshot = useCallback(
    (state: MatchCardState) => {
      undoRedo.pushSnapshot(state, historyRef.current);
    },
    [undoRedo],
  );

  // Seed the initial snapshot once per mount (and again on reset / mode
  // change — both reset the stack first via undoRedo.reset()).
  useEffect(() => {
    if (undoRedo.undoDepth > 0) return;
    if (mode !== "vs-ai") return;
    const initial: HistoryEvent[] = [
      {
        kind: "match-start",
        turn: cardState.turn,
        fen: engine.fen(),
        size: engine.size(),
        mode,
      },
    ];
    historyRef.current = initial;
    setHistory(initial);
    undoRedo.seed({ engineSnapshot: engine.snapshot(), cardState, history: initial });
    // engine + cardState are captured by the closure; intentional.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [undoRedo.undoDepth, mode]);

  // Sync the current overlays to the engine BEFORE any engine method
  // (legalMoves / inCheck / outcome) is called this render. The engine is
  // mutable and shared; setting overlays here is idempotent.
  const overlays = useMemo(() => deriveOverlaySets(cardState), [cardState]);
  const { walledSet, frozenSet, rootedSet, sanctuarySet, trapSet } = overlays;
  const extraOverlays = useMemo(
    () => buildExtraOverlays(overlays, cardState.artifacts),
    [overlays, cardState.artifacts],
  );
  engine.setOverlays(walledSet, frozenSet, extraOverlays);

  // Chess-vision overlays. Computed only when the toggle is on. Recomputed
  // whenever the position or overlays change (version bumps after every
  // chess move; walledSet/frozenSet/extraOverlays change after card plays).
  const attackedByPlayer = useMemo<ReadonlySet<AlgebraicSquare>>(
    () => (chessVision ? engine.attackedSquares("player") : new Set()),
    // engine is mutable; deps below force recompute on relevant changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chessVision, version, walledSet, frozenSet, extraOverlays],
  );
  const attackedByOpponent = useMemo<ReadonlySet<AlgebraicSquare>>(
    () => (chessVision ? engine.attackedSquares("opponent") : new Set()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chessVision, version, walledSet, frozenSet, extraOverlays],
  );

  const pieceBadges = useMemo(() => derivePieceBadges(cardState), [cardState]);
  const squareEffectsMap = useMemo(() => {
    const base = deriveSquareEffects(cardState);
    if (!activeBoss?.voidSquares || activeBoss.voidSquares.length === 0) return base;
    // Layer in the boss's void squares as a permanent hover-info entry.
    // The base map is read-only; clone-then-augment.
    const merged = new Map(base);
    for (const sq of activeBoss.voidSquares) {
      const existing = merged.get(sq);
      const piece = existing?.piece ?? [];
      const square = existing?.square ?? [];
      merged.set(sq, {
        piece,
        square: [...square, { label: "Void (any piece ending here is destroyed)" }],
      });
    }
    return merged;
  }, [cardState, activeBoss]);

  // Zone-buff aura squares. Active = the controlling side has a piece in the
  // region right now (the buff's effect applies); Inactive = region is not
  // controlled (rendered with a paler tint as a hint). Anchors are the
  // origin squares (only meaningful for card-placed buffs; rank buffs have
  // no anchor).
  // engine is mutable; depend on `version` (chess move) and on the buff list.
  const zoneBuffOverlay = useMemo(
    () => {
      const buffs = cardState.zoneBuffs ?? [];
      if (buffs.length === 0) {
        return {
          active: new Set<AlgebraicSquare>(),
          inactive: new Set<AlgebraicSquare>(),
          anchors: new Set<AlgebraicSquare>(),
          activeBuffs: [] as typeof buffs,
        };
      }
      const ctx = zoneBoardContextOf(engine);
      const activeList = activeZoneBuffs(buffs, ctx);
      const activeSet = new Set(activeList);
      const inactive = buffs.filter((b) => !activeSet.has(b));
      const anchors = new Set<AlgebraicSquare>();
      for (const b of buffs) {
        if (b.region.kind !== "rank" && b.region.kind !== "center") {
          anchors.add(b.region.anchor);
        }
      }
      return {
        active: zoneBuffSquares(activeList, engine.size()),
        inactive: zoneBuffSquares(inactive, engine.size()),
        anchors,
        activeBuffs: activeList,
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cardState.zoneBuffs, version],
  );

  // Position validation — only meaningful when the dev panel is active.
  // We re-derive from the current chess position on every render that bumps
  // `version` (move applied / piece placed / piece removed / size change).
  // The result drives red highlights on the Board and the message list in
  // DevPanel. Validation flags but does not block edits.
  const validation = useMemo(
    () => {
      if (!devPanelEnabled) return null;
      return validatePosition(parseFen(engine.fen(), engine.size()));
    },
    // engine is mutable; depend on version so we rerun after every change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [devPanelEnabled, version],
  );
  const invalidSquares = useMemo<ReadonlySet<AlgebraicSquare>>(
    () => (validation ? validationOffendingSquares(validation) : new Set()),
    [validation],
  );
  const validationMessages = useMemo<ReadonlyArray<string>>(
    () => (validation ? validation.violations.map((v) => v.message) : []),
    [validation],
  );

  const turn: Side = engine.turn();
  const outcome: MatchOutcome = engine.outcome();
  const matchOver = outcome.kind !== "ongoing";
  const inCheck = engine.inCheck();

  // Run mode: report the match outcome up to the Run shell exactly once. The
  // shell drives the reward / loss screen — Match itself just plays chess.
  // We compare against the previous outcome.kind so the fire-once trigger
  // survives renders, undo, and the React strict-mode double-invoke pattern.
  const matchEndedRef = useRef(false);
  useEffect(() => {
    if (runMode !== "run") return;
    if (!onMatchEnd) return;
    if (!matchOver) {
      matchEndedRef.current = false;
      return;
    }
    if (matchEndedRef.current) return;
    matchEndedRef.current = true;
    const won =
      (outcome.kind === "checkmate" || outcome.kind === "king-captured") &&
      outcome.winner === HUMAN_SIDE;
    onMatchEnd({ won, outcome, turnsPlayed: cardState.turn });
    onCaptureFinalSnapshot?.({
      engineSnapshot: engine.snapshot(),
      cardState,
      size: engine.size(),
    });
    // engine is mutable; depend on version so we re-snapshot the latest state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runMode, onMatchEnd, onCaptureFinalSnapshot, matchOver, outcome, cardState, version]);
  // In sandbox + run modes, the AI is gated by `devAiOn` (defaults: off in
  // sandbox, on in run). Prototype always fires. This lets the dev panel
  // disable the AI in a real Royal run for debugging without changing the
  // default Royal experience.
  const aiOn = runMode === "prototype" ? true : devAiOn;
  const isAiTurn = mode === "vs-ai" && turn === AI_SIDE && !matchOver && aiOn;

  const controllableSides = useMemo(() => deriveControllableSides(mode, runMode), [mode, runMode]);

  // Legal moves originating from the selected square. Recomputed when the
  // chess position OR the wall/freeze overlays change. Boss curses
  // (`mustNotCheckNextMove` from Throttled) further filter the set down.
  // Boss C `no-promotion` strips out the promotion candidates entirely;
  // pawns reaching the back rank simply have no legal move.
  const legalFromSelected: LegalMove[] = useMemo(() => {
    if (!selected) return [];
    let moves = engine.legalMoves(selected);
    if (cardState.mustNotCheckNextMove) {
      moves = moves.filter((m) => !engine.wouldDeliverCheck(m));
    }
    if (matchRules.noPromotion) {
      moves = moves.filter((m) => !m.isPromotion);
    }
    return moves;
    // version invalidates after a move; walledSet/frozenSet after a card play
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    engine,
    selected,
    version,
    walledSet,
    frozenSet,
    cardState.mustNotCheckNextMove,
    matchRules.noPromotion,
  ]);

  // ---- AI move loop ---------------------------------------------------------

  /**
   * Run the boss curse scheduler against `event` and append any returned
   * curses to `state.hand`. Pure on the curse list; mutates the scheduler
   * ref in place. No-ops if there's no active boss.
   */
  const applyCurseScheduler = useCallback(
    (
      state: MatchCardState,
      event: import("../game/bosses/scheduler").SchedulerEvent,
    ): MatchCardState => {
      if (!activeBoss || activeBoss.curses.length === 0) return state;
      const result = fireCurses(activeBoss.curses, schedulerStateRef.current, event);
      schedulerStateRef.current = result.next;
      let next = state;
      for (const id of result.curseIds) {
        try {
          next = insertCurseIntoHand(next, getCardById(id));
        } catch {
          // Unknown curse id — surface in the console but don't break the match.
          // (This should be caught by the build-time validator anyway.)
          // eslint-disable-next-line no-console
          console.error(`[boss] unknown curse id '${id}'`);
        }
      }
      return next;
    },
    [activeBoss],
  );

  // First-turn boss scheduler tick — fires once on mount so a `turn` trigger
  // pinned to turn 1 (e.g. Boss C's Hardened) lands in the player's hand
  // before they take any action. Boss A's only trigger is `on-player-check`,
  // so this is a no-op for it; harmless to fire either way.
  useEffect(() => {
    if (firstTurnSchedulerRef.current) return;
    if (displayOnly) {
      // Snapshot view — the cardState is already final; running the
      // scheduler would mutate it past match end and corrupt the display.
      firstTurnSchedulerRef.current = true;
      return;
    }
    if (!activeBoss || activeBoss.curses.length === 0) return;
    if (!cardsEnabled) return;
    firstTurnSchedulerRef.current = true;
    setCardState((s) => applyCurseScheduler(s, { kind: "turn-start", turn: s.turn }));
  }, [activeBoss, cardsEnabled, applyCurseScheduler, displayOnly]);

  /**
   * Roll over to a fresh player turn: refill hand, +1 energy, decay statuses,
   * commit to React state, push a snapshot for undo. Also fires the boss
   * scheduler's `turn-start` event so timed curse triggers fire before the
   * player sees their hand. Caller is responsible for any pre-rollover work
   * (e.g. trap resolution) — `state` is what gets fed straight into
   * `startPlayerTurn`.
   */
  const applyTurnRollover = useCallback(
    (state: MatchCardState) => {
      const turnStarted = startPlayerTurn(state, rng, zoneBoardContextOf(engine));
      const withCurses = applyCurseScheduler(turnStarted, {
        kind: "turn-start",
        turn: turnStarted.turn,
      });
      setCardState(withCurses);
      pushSnapshot(withCurses);
    },
    [rng, pushSnapshot, engine, applyCurseScheduler],
  );

  const { aiThinking, aiError, triggerAiSingleMove, cancelInFlightAi } = useAiLoop({
    engine,
    mode,
    cardsEnabled,
    difficulty,
    aiMinThinkMs,
    displayOnly,
    createAi,
    isAiTurn,
    matchOver,
    turn,
    activeBoss,
    cardState,
    setCardState,
    bumpVersion,
    pushHistory,
    applyTurnRollover,
  });

  // ---- Player input handlers -----------------------------------------------

  const boardContext: BoardContext = useMemo(
    () => ({
      pieceAt: (sq) => engine.pieceAt(sq),
      hasWall: (sq) => hasWallOn(cardState, sq),
      isAttackedBy: (sq, by) => engine.isSquareAttackedBy(sq, by),
      isRooted: (sq) => isRooted(cardState, sq),
      boardRanks: engine.size().ranks,
      boardFiles: engine.size().files,
    }),
    // engine is mutable; version forces recompute on each move
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [engine, version, cardState],
  );

  const cardPlay = useCardPlay({
    engine,
    cardState,
    setCardState,
    bumpVersion,
    rng,
    boardContext,
    matchRules,
    mode,
    runMode,
    devPanelEnabled,
    devAiOn,
    aiThinking,
    matchOver,
    turn,
    applyTurnRollover,
    applyCurseScheduler,
    pushHistory,
    pushSnapshot,
    setSelected,
    artifacts,
    activeBoss,
  });
  const {
    targetingIndex,
    setTargetingIndex,
    partialTarget,
    setPartialTarget,
    marionetteMoves,
    setMarionetteMoves,
    scryPending,
    setScryPending,
    revivePending,
    setRevivePending,
    promotionPending,
    setPromotionPending,
    libraryFreePlayActive,
    tryPlay,
    tryResolveCard,
    cancelTargeting,
    onCardClick,
    onCardDragStart,
    onCardDragEnd,
    synthesizeLibraryCard,
    resetCardPlay,
  } = cardPlay;

  const devEditor = useDevEditor({
    engine,
    cardState,
    setCardState,
    bumpVersion,
    pushSnapshot,
    pushHistory,
    setSelected,
  });
  const {
    editorPiece,
    setEditorPiece,
    editMode,
    paletteDragActive,
    paletteDragRef,
    editDragFromRef,
    onToggleEditMode,
    onPaletteDragStart,
    onPaletteDragEnd,
    applyEditorEdit,
    applyEditorMove,
    eraseDraggedPiece,
    resetDevEditor,
  } = devEditor;

  const targetingCard: Card | null =
    targetingIndex !== null ? (cardState.hand[targetingIndex]?.card ?? null) : null;

  /** Squares that are valid targets for the current in-flight card. */
  const validTargetSquares = useMemo<ReadonlySet<AlgebraicSquare>>(() => {
    if (!targetingCard) return new Set();
    const out = new Set<AlgebraicSquare>();
    const allPieces = engine.pieces();
    const targetKind = targetingCard.target.kind;
    if (targetKind === "marionette" && partialTarget) {
      // Phase 2: destinations from the puppet's legal-move list.
      for (const m of marionetteMoves) out.add(m.to);
      return out;
    }
    if (targetKind === "two-own-pieces" && partialTarget) {
      // Phase 2: any other own piece.
      for (const { square, piece } of allPieces) {
        if (piece.side === "player" && square !== partialTarget) out.add(square);
      }
      return out;
    }
    if (targetKind === "marionette") {
      // Phase 1: enemy pieces with at least one legal move.
      for (const { square, piece } of allPieces) {
        if (piece.side !== "opponent") continue;
        if (engine.foreignLegalMoves(square).length > 0) out.add(square);
      }
      return out;
    }
    if (targetKind === "two-own-pieces") {
      for (const { square, piece } of allPieces) {
        if (piece.side === "player") out.add(square);
      }
      return out;
    }
    if (targetKind === "empty-square" || targetKind === "empty-square-own-half") {
      const ownHalfOnly = targetKind === "empty-square-own-half";
      const { files, ranks } = engine.size();
      for (let r = 1; r <= ranks; r++) {
        for (let f = 0; f < files; f++) {
          const sq = "abcdefgh"[f] + r;
          if (engine.pieceAt(sq)) continue;
          if (walledSet.has(sq)) continue;
          if (ownHalfOnly && !isInPlayerHalf(sq, ranks)) continue;
          out.add(sq);
        }
      }
      return out;
    }
    if (targetKind === "enemy-piece") {
      for (const { square, piece } of allPieces) {
        if (piece.side === "opponent") out.add(square);
      }
      return out;
    }
    if (targetKind === "enemy-non-king-piece") {
      const requireAttacked =
        targetingCard.effect.kind === "destroy-piece" &&
        targetingCard.effect.filter === "attacked-by-player";
      for (const { square, piece } of allPieces) {
        if (piece.side !== "opponent") continue;
        if (piece.type === "king") continue;
        if (requireAttacked && !engine.isSquareAttackedBy(square, "player")) continue;
        out.add(square);
      }
      return out;
    }
    if (targetKind === "rooted-enemy-and-own-piece" || targetKind === "enemy-and-own-piece") {
      if (partialTarget) {
        // Phase 2: any of the player's pieces (other than the picked enemy).
        for (const { square, piece } of allPieces) {
          if (piece.side === "player" && square !== partialTarget) out.add(square);
        }
        return out;
      }
      // Phase 1: enemy non-king pieces. The rooted variant additionally
      // requires the enemy piece to carry a Tangled (root) status.
      for (const { square, piece } of allPieces) {
        if (piece.side !== "opponent") continue;
        if (piece.type === "king") continue;
        if (targetKind === "rooted-enemy-and-own-piece" && !rootedSet.has(square)) continue;
        out.add(square);
      }
      return out;
    }
    if (targetKind === "own-piece" || targetKind === "own-non-king-piece") {
      const excludeKing = targetKind === "own-non-king-piece";
      const patchPattern =
        targetingCard.effect.kind === "empower-piece" && targetingCard.effect.singleUse === true
          ? targetingCard.effect.pattern
          : null;
      for (const { square, piece } of allPieces) {
        if (piece.side !== "player") continue;
        if (excludeKing && piece.type === "king") continue;
        if (patchPattern !== null && piece.type === patchPattern) continue;
        out.add(square);
      }
      return out;
    }
    return out;
    // engine is mutable; depend on version + walls + rooted
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetingCard, partialTarget, marionetteMoves, walledSet, rootedSet, version]);

  const boardMode: BoardMode = useMemo(() => {
    if (!targetingCard) return { kind: "play" };
    const k = targetingCard.target.kind;
    if (k === "none") {
      return {
        kind: "drop-anywhere",
        cardName: targetingCard.name,
        hint: `Drop anywhere on the board to play ${targetingCard.name}`,
      };
    }
    let hint = "";
    if (k === "empty-square") hint = `Pick an empty square for ${targetingCard.name}`;
    else if (k === "empty-square-own-half")
      hint = `Pick an empty square in your half (ranks 1–4) for ${targetingCard.name}`;
    else if (k === "enemy-piece") hint = `Pick an enemy piece for ${targetingCard.name}`;
    else if (k === "enemy-non-king-piece") {
      if (
        targetingCard.effect.kind === "destroy-piece" &&
        targetingCard.effect.filter === "attacked-by-player"
      ) {
        hint = `Pick an enemy piece your forces are attacking for ${targetingCard.name}`;
      } else {
        hint = `Pick an enemy non-King piece for ${targetingCard.name}`;
      }
    } else if (k === "own-piece") hint = `Pick one of your pieces for ${targetingCard.name}`;
    else if (k === "own-non-king-piece")
      hint = `Pick one of your non-King pieces for ${targetingCard.name}`;
    else if (k === "two-own-pieces")
      hint = partialTarget
        ? `Pick the second piece for ${targetingCard.name}`
        : `Pick the first piece for ${targetingCard.name}`;
    else if (k === "marionette")
      hint = partialTarget
        ? `Pick a destination for ${targetingCard.name}`
        : `Pick an enemy piece to control with ${targetingCard.name}`;
    else if (k === "rooted-enemy-and-own-piece")
      hint = partialTarget
        ? `Pick one of your pieces to swap with the rooted enemy for ${targetingCard.name}`
        : `Pick a rooted enemy piece for ${targetingCard.name}`;
    else if (k === "enemy-and-own-piece")
      hint = partialTarget
        ? `Pick one of your pieces to swap with the chosen enemy for ${targetingCard.name}`
        : `Pick an enemy piece for ${targetingCard.name}`;
    return { kind: "target", cardName: targetingCard.name, hint, valid: validTargetSquares };
  }, [targetingCard, partialTarget, validTargetSquares]);

  // ---- Dev-mode helpers ----------------------------------------------------

  const devSandbox = useDevSandbox({
    engine,
    setEngine,
    cardState,
    setCardState,
    bumpVersion,
    resetVersion,
    rng,
    pushSnapshot,
    pushHistory,
    replaceHistory,
    undoRedo,
    mode,
    artifacts,
    setArtifacts,
    initialDeck,
    onLoadDeck,
    onSaveArtifacts,
    onMatchEnd,
    matchEndedRef,
    matchOver,
    runMode,
    cancelInFlightAi,
    resetCardPlay,
    resetDevEditor,
    setSelected,
    synthesizeLibraryCard,
    cancelTargeting,
  });
  const {
    setSideToMove,
    clearBoard,
    resizeBoard,
    standardStart,
    randomStart,
    bumpEnergy,
    skipMatchAndWin,
    saveDeck,
    loadDeck,
    saveArtifacts,
    playLibraryCard,
    dragStartLibraryCard,
    dragEndLibraryCard,
  } = devSandbox;

  // ---- Square click / drag (chess move OR card target) ---------------------

  const { onSquareClick, onSquareDragStart, onSquareDrop, onDragCancel } = useBoardInteraction({
    engine,
    controllableSides,
    turn,
    aiThinking,
    matchOver,
    devPanelEnabled,
    selected,
    setSelected,
    targetingIndex,
    targetingCard,
    partialTarget,
    marionetteMoves,
    setPartialTarget,
    setMarionetteMoves,
    tryPlay,
    tryResolveCard,
    cancelTargeting,
    editorPiece,
    setEditorPiece,
    editMode,
    paletteDragRef,
    editDragFromRef,
    applyEditorEdit,
    applyEditorMove,
    onPaletteDragEnd,
    rootedSet,
  });

  // ---- Game lifecycle -------------------------------------------------------

  const resetGame = useCallback(() => {
    cancelInFlightAi();
    const freshEngine = new ChoseEngine(initialFen, initialBoardSize);
    setEngine(freshEngine);
    setSelected(null);
    setVersion(0);
    resetCardPlay();
    undoRedo.reset();
    replaceHistory([]);
    resetDevEditor();
    if (mode === "vs-ai") {
      setCardState(
        startPlayerTurn(
          createMatchCardState(initialDeck ?? makeStarterDeck(), rng, artifacts),
          rng,
          zoneBoardContextOf(freshEngine),
        ),
      );
    } else {
      setCardState(createMatchCardState([], rng, artifacts));
    }
  }, [
    initialFen,
    initialBoardSize,
    initialDeck,
    mode,
    rng,
    undoRedo,
    replaceHistory,
    artifacts,
    cancelInFlightAi,
    resetCardPlay,
    resetDevEditor,
  ]);

  const onModeChange = useCallback(
    (next: MatchMode) => {
      if (next === mode) return;
      cancelInFlightAi();
      setMode(next);
      const freshEngine = new ChoseEngine(initialFen, initialBoardSize);
      setEngine(freshEngine);
      setSelected(null);
      setVersion(0);
      resetCardPlay();
      undoRedo.reset();
      replaceHistory([]);
      resetDevEditor();
      if (next === "vs-ai") {
        setCardState(
          startPlayerTurn(
            createMatchCardState(initialDeck ?? makeStarterDeck(), rng, artifacts),
            rng,
            zoneBoardContextOf(freshEngine),
          ),
        );
      } else {
        setCardState(createMatchCardState([], rng, artifacts));
      }
    },
    [
      mode,
      initialFen,
      initialBoardSize,
      initialDeck,
      rng,
      undoRedo,
      replaceHistory,
      artifacts,
      cancelInFlightAi,
      resetCardPlay,
      resetDevEditor,
    ],
  );

  /**
   * Undo / redo are unlimited and rewind across the AI's preceding move —
   * a snapshot represents the start of a player turn (or the start of a
   * dev-mode action). Gated on aiThinking only: the player can rewind out
   * of a checkmate / stalemate to retry the losing line.
   */
  // Run mode without the dev panel: once the match is over, the Run shell
  // has already recorded the outcome (loss → "lost" phase, win → pendingWin
  // awaiting reward step), and we don't expose an undo button to the player.
  // With the dev panel open we *do* allow rewinding past match-end so devs /
  // testers can retry a losing line; `onRevertMatchEnd` rolls the run state
  // back in lock-step. Prototype / dev keep the rewind-out-of-checkmate trick.
  const undoLockedByRunEnd = runMode === "run" && matchOver && !devPanelEnabled;
  const canUndo = cardsEnabled && undoRedo.undoDepth >= 2 && !aiThinking && !undoLockedByRunEnd;
  const canRedo = cardsEnabled && undoRedo.redoDepth > 0 && !aiThinking && !undoLockedByRunEnd;

  const clearTransientUI = useCallback(() => {
    setSelected(null);
    setTargetingIndex(null);
    setPartialTarget(null);
    setMarionetteMoves([]);
    setScryPending(null);
  }, [setTargetingIndex, setPartialTarget, setMarionetteMoves, setScryPending]);

  const undo = useCallback(() => {
    if (!canUndo) return;
    // Capture before undo: if we were sitting on a terminal state that had
    // already notified the run shell, rewinding past it must revert that
    // notification too. matchEndedRef gets re-primed by the natural-outcome
    // useEffect once the restored position is non-terminal.
    const wasMatchEnded = runMode === "run" && matchEndedRef.current;
    const popped = undoRedo.undo((cs, h) => {
      setCardState(cs);
      replaceHistory(h);
      clearTransientUI();
      setVersion((v) => v + 1);
    });
    if (popped && wasMatchEnded) {
      matchEndedRef.current = false;
      onRevertMatchEnd?.();
    }
  }, [canUndo, undoRedo, clearTransientUI, replaceHistory, runMode, onRevertMatchEnd]);

  const redo = useCallback(() => {
    if (!canRedo) return;
    undoRedo.redo((cs, h) => {
      setCardState(cs);
      replaceHistory(h);
      clearTransientUI();
      setVersion((v) => v + 1);
    });
  }, [canRedo, undoRedo, clearTransientUI, replaceHistory]);

  // ---- Render ---------------------------------------------------------------

  // In dev mode the board must remain interactive even when the engine reports
  // checkmate / stalemate (which is what an invalid editor position registers
  // as) — otherwise the user can't edit their way back to a valid state.
  const boardLocked = aiThinking || (matchOver && !devPanelEnabled);

  // Recompute on each move (version bump invalidates).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const captured = useMemo(() => engine.capturedPieces(), [engine, version]);
  const playerMaterial = materialAdvantage(captured.byPlayer);
  const opponentMaterial = materialAdvantage(captured.byOpponent);
  const playerLead = playerMaterial - opponentMaterial;

  return (
    <div className={styles.match}>
      <aside className={styles.sidePanel}>
        {endOfRunPanel ? (
          endOfRunPanel
        ) : (
          <>
            {onExit && (
              <button type="button" onClick={onExit} className={styles.backButton}>
                ← Back to menu
              </button>
            )}
            {runMode === "prototype" && (
              <div className={styles.statusBlock}>
                <div className={styles.label}>Mode</div>
                <div className={styles.modeRow} role="radiogroup" aria-label="Match mode">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={mode === "vs-ai"}
                    className={`${styles.modeButton} ${mode === "vs-ai" ? styles.modeActive : ""}`}
                    onClick={() => onModeChange("vs-ai")}
                  >
                    vs AI
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={mode === "local-pvp"}
                    className={`${styles.modeButton} ${mode === "local-pvp" ? styles.modeActive : ""}`}
                    onClick={() => onModeChange("local-pvp")}
                  >
                    Local PvP
                  </button>
                </div>
              </div>
            )}

            {mode === "vs-ai" && (
              <div className={styles.statusBlock}>
                <label className={styles.label} htmlFor="difficulty">
                  Difficulty
                </label>
                <select
                  id="difficulty"
                  className={styles.select}
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                >
                  <option value="easy">Easy (depth 2)</option>
                  <option value="normal">Normal (depth 6)</option>
                  <option value="hard">Hard (depth 10)</option>
                </select>
              </div>
            )}

            <div className={styles.statusBlock}>
              <div className={styles.label}>To move</div>
              <div
                className={`${styles.value} ${turn === "player" ? styles.player : styles.opponent}`}
                aria-label={`Side to move: ${turn === "player" ? "White" : "Black"}`}
              >
                {turn === "player" ? "White" : "Black"}
                {inCheck && !matchOver && <span className={styles.check}>· in check</span>}
                {aiThinking && !matchOver && <span className={styles.thinking}>· thinking…</span>}
              </div>
            </div>
            <div className={styles.statusBlock}>
              <div className={styles.label}>Move</div>
              <div className={styles.value}>{Math.floor(version / 2) + 1}</div>
            </div>

            <div className={styles.statusBlock}>
              <label className={styles.toggleRow}>
                <input
                  type="checkbox"
                  checked={chessVision}
                  onChange={(e) => setChessVision(e.target.checked)}
                />
                <span>Chess vision</span>
              </label>
            </div>

            {cardsEnabled && (
              <div className={styles.statusBlock}>
                <div className={styles.label}>Energy</div>
                <div className={styles.energy} aria-label={`Energy: ${cardState.energy}`}>
                  <span className={styles.energyValue}>{cardState.energy}</span>
                </div>
              </div>
            )}
            {cardsEnabled && (cardState.zoneBuffs?.length ?? 0) > 0 && (
              <div className={styles.statusBlock}>
                <div className={styles.label}>Zone buffs</div>
                <ul className={styles.zoneBuffList} aria-label="Active zone buffs">
                  {cardState.zoneBuffs.map((b, i) => {
                    const active = zoneBuffOverlay.activeBuffs.includes(b);
                    const remaining =
                      b.expiresOnTurn === undefined
                        ? null
                        : Math.max(0, b.expiresOnTurn - cardState.turn);
                    return (
                      <li
                        key={`${b.sourceLabel}:${i}`}
                        className={`${styles.zoneBuffItem} ${active ? styles.zoneBuffActive : styles.zoneBuffInactive}`}
                      >
                        <span className={styles.zoneBuffName}>{b.sourceLabel}</span>
                        <span className={styles.zoneBuffEffect}>
                          {b.effect.kind === "energy-per-turn"
                            ? `+${b.effect.amount} energy/turn`
                            : `+${b.effect.amount} hand size`}
                          {remaining !== null &&
                            ` · ${remaining} turn${remaining === 1 ? "" : "s"}`}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {aiError && (
              <div className={styles.aiError} role="alert">
                AI error: {aiError}
              </div>
            )}

            {matchOver && (
              <div className={styles.outcome} role="status" aria-live="polite">
                <div className={styles.outcomeHeadline}>{outcomeHeadline(outcome)}</div>
                <div className={styles.outcomeDetail}>{outcomeDetail(outcome)}</div>
                {runMode !== "run" && (
                  <button
                    type="button"
                    onClick={runMode === "dev" ? randomStart : resetGame}
                    className={styles.newGame}
                  >
                    New game
                  </button>
                )}
              </div>
            )}
            {!matchOver && runMode !== "run" && (
              <button type="button" onClick={resetGame} className={styles.resetButton}>
                Reset
              </button>
            )}
          </>
        )}
      </aside>

      <div className={styles.boardArea}>
        {!displayOnly && (
          <CapturedPieces
            pieces={captured.byOpponent}
            advantage={playerLead < 0 ? -playerLead : undefined}
          />
        )}
        <Board
          engine={engine}
          selected={selected}
          legalMovesFromSelected={legalFromSelected}
          controllableSides={controllableSides}
          walledSquares={walledSet}
          frozenSquares={frozenSet}
          sanctuarySquares={sanctuarySet}
          trapSquares={trapSet}
          zoneBuffActiveSquares={zoneBuffOverlay.active}
          zoneBuffInactiveSquares={zoneBuffOverlay.inactive}
          zoneBuffAnchorSquares={zoneBuffOverlay.anchors}
          pieceBadges={pieceBadges}
          squareEffects={squareEffectsMap}
          attackedByPlayer={attackedByPlayer}
          attackedByOpponent={attackedByOpponent}
          mode={boardMode}
          onSquareClick={onSquareClick}
          onSquareDragStart={onSquareDragStart}
          onSquareDrop={onSquareDrop}
          onDragCancel={onDragCancel}
          locked={boardLocked}
          acceptAnyDrop={paletteDragActive || (devPanelEnabled && editMode)}
          editMode={devPanelEnabled && editMode}
          invalidSquares={invalidSquares}
          invalidBoard={validation !== null && !validation.ok}
        />
        {!displayOnly && (
          <CapturedPieces
            pieces={captured.byPlayer}
            advantage={playerLead > 0 ? playerLead : undefined}
          />
        )}
        {cardsEnabled && !displayOnly && (
          <Hand
            hand={cardState.hand}
            energy={cardState.energy}
            targetingIndex={targetingIndex}
            enabled={!aiThinking && !matchOver && turn === HUMAN_SIDE && !libraryFreePlayActive}
            drawPileCount={cardState.drawPile.length}
            discardPileCount={cardState.discardPile.length}
            forbiddenIndexes={forbiddenHandIndexes}
            onCardClick={onCardClick}
            onCardDragStart={onCardDragStart}
            onCardDragEnd={onCardDragEnd}
            onDrawPileClick={() => setPileInspector("draw")}
            onDiscardPileClick={() => setPileInspector("discard")}
          />
        )}
      </div>
      {devPanelEnabled && (
        <DevPanel
          heading={runMode === "dev" ? "Sandbox" : "Dev"}
          onClose={runMode === "run" ? () => setDevPanelOpen(false) : undefined}
          editorPiece={editorPiece}
          onPickEditorPiece={setEditorPiece}
          onPaletteDragStart={onPaletteDragStart}
          onPaletteDragEnd={onPaletteDragEnd}
          editMode={editMode}
          onToggleEditMode={onToggleEditMode}
          onErasePieceDrop={eraseDraggedPiece}
          sideToMove={turn}
          onSetSideToMove={setSideToMove}
          onClearBoard={clearBoard}
          onStandardStart={standardStart}
          onRandomStart={randomStart}
          boardSize={engine.size()}
          onResizeBoard={resizeBoard}
          validationMessages={validationMessages}
          devAiOn={devAiOn}
          onToggleDevAi={() => setDevAiOn((v) => !v)}
          aiSingleMoveDisabled={devAiOn || aiThinking || matchOver || turn !== AI_SIDE}
          onTriggerAiSingleMove={triggerAiSingleMove}
          libraryDisabled={turn !== HUMAN_SIDE || aiThinking || matchOver || libraryFreePlayActive}
          onPlayLibraryCard={playLibraryCard}
          onLibraryCardDragStart={dragStartLibraryCard}
          onLibraryCardDragEnd={dragEndLibraryCard}
          drawPile={cardState.drawPile}
          discardPile={cardState.discardPile}
          consumedPile={cardState.consumedPile}
          onSaveDeck={saveDeck}
          namedDecks={namedDecks}
          onLoadDeck={loadDeck}
          artifacts={artifacts}
          onSaveArtifacts={saveArtifacts}
          onBumpEnergy={() => bumpEnergy(1)}
          onSkipMatchAndWin={runMode === "run" ? skipMatchAndWin : undefined}
          skipMatchDisabled={matchOver}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={undo}
          onRedo={redo}
          historyCount={history.length}
          onShowHistory={() => setHistoryOpen(true)}
        />
      )}
      {runMode === "run" && !devPanelOpen && !displayOnly && (
        <button
          type="button"
          className={styles.devToggle}
          onClick={() => setDevPanelOpen(true)}
          aria-label="Show dev panel"
          title="Show dev panel"
        >
          Dev
        </button>
      )}
      {scryPending && (
        <ScryModal
          cards={scryPending.cards}
          onConfirm={(newOrder) => {
            setCardState((prev) => setDeckTop(prev, newOrder));
            setScryPending(null);
          }}
        />
      )}
      {revivePending && (
        <ReviveModal
          cards={cardState.discardPile}
          onPick={(idx) => {
            setCardState((prev) => completeRevive(prev, idx));
            setRevivePending(false);
          }}
          onCancel={() => setRevivePending(false)}
        />
      )}
      {promotionPending && (
        <PromotionModal
          side={promotionPending.side}
          onPick={(choice) => {
            const { from, to } = promotionPending;
            setPromotionPending(null);
            tryPlay(from, to, choice);
          }}
          onCancel={() => {
            setPromotionPending(null);
            setSelected(null);
          }}
        />
      )}
      {pileInspector === "draw" && (
        <PileInspector
          title="Draw pile"
          hint="Cards still in your deck, listed in the order you acquired them."
          cards={drawPileInAcquisitionOrder(cardState)}
          onClose={() => setPileInspector(null)}
        />
      )}
      {pileInspector === "discard" && (
        <PileInspector
          title="Discard pile"
          hint="Cards waiting to cycle back. They reshuffle into your draw pile when it empties."
          cards={cardState.discardPile}
          onClose={() => setPileInspector(null)}
        />
      )}
      {historyOpen && <HistoryModal events={history} onClose={() => setHistoryOpen(false)} />}
    </div>
  );
}
