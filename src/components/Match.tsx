// Match shell.
//
// Two play modes:
//   - "local-pvp" — both sides controlled on the same screen (no cards).
//   - "vs-ai"     — the human plays White, Stockfish plays Black, with the
//                   M3 card system layered on top.
//
// Player turn (vs-ai):
//   1. Match.startPlayerTurn refills hand + resets energy + ticks overlays.
//   2. Player may play any number of cards using their energy.
//   3. Player makes their chess move — this ends their turn and immediately
//      hands control to the AI. (Cards must be played BEFORE moving a piece.)
//   4. After the AI move, we kick off the next player turn.
//
// The chess engine and the card state are deliberately separate. The card
// state lives as React state here; pure helpers in `game/cards/match.ts`
// produce new states.
//
// Decomposition (in-progress — partial):
//   - Pure derivations of MatchCardState  → `Match/derivations.ts`
//   - Pure side-effect appliers + outcome → `Match/sideEffects.ts`
//   - Undo / redo snapshot stack          → `Match/useUndoRedo.ts`
// The AI loop, dev editor, and card-play orchestration still live in this
// file — extracting them is the next refactor pass and will likely happen
// alongside the M5 store migration (see `docs/technical/architecture.md`).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Board, type BoardMode } from "./Board/Board";
import { CapturedPieces } from "./Board/CapturedPieces";
import { materialAdvantage } from "./Board/material";
import { DevPanel, type EditorPiece } from "./Match/DevPanel";
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
import {
  applyCardSideEffects as applyCardSideEffectsPure,
  outcomeDetail,
  outcomeHeadline,
  resolveTrapForMove,
} from "./Match/sideEffects";
import { useUndoRedo } from "./Match/useUndoRedo";
import {
  ChoseEngine,
  type LegalMove,
} from "../game/chess/engine";
import {
  StockfishEngine,
  legalMoveToUci,
  uciToMove,
  depthForDifficulty,
  type Difficulty,
  type StockfishOptions,
} from "../ai/stockfish";
import {
  ENERGY_MAX,
  clampEnergy,
  clearStatusesOn,
  completeRevive,
  consumeHaste,
  consumeLightningAction,
  createMatchCardState,
  drawPileInAcquisitionOrder,
  dropOtherSingleUseEmpowers,
  grantSoulOnCapture,
  hasWallOn,
  hasteAt,
  isInPlayerHalf,
  isRooted,
  lightningAt,
  playCard,
  relocateStatuses,
  setDeckTop,
  startPlayerTurn,
  type BoardContext,
  type PlayTarget,
  type Rng,
} from "../game/cards/match";
import { makeStarterDeck } from "../game/cards/library";
import type {
  AlgebraicSquare,
  Card,
  MatchCardState,
  MatchOutcome,
  PieceType,
  RunMatchOutcome,
  Side,
} from "../game/types";

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
  /** Hook to swap the AI engine in tests. */
  createAi?: (opts?: StockfishOptions) => StockfishEngine;
  /**
   * Minimum time the AI must "think" before its move lands, in ms. Stops shallow
   * depths from snap-moving. Tests override this to 0 to skip the wait.
   */
  aiMinThinkMs?: number;
  /** Inject a deck for tests. */
  initialDeck?: Card[];
  /** Inject an RNG for tests so card order is deterministic. */
  rng?: Rng;
  /**
   * Override the starting energy for tests. Production starts at
   * STARTING_ENERGY (1) and banks +1 each turn; tests sometimes need a
   * larger pool so existing scenarios (cost-2+ cards on turn 1) keep working.
   */
  initialEnergy?: number;
};

const DEFAULT_AI_MIN_THINK_MS = 500;

const HUMAN_SIDE: Side = "player";
const AI_SIDE: Side = "opponent";

export function Match({
  runMode = "prototype",
  onExit,
  onMatchEnd,
  initialMode = "vs-ai",
  initialDifficulty = "normal",
  initialFen,
  createAi,
  aiMinThinkMs = DEFAULT_AI_MIN_THINK_MS,
  initialDeck,
  rng,
  initialEnergy,
}: Props = {}) {
  // Dev mode forces the card system on (mode = "vs-ai"); the per-match
  // vs-AI / Local-PvP toggle is hidden in the side panel. The AI itself is
  // gated separately by `devAiOn` below.
  const [mode, setMode] = useState<MatchMode>(runMode === "dev" ? "vs-ai" : initialMode);
  const [difficulty, setDifficulty] = useState<Difficulty>(initialDifficulty);
  const [engine, setEngine] = useState(() => new ChoseEngine(initialFen));
  const [selected, setSelected] = useState<AlgebraicSquare | null>(null);
  // Bumped after each move so derived render values recompute.
  const [version, setVersion] = useState(0);
  const [aiThinking, setAiThinking] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // ---- Dev-mode state ------------------------------------------------------
  /** AI plays Black? Off by default in dev mode; the prototype always plays. */
  const [devAiOn, setDevAiOn] = useState(false);
  /**
   * Currently-selected editor brush. When non-null in dev mode, board clicks
   * place / overwrite / erase pieces instead of doing chess moves.
   */
  const [editorPiece, setEditorPiece] = useState<EditorPiece>(null);
  /**
   * In flight while the user is dragging a piece from the editor palette
   * (or "erase") onto the board. Read by the board-drop handler so we can
   * resolve the drop as an edit even if no brush was clicked first.
   */
  const paletteDragRef = useRef<{ type: PieceType; side: Side } | "erase" | null>(null);
  /** Mirror of paletteDragRef so the Board re-renders to accept any-drop. */
  const [paletteDragActive, setPaletteDragActive] = useState(false);
  /**
   * When non-null, a library-card play is in flight: the dev panel injected a
   * card at hand[0], paid no energy, and we're waiting for targeting (or the
   * card already resolved). The number stored is the pre-synth energy to
   * restore once `tryResolveCard` finishes the play. A state mirror (below)
   * drives UI gating; the ref is for synchronous reads inside callbacks.
   */
  const libraryFreePlayRef = useRef<number | null>(null);
  const [libraryFreePlayActive, setLibraryFreePlayActive] = useState(false);
  /**
   * "Chess vision" — when on, every square attacked by either side gets a
   * coloured tint: blue for player-only, red for opponent-only, purple for
   * both. Useful for spotting threats and overworked defenders at a glance.
   */
  const [chessVision, setChessVision] = useState(false);

  // ---- Card-system state (vs-ai only) --------------------------------------

  const cardsEnabled = mode === "vs-ai";
  const [cardState, setCardState] = useState<MatchCardState>(() => {
    if (!cardsEnabled) return createMatchCardState([], rng);
    const fresh = startPlayerTurn(createMatchCardState(initialDeck ?? makeStarterDeck(), rng), rng);
    return initialEnergy !== undefined ? { ...fresh, energy: initialEnergy } : fresh;
  });
  /** Hand index waiting for a target click, or null. */
  const [targetingIndex, setTargetingIndex] = useState<number | null>(null);
  /** First square in a two-step targeting flow (Switch Files / Marionette). */
  const [partialTarget, setPartialTarget] = useState<AlgebraicSquare | null>(null);
  /** Pre-computed legal moves of the puppet piece while Marionette is in flight. */
  const [marionetteMoves, setMarionetteMoves] = useState<LegalMove[]>([]);
  /** When non-null, Foresight is asking the player to reorder the deck top. */
  const [scryPending, setScryPending] = useState<{ cards: Card[] } | null>(null);
  /** When true, Recover is asking the player to pick a card from consumedPile. */
  const [revivePending, setRevivePending] = useState<boolean>(false);
  /** Which pile inspector is open, if any. */
  const [pileInspector, setPileInspector] = useState<"draw" | "spent" | null>(null);

  // Increments on new game / mode change so stale AI replies are ignored.
  const generationRef = useRef(0);
  const aiRef = useRef<StockfishEngine | null>(null);

  // Undo / redo stack — one snapshot per turn rollover (prototype) plus one
  // per dev-mode action (editor edit, energy bump, library card play).
  const undoRedo = useUndoRedo(engine);
  const { pushSnapshot } = undoRedo;

  // Seed the initial snapshot once per mount (and again on reset / mode
  // change — both reset the stack first via undoRedo.reset()).
  useEffect(() => {
    if (undoRedo.undoDepth > 0) return;
    if (mode !== "vs-ai") return;
    undoRedo.seed({ engineSnapshot: engine.snapshot(), cardState });
    // engine + cardState are captured by the closure; intentional.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [undoRedo.undoDepth, mode]);

  // Spin up the Stockfish worker only when in vs-ai mode.
  useEffect(() => {
    if (mode !== "vs-ai") return;
    let ai: StockfishEngine | null = null;
    try {
      ai = createAi ? createAi() : new StockfishEngine();
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "failed to start AI");
      return;
    }
    aiRef.current = ai;
    ai.ready().catch((e) => {
      setAiError(e instanceof Error ? e.message : String(e));
    });
    return () => {
      ai?.destroy();
      aiRef.current = null;
    };
  }, [mode, createAi]);

  // Sync the current overlays to the engine BEFORE any engine method
  // (legalMoves / inCheck / outcome) is called this render. The engine is
  // mutable and shared; setting overlays here is idempotent.
  const overlays = useMemo(() => deriveOverlaySets(cardState), [cardState]);
  const {
    walledSet,
    frozenSet,
    rootedSet,
    sanctuarySet,
    trapSet,
  } = overlays;
  const extraOverlays = useMemo(() => buildExtraOverlays(overlays), [overlays]);
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
  const squareEffectsMap = useMemo(() => deriveSquareEffects(cardState), [cardState]);

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
    const won = outcome.kind === "checkmate" && outcome.winner === HUMAN_SIDE;
    onMatchEnd({ won, outcome, turnsPlayed: cardState.turn });
  }, [runMode, onMatchEnd, matchOver, outcome, cardState.turn]);
  // In dev, the AI only fires when explicitly toggled on. Prototype + run
  // (real Royal / Skirmish runs) always fire — the player is playing a chess
  // match and expects an opponent.
  const aiOn = runMode === "prototype" || runMode === "run" || devAiOn;
  const isAiTurn = mode === "vs-ai" && turn === AI_SIDE && !matchOver && aiOn;

  const controllableSides = useMemo(
    () => deriveControllableSides(mode, runMode),
    [mode, runMode],
  );

  // Legal moves originating from the selected square. Recomputed when the
  // chess position OR the wall/freeze overlays change.
  const legalFromSelected: LegalMove[] = useMemo(() => {
    if (!selected) return [];
    return engine.legalMoves(selected);
    // version invalidates after a move; walledSet/frozenSet after a card play
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, selected, version, walledSet, frozenSet]);

  const targetingCard: Card | null =
    targetingIndex !== null ? (cardState.hand[targetingIndex] ?? null) : null;

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
      for (let r = 1; r <= 8; r++) {
        for (let f = 0; f < 8; f++) {
          const sq = "abcdefgh"[f] + r;
          if (engine.pieceAt(sq)) continue;
          if (walledSet.has(sq)) continue;
          if (ownHalfOnly && !isInPlayerHalf(sq)) continue;
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
    if (targetKind === "rooted-enemy-and-own-piece") {
      if (partialTarget) {
        // Phase 2: any of the player's pieces (other than the picked enemy).
        for (const { square, piece } of allPieces) {
          if (piece.side === "player" && square !== partialTarget) out.add(square);
        }
        return out;
      }
      // Phase 1: rooted enemy non-king pieces.
      for (const { square, piece } of allPieces) {
        if (piece.side !== "opponent") continue;
        if (piece.type === "king") continue;
        if (!rootedSet.has(square)) continue;
        out.add(square);
      }
      return out;
    }
    if (targetKind === "own-piece" || targetKind === "own-non-king-piece") {
      const excludeKing = targetKind === "own-non-king-piece";
      for (const { square, piece } of allPieces) {
        if (piece.side !== "player") continue;
        if (excludeKing && piece.type === "king") continue;
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
    return { kind: "target", cardName: targetingCard.name, hint, valid: validTargetSquares };
  }, [targetingCard, partialTarget, validTargetSquares]);

  // ---- AI move loop ---------------------------------------------------------

  /**
   * Roll over to a fresh player turn: refill hand, +1 energy, decay statuses,
   * commit to React state, push a snapshot for undo. Caller is responsible
   * for any pre-rollover work (e.g. trap resolution) — `state` is what gets
   * fed straight into `startPlayerTurn`.
   */
  const applyTurnRollover = useCallback(
    (state: MatchCardState) => {
      const turnStarted = startPlayerTurn(state, rng);
      setCardState(turnStarted);
      pushSnapshot(turnStarted);
    },
    [rng, pushSnapshot],
  );

  /**
   * Run a single AI move against the current position. Returns once the move
   * has been applied (or the call was cancelled / the AI returned nothing).
   * Both the auto AI loop and the dev "AI: play one move" button funnel
   * through here.
   */
  const doAiMove = useCallback(
    async (myGen: number, isCancelled: () => boolean, minThinkMs?: number): Promise<void> => {
      const ai = aiRef.current;
      if (!ai) return;
      await ai.ready();
      if (isCancelled() || generationRef.current !== myGen) return;
      ai.setPosition(engine.fen());
      // Stockfish doesn't know about overlays. We restrict its root choice
      // to our wall/freeze/sanctuary/shield/compel-aware legal-move set via
      // UCI `searchmoves`, so it can't pick a move that walks through a
      // wall, moves a frozen piece, captures a shielded piece, etc.
      const candidates = engine.legalMoves().map(legalMoveToUci);
      const wait = minThinkMs ?? aiMinThinkMs;
      const [uci] = await Promise.all([
        ai.getBestMove({
          depth: depthForDifficulty(difficulty),
          searchMoves: candidates,
        }),
        new Promise<void>((resolve) => setTimeout(resolve, wait)),
      ]);
      if (isCancelled() || generationRef.current !== myGen) return;
      if (!uci) return;
      const move = uciToMove(uci);
      // Snapshot the moving piece BEFORE the engine applies the move; its
      // type drives the move-path computation used by trap resolution.
      let mover = engine.pieceAt(move.from);
      let applied = engine.move(move);
      if (!applied) {
        const fallback = engine.legalMoves()[0];
        if (fallback) {
          mover = engine.pieceAt(fallback.from);
          applied = engine.move(fallback);
        }
      }
      setVersion((v) => v + 1);
      if (applied && cardsEnabled && mover) {
        const trapped = resolveTrapForMove(engine, cardState, mover, applied.from, applied.to);
        setVersion((v) => v + 1);
        applyTurnRollover(trapped);
      }
    },
    [engine, difficulty, aiMinThinkMs, cardsEnabled, cardState, applyTurnRollover],
  );

  useEffect(() => {
    if (!isAiTurn) return;
    const myGen = ++generationRef.current;
    setAiThinking(true);
    let cancelled = false;
    (async () => {
      try {
        await doAiMove(myGen, () => cancelled);
      } catch (e) {
        if (cancelled) return;
        setAiError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setAiThinking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // engine is mutable but stable; depending on version triggers each turn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAiTurn, version]);

  /**
   * Imperative single-shot AI move. Used by the dev "AI: play one move"
   * button. The button is gated by `aiThinking`, so no concurrent run is
   * possible. Bumps generation to invalidate any in-flight effect work.
   */
  const triggerAiSingleMove = useCallback(async () => {
    if (matchOver || aiThinking) return;
    if (turn !== AI_SIDE) return;
    const myGen = ++generationRef.current;
    setAiThinking(true);
    try {
      // Manual single-move skips the cosmetic think delay — the player asked
      // for the move, so don't make them wait. The auto AI loop still uses
      // aiMinThinkMs so its moves don't snap-resolve.
      await doAiMove(myGen, () => false, 0);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : String(e));
    } finally {
      setAiThinking(false);
    }
  }, [matchOver, aiThinking, turn, doAiMove]);

  // ---- Player input handlers -----------------------------------------------

  const boardContext: BoardContext = useMemo(
    () => ({
      pieceAt: (sq) => engine.pieceAt(sq),
      hasWall: (sq) => hasWallOn(cardState, sq),
      isAttackedBy: (sq, by) => engine.isSquareAttackedBy(sq, by),
      isRooted: (sq) => isRooted(cardState, sq),
    }),
    // engine is mutable; version forces recompute on each move
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [engine, version, cardState],
  );

  /**
   * Try to play `target` from `selected`. Returns true if a move was made.
   * Making a move usually ends the player's turn — the AI loop kicks in via
   * `isAiTurn` once the engine flips the turn. Exceptions: a hasted or
   * lightning-statused piece may take another action; in that case we flip
   * the turn back to the player and decrement / consume the buff.
   */
  const tryPlay = useCallback(
    (from: AlgebraicSquare, to: AlgebraicSquare): boolean => {
      const legal = engine.legalMoves(from).find((m) => m.to === to);
      if (!legal) return false;
      const haste = hasteAt(cardState, from);
      const lightning = lightningAt(cardState, from);
      const mover = engine.pieceAt(from);
      // Snapshot the captured piece BEFORE applying the move — once the
      // engine resolves, the target square is gone or repopulated.
      const captured = engine.pieceAt(to);
      const applied = engine.move({ from, to, promotion: legal.promotion });
      if (!applied) return false;

      // Single-use empowers (Soul cards) on any *other* piece die the moment
      // the player commits a chess move with someone else.
      let next = dropOtherSingleUseEmpowers(cardState, from);
      // Statuses follow the piece.
      next = relocateStatuses(next, from, to);
      // Captured-piece's statuses (if any) are dropped.
      if (applied.isCapture) {
        next = clearStatusesOn(next, to);
        // Capture-grants-Soul: feed the matching Soul card into the draw
        // pile. The helper filters by side itself (only player captures grant
        // souls). In dev mode the human can drive Black, so we pass the
        // actual mover side rather than hardcoding "player".
        next = grantSoulOnCapture(next, captured, mover?.side ?? "player", rng);
      }

      // Resolve any trap triggered by this move (player pieces are not exempt).
      if (mover) {
        next = resolveTrapForMove(engine, next, mover, applied.from, applied.to);
      }

      // Haste / Lightning: grant another action by flipping the turn back.
      // Haste: must not be a capture move (rule engine already prevents this).
      // Both: only the FIRST move uses the second-action grant; after that we
      // flip turn normally. If the trap removed our piece, the buff is moot.
      const stillOurs = engine.pieceAt(applied.to)?.side === "player";
      let consumeAndContinue = false;
      if (stillOurs && lightning && lightning.remaining > 1) {
        next = consumeLightningAction(next, to);
        consumeAndContinue = true;
      } else if (stillOurs && haste) {
        next = consumeHaste(next, to);
        consumeAndContinue = true;
      }
      if (consumeAndContinue) {
        engine.forceTurn("player");
      }

      setSelected(null);
      setTargetingIndex(null);
      setPartialTarget(null);
      setMarionetteMoves([]);
      setVersion((v) => v + 1);

      // Dev mode: when the human drives Black with the AI off, the AI loop
      // never fires, so we have to roll over to a fresh player turn here.
      // For a White move (or any move with the AI on), just commit and push
      // an action-granular snapshot so undo can rewind individual moves.
      if (runMode === "dev" && !devAiOn && mover?.side === "opponent" && !consumeAndContinue) {
        applyTurnRollover(next);
      } else {
        setCardState(next);
        if (runMode === "dev") pushSnapshot(next);
      }
      return true;
    },
    [engine, cardState, rng, runMode, devAiOn, applyTurnRollover, pushSnapshot],
  );

  /**
   * Select a square iff it has a piece the human controls right now.
   */
  const trySelect = useCallback(
    (sq: AlgebraicSquare): boolean => {
      const piece = engine.pieceAt(sq);
      if (!piece) return false;
      if (!controllableSides.has(piece.side)) return false;
      if (piece.side !== turn) return false;
      setSelected(sq);
      return true;
    },
    [engine, controllableSides, turn],
  );

  // ---- Card play handlers --------------------------------------------------

  const cancelTargeting = useCallback(() => {
    setTargetingIndex(null);
    setPartialTarget(null);
    setMarionetteMoves([]);
    // Library free-play in flight: pop the synthesized hand[0] and restore
    // the pre-synth energy so the player isn't left with a phantom card.
    if (libraryFreePlayRef.current !== null) {
      const restoreEnergy = libraryFreePlayRef.current;
      libraryFreePlayRef.current = null;
      setLibraryFreePlayActive(false);
      setCardState((prev) => ({
        ...prev,
        hand: prev.hand.slice(1),
        energy: restoreEnergy,
      }));
    }
  }, []);

  /**
   * Apply the side effects produced by `playCard`. Returns the (possibly
   * further-mutated) match state. Mutates the engine in place. Thin wrapper
   * over the pure `applyCardSideEffectsPure` so we can hook the revive prompt
   * into React state.
   */
  const applyCardSideEffects = useCallback(
    (result: { state: MatchCardState; sideEffects: ReadonlyArray<unknown> }): MatchCardState =>
      applyCardSideEffectsPure(engine, result.state, result.sideEffects, rng, () =>
        setRevivePending(true),
      ),
    [engine, rng],
  );

  const tryResolveCard = useCallback(
    (index: number, target: PlayTarget): boolean => {
      const card = cardState.hand[index];
      if (!card) return false;
      const result = playCard(cardState, index, target, boardContext, rng);
      if (!result.ok) return false;
      let next = applyCardSideEffects(result);

      // Library free-play: undo the energy deduction and pop the synth card
      // out of consumedPile (it was never in the player's deck). Effect-driven
      // additions to hand / draw / statuses persist — that's the whole point
      // of testing those effects via the library.
      const freePlay = libraryFreePlayRef.current;
      if (freePlay !== null) {
        next = { ...next, energy: freePlay };
        const cp = next.consumedPile;
        if (cp.length > 0 && cp[cp.length - 1].id === card.id) {
          next = { ...next, consumedPile: cp.slice(0, -1) };
        }
        libraryFreePlayRef.current = null;
        setLibraryFreePlayActive(false);
      }

      setCardState(next);
      setTargetingIndex(null);
      setPartialTarget(null);
      setMarionetteMoves([]);
      // Foresight: open scry modal showing the new top of deck.
      if (card.effect.kind === "scry") {
        const top = next.drawPile.slice(0, card.effect.count);
        if (top.length > 0) setScryPending({ cards: top });
      }
      // Card play may have changed the board (capture / move / new piece) —
      // make sure derived rendering re-runs.
      setVersion((v) => v + 1);
      if (runMode === "dev") pushSnapshot(next);
      return true;
    },
    [cardState, boardContext, rng, applyCardSideEffects, runMode, pushSnapshot],
  );

  const onCardClick = useCallback(
    (index: number) => {
      if (matchOver || aiThinking) return;
      if (mode !== "vs-ai") return;
      // Cards can only be played before the chess move — i.e. while it's the
      // player's chess turn.
      if (turn !== HUMAN_SIDE) return;
      // While a library free-play is in flight the hand indices have shifted
      // (the synth card sits at hand[0]); ignore hand clicks until it resolves
      // or is cancelled.
      if (libraryFreePlayRef.current !== null) return;
      const card = cardState.hand[index];
      if (!card) return;
      // Toggle off if user clicks the same card they were targeting.
      if (targetingIndex === index) {
        cancelTargeting();
        return;
      }
      if (cardState.energy < card.cost) return;
      if (card.target.kind === "none") {
        tryResolveCard(index, { kind: "none" });
        return;
      }
      // Targeted card — switch into targeting mode and clear any selection.
      setSelected(null);
      setPartialTarget(null);
      setMarionetteMoves([]);
      setTargetingIndex(index);
    },
    [matchOver, aiThinking, mode, turn, cardState, targetingIndex, tryResolveCard, cancelTargeting],
  );

  // ---- Dev-mode helpers ----------------------------------------------------

  /**
   * Apply an editor edit to `sq`: place / overwrite / erase based on `brush`.
   * Pushes a snapshot so undo can rewind the edit.
   */
  const applyEditorEdit = useCallback(
    (sq: AlgebraicSquare, brush: Exclude<EditorPiece, null>) => {
      if (brush === "erase") {
        engine.removePiece(sq);
      } else {
        // Idempotent overwrite: removePiece is null-safe; placePiece throws on
        // occupied, so we always remove first.
        engine.removePiece(sq);
        engine.placePiece(sq, { type: brush.type, side: brush.side });
      }
      // Any status that was on this square belongs to a piece that's now
      // gone; clear them so the new occupant starts fresh.
      const next = clearStatusesOn(cardState, sq);
      setCardState(next);
      setVersion((v) => v + 1);
      pushSnapshot(next);
    },
    [engine, cardState, pushSnapshot],
  );

  /**
   * Force the side-to-move via `engine.forceTurn`. Does NOT advance the
   * player-turn counter (that's `cardState.turn`, which only `startPlayerTurn`
   * touches). Useful for setting up scenarios where Black moves first.
   */
  const setSideToMove = useCallback(
    (side: Side) => {
      if (engine.turn() === side) return;
      engine.forceTurn(side);
      setVersion((v) => v + 1);
      pushSnapshot(cardState);
    },
    [engine, cardState, pushSnapshot],
  );

  const clearBoard = useCallback(() => {
    for (const { square } of engine.pieces()) {
      engine.removePiece(square);
    }
    // Clearing wipes every piece, so any per-piece status is now stale.
    const next: MatchCardState = {
      ...cardState,
      freezes: [],
      roots: [],
      disarms: [],
      compels: [],
      shields: [],
      hastes: [],
      lightnings: [],
      empowers: [],
    };
    setCardState(next);
    setVersion((v) => v + 1);
    pushSnapshot(next);
  }, [engine, cardState, pushSnapshot]);

  /**
   * Reseed the board to the standard chess starting position with a fresh
   * deck/hand/energy. Distinct from `resetGame`, which restores `initialFen`
   * (a test/scenario setup); Standard Start always goes to vanilla chess.
   */
  const standardStart = useCallback(() => {
    const freshEngine = new ChoseEngine();
    setEngine(freshEngine);
    const fresh = startPlayerTurn(createMatchCardState(initialDeck ?? makeStarterDeck(), rng), rng);
    setCardState(fresh);
    setSelected(null);
    setVersion(0);
    setTargetingIndex(null);
    setPartialTarget(null);
    setMarionetteMoves([]);
    setScryPending(null);
    setRevivePending(false);
    setEditorPiece(null);
    paletteDragRef.current = null;
    setPaletteDragActive(false);
    libraryFreePlayRef.current = null;
    setLibraryFreePlayActive(false);
    undoRedo.seed({ engineSnapshot: freshEngine.snapshot(), cardState: fresh });
  }, [initialDeck, rng, undoRedo]);

  const bumpEnergy = useCallback(
    (delta: number) => {
      setCardState((s) => {
        const next = { ...s, energy: clampEnergy(s.energy + delta) };
        pushSnapshot(next);
        return next;
      });
    },
    [pushSnapshot],
  );

  /**
   * Library card play (dev only). Cards played from the library are free
   * (no energy charged) and never enter the consumed pile (they were never
   * in the player's deck). Effect-driven mutations — statuses, traps, cards
   * added to hand/draw, summons, captures — DO persist; that's the whole
   * point of testing effects from the library.
   *
   * Note: self-replicators (Pace / Hum / Drift) shuffle a copy of themselves
   * into the draw pile when played. The free-play patch only suppresses the
   * synth card in `consumedPile` — the replicated copy stays. Generators
   * (Improvise / Trick Bag / Mark Target) likewise add real cards to hand /
   * follow-up that persist. Acceptable for a dev tool; the player can undo.
   */
  const playLibraryCard = useCallback(
    (card: Card) => {
      if (matchOver || aiThinking) return;
      if (turn !== HUMAN_SIDE) return;
      if (libraryFreePlayRef.current !== null) return;
      if (card.target.kind === "none") {
        // Resolve immediately. We don't go through tryResolveCard because its
        // closure has a stale cardState — the synth must be visible to playCard.
        const restoreEnergy = cardState.energy;
        const synth: MatchCardState = {
          ...cardState,
          hand: [card, ...cardState.hand],
          energy: Math.max(restoreEnergy, card.cost),
        };
        const result = playCard(synth, 0, { kind: "none" }, boardContext, rng);
        if (!result.ok) return;
        let next = applyCardSideEffects(result);
        next = { ...next, energy: restoreEnergy };
        const cp = next.consumedPile;
        if (cp.length > 0 && cp[cp.length - 1].id === card.id) {
          next = { ...next, consumedPile: cp.slice(0, -1) };
        }
        setCardState(next);
        if (card.effect.kind === "scry") {
          const top = next.drawPile.slice(0, card.effect.count);
          if (top.length > 0) setScryPending({ cards: top });
        }
        setVersion((v) => v + 1);
        pushSnapshot(next);
        return;
      }
      // Targeted card — synthesize it at hand[0] and enter targeting mode.
      // tryResolveCard will see libraryFreePlayRef and apply the free-play
      // patch when the resolver returns.
      libraryFreePlayRef.current = cardState.energy;
      setLibraryFreePlayActive(true);
      const synth: MatchCardState = {
        ...cardState,
        hand: [card, ...cardState.hand],
        energy: Math.max(cardState.energy, card.cost),
      };
      setCardState(synth);
      setSelected(null);
      setPartialTarget(null);
      setMarionetteMoves([]);
      setTargetingIndex(0);
    },
    [matchOver, aiThinking, turn, cardState, boardContext, rng, applyCardSideEffects, pushSnapshot],
  );

  /**
   * Library card drag-start: synth at hand[0] and enter targeting mode for
   * EVERY card kind (including no-target — drop-anywhere mode lets the user
   * drop on any board square to resolve). The drop on the board funnels into
   * the same `tryResolveCard` path the click flow uses, which already handles
   * the library free-play patch via `libraryFreePlayRef`.
   */
  const dragStartLibraryCard = useCallback(
    (card: Card) => {
      if (matchOver || aiThinking) return;
      if (turn !== HUMAN_SIDE) return;
      if (libraryFreePlayRef.current !== null) return;
      libraryFreePlayRef.current = cardState.energy;
      setLibraryFreePlayActive(true);
      const synth: MatchCardState = {
        ...cardState,
        hand: [card, ...cardState.hand],
        energy: Math.max(cardState.energy, card.cost),
      };
      setCardState(synth);
      setSelected(null);
      setPartialTarget(null);
      setMarionetteMoves([]);
      setTargetingIndex(0);
    },
    [matchOver, aiThinking, turn, cardState],
  );

  const dragEndLibraryCard = useCallback(() => {
    // If the drop landed on a board square, the resolver already cleared
    // targeting state and popped the synth (libraryFreePlayRef is null).
    // If the drop missed, back out the synth via cancelTargeting.
    if (libraryFreePlayRef.current === null) return;
    cancelTargeting();
  }, [cancelTargeting]);

  // ---- Square click / drag (chess move OR card target) ---------------------

  const onSquareClick = useCallback(
    (sq: AlgebraicSquare) => {
      if (matchOver || aiThinking) return;

      // Editor takes priority while a brush is selected in dev mode — a click
      // places / overwrites / erases the piece on the square per the current
      // brush. The brush is consumed by the placement: the user clicks the
      // palette piece again for each new placement.
      if (runMode === "dev" && editorPiece !== null) {
        applyEditorEdit(sq, editorPiece);
        setEditorPiece(null);
        return;
      }

      // Card-targeting takes priority over chess interaction.
      if (targetingIndex !== null && targetingCard) {
        const k = targetingCard.target.kind;
        if (k === "none") {
          // No-target card resolved by a drop on the board.
          tryResolveCard(targetingIndex, { kind: "none" });
          return;
        }
        if (k === "two-own-pieces") {
          if (!partialTarget) {
            const piece = engine.pieceAt(sq);
            if (piece && piece.side === "player") {
              setPartialTarget(sq);
              return;
            }
            cancelTargeting();
            return;
          }
          if (
            tryResolveCard(targetingIndex, {
              kind: "two-squares",
              first: partialTarget,
              second: sq,
            })
          )
            return;
          cancelTargeting();
          return;
        }
        if (k === "marionette") {
          if (!partialTarget) {
            const piece = engine.pieceAt(sq);
            if (piece && piece.side === "opponent") {
              const moves = engine.foreignLegalMoves(sq);
              if (moves.length > 0) {
                setPartialTarget(sq);
                setMarionetteMoves(moves);
                return;
              }
            }
            cancelTargeting();
            return;
          }
          // Phase 2: pick a destination among marionetteMoves.
          if (marionetteMoves.some((m) => m.to === sq)) {
            if (
              tryResolveCard(targetingIndex, {
                kind: "two-squares",
                first: partialTarget,
                second: sq,
              })
            )
              return;
          }
          cancelTargeting();
          return;
        }
        // Single-square targets.
        if (tryResolveCard(targetingIndex, { kind: "square", square: sq })) return;
        cancelTargeting();
        return;
      }

      if (selected) {
        if (tryPlay(selected, sq)) return;
        if (trySelect(sq)) return;
      } else if (trySelect(sq)) {
        return;
      }
      setSelected(null);
    },
    [
      matchOver,
      aiThinking,
      runMode,
      editorPiece,
      applyEditorEdit,
      targetingIndex,
      targetingCard,
      partialTarget,
      marionetteMoves,
      engine,
      tryResolveCard,
      cancelTargeting,
      selected,
      tryPlay,
      trySelect,
    ],
  );

  const onSquareDragStart = useCallback(
    (sq: AlgebraicSquare) => {
      if (matchOver || aiThinking || targetingIndex !== null) return;
      trySelect(sq);
    },
    [matchOver, aiThinking, targetingIndex, trySelect],
  );

  const onSquareDrop = useCallback(
    (sq: AlgebraicSquare) => {
      if (matchOver || aiThinking) return;
      // Palette drag (sandbox editor): drop applies the brush regardless of
      // any other in-flight selection. We clear editorPiece here too — the
      // dragend handler also clears it, but dragend is unreliable across
      // browsers, so don't depend on it for the visible highlight.
      if (paletteDragRef.current !== null) {
        applyEditorEdit(sq, paletteDragRef.current);
        paletteDragRef.current = null;
        setPaletteDragActive(false);
        setEditorPiece(null);
        return;
      }
      if (targetingIndex !== null) {
        // A targeted card was dragged from the hand onto this square. Reuse
        // the same resolution path as a click on the square.
        onSquareClick(sq);
        return;
      }
      if (selected && selected !== sq) {
        if (tryPlay(selected, sq)) return;
      }
      // Drop on an invalid target leaves the piece where it was; clear selection.
      setSelected(null);
    },
    [matchOver, aiThinking, targetingIndex, selected, tryPlay, onSquareClick, applyEditorEdit],
  );

  const onDragCancel = useCallback(() => {
    setSelected(null);
  }, []);

  // ---- Card drag (hand → board) -------------------------------------------

  const onCardDragStart = useCallback(
    (index: number) => {
      if (matchOver || aiThinking) return;
      if (mode !== "vs-ai") return;
      if (turn !== HUMAN_SIDE) return;
      // Library free-play in flight: the synth is at hand[0] and indices have
      // shifted; ignore drags on the regular hand until the play resolves.
      if (libraryFreePlayRef.current !== null) return;
      const card = cardState.hand[index];
      if (!card) return;
      if (cardState.energy < card.cost) return;
      // Enter targeting mode so the board highlights drop targets — this is
      // the same setup as clicking the card. For no-target cards it triggers
      // the "drop anywhere" board overlay; the drop will resolve immediately.
      setSelected(null);
      setPartialTarget(null);
      setMarionetteMoves([]);
      setTargetingIndex(index);
    },
    [matchOver, aiThinking, mode, turn, cardState],
  );

  const onCardDragEnd = useCallback(() => {
    // If the drop landed on a valid target, the resolver already cleared
    // targeting state. If it didn't (drop outside the board, drop on an
    // invalid square), back out of targeting so the player isn't stuck.
    setTargetingIndex(null);
    setPartialTarget(null);
    setMarionetteMoves([]);
  }, []);

  // ---- Game lifecycle -------------------------------------------------------

  const resetGame = useCallback(() => {
    generationRef.current++;
    aiRef.current?.stop();
    setEngine(new ChoseEngine(initialFen));
    setSelected(null);
    setVersion(0);
    setAiThinking(false);
    setAiError(null);
    setTargetingIndex(null);
    setPartialTarget(null);
    setMarionetteMoves([]);
    setScryPending(null);
    setRevivePending(false);
    undoRedo.reset();
    setEditorPiece(null);
    paletteDragRef.current = null;
    setPaletteDragActive(false);
    libraryFreePlayRef.current = null;
    setLibraryFreePlayActive(false);
    if (mode === "vs-ai") {
      setCardState(
        startPlayerTurn(createMatchCardState(initialDeck ?? makeStarterDeck(), rng), rng),
      );
    } else {
      setCardState(createMatchCardState([], rng));
    }
  }, [initialFen, initialDeck, mode, rng, undoRedo]);

  const onModeChange = useCallback(
    (next: MatchMode) => {
      if (next === mode) return;
      generationRef.current++;
      aiRef.current?.stop();
      setMode(next);
      setEngine(new ChoseEngine(initialFen));
      setSelected(null);
      setVersion(0);
      setAiThinking(false);
      setAiError(null);
      setTargetingIndex(null);
      undoRedo.reset();
      setEditorPiece(null);
      paletteDragRef.current = null;
      setPaletteDragActive(false);
      libraryFreePlayRef.current = null;
      setLibraryFreePlayActive(false);
      if (next === "vs-ai") {
        setCardState(
          startPlayerTurn(createMatchCardState(initialDeck ?? makeStarterDeck(), rng), rng),
        );
      } else {
        setCardState(createMatchCardState([], rng));
      }
    },
    [mode, initialFen, initialDeck, rng, undoRedo],
  );

  /**
   * Undo / redo are unlimited and rewind across the AI's preceding move —
   * a snapshot represents the start of a player turn (or the start of a
   * dev-mode action). Both flows are gated on aiThinking / matchOver so
   * the player can't tear down state while a worker reply is in flight.
   */
  const canUndo = cardsEnabled && undoRedo.undoDepth >= 2 && !aiThinking && !matchOver;
  const canRedo = cardsEnabled && undoRedo.redoDepth > 0 && !aiThinking && !matchOver;

  const clearTransientUI = useCallback(() => {
    setSelected(null);
    setTargetingIndex(null);
    setPartialTarget(null);
    setMarionetteMoves([]);
    setScryPending(null);
  }, []);

  const undo = useCallback(() => {
    if (!canUndo) return;
    undoRedo.undo((cs) => {
      setCardState(cs);
      clearTransientUI();
      setVersion((v) => v + 1);
    });
  }, [canUndo, undoRedo, clearTransientUI]);

  const redo = useCallback(() => {
    if (!canRedo) return;
    undoRedo.redo((cs) => {
      setCardState(cs);
      clearTransientUI();
      setVersion((v) => v + 1);
    });
  }, [canRedo, undoRedo, clearTransientUI]);

  // ---- Render ---------------------------------------------------------------

  const boardLocked = matchOver || aiThinking;

  // Recompute on each move (version bump invalidates).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const captured = useMemo(() => engine.capturedPieces(), [engine, version]);
  const playerMaterial = materialAdvantage(captured.byPlayer);
  const opponentMaterial = materialAdvantage(captured.byOpponent);
  const playerLead = playerMaterial - opponentMaterial;

  return (
    <div className={styles.match}>
      <aside className={styles.sidePanel}>
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
              <span className={styles.energyMax}>/ {ENERGY_MAX}</span>
            </div>
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
              <button type="button" onClick={resetGame} className={styles.newGame}>
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
        {cardsEnabled && !matchOver && runMode !== "run" && (
          <>
            <button type="button" onClick={undo} disabled={!canUndo} className={styles.resetButton}>
              Undo turn
            </button>
            <button type="button" onClick={redo} disabled={!canRedo} className={styles.resetButton}>
              Redo turn
            </button>
          </>
        )}
      </aside>

      <div className={styles.boardArea}>
        <CapturedPieces
          pieces={captured.byOpponent}
          advantage={playerLead < 0 ? -playerLead : undefined}
        />
        <Board
          engine={engine}
          selected={selected}
          legalMovesFromSelected={legalFromSelected}
          controllableSides={controllableSides}
          walledSquares={walledSet}
          frozenSquares={frozenSet}
          sanctuarySquares={sanctuarySet}
          trapSquares={trapSet}
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
          acceptAnyDrop={paletteDragActive}
        />
        <CapturedPieces
          pieces={captured.byPlayer}
          advantage={playerLead > 0 ? playerLead : undefined}
        />
        {cardsEnabled && (
          <Hand
            hand={cardState.hand}
            energy={cardState.energy}
            targetingIndex={targetingIndex}
            enabled={!aiThinking && !matchOver && turn === HUMAN_SIDE && !libraryFreePlayActive}
            drawPileCount={cardState.drawPile.length}
            consumedPileCount={cardState.consumedPile.length}
            onCardClick={onCardClick}
            onCardDragStart={onCardDragStart}
            onCardDragEnd={onCardDragEnd}
            onDrawPileClick={() => setPileInspector("draw")}
            onSpentPileClick={() => setPileInspector("spent")}
          />
        )}
      </div>
      {runMode === "dev" && (
        <DevPanel
          editorPiece={editorPiece}
          onPickEditorPiece={setEditorPiece}
          onPaletteDragStart={(piece) => {
            paletteDragRef.current = piece;
            setPaletteDragActive(true);
          }}
          onPaletteDragEnd={() => {
            paletteDragRef.current = null;
            setPaletteDragActive(false);
            // Drag is a fresh action — clear any previously-clicked brush so
            // it doesn't linger after the drag completes.
            setEditorPiece(null);
          }}
          sideToMove={turn}
          onSetSideToMove={setSideToMove}
          onClearBoard={clearBoard}
          onStandardStart={standardStart}
          devAiOn={devAiOn}
          onToggleDevAi={() => setDevAiOn((v) => !v)}
          aiSingleMoveDisabled={devAiOn || aiThinking || matchOver || turn !== AI_SIDE}
          onTriggerAiSingleMove={triggerAiSingleMove}
          libraryDisabled={turn !== HUMAN_SIDE || aiThinking || matchOver || libraryFreePlayActive}
          onPlayLibraryCard={playLibraryCard}
          onLibraryCardDragStart={dragStartLibraryCard}
          onLibraryCardDragEnd={dragEndLibraryCard}
          onBumpEnergy={() => bumpEnergy(1)}
        />
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
          cards={cardState.consumedPile}
          onPick={(idx) => {
            setCardState((prev) => completeRevive(prev, idx));
            setRevivePending(false);
          }}
          onCancel={() => setRevivePending(false)}
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
      {pileInspector === "spent" && (
        <PileInspector
          title="Spent pile"
          hint="Cards you've played, in the order they resolved."
          cards={cardState.consumedPile}
          onClose={() => setPileInspector(null)}
        />
      )}
    </div>
  );
}

