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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Board, type BoardMode } from "./Board/Board";
import { CapturedPieces } from "./Board/CapturedPieces";
import { materialAdvantage } from "./Board/material";
import { Hand } from "./Hand/Hand";
import { ReviveModal } from "./Hand/ReviveModal";
import { ScryModal } from "./Hand/ScryModal";
import {
  ChoseEngine,
  movePath,
  type EngineSnapshot,
  type ExtraOverlays,
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
  addToHand,
  clearStatusesOn,
  completeRevive,
  consumeHaste,
  consumeLightningAction,
  createMatchCardState,
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
  shuffleIntoDraw,
  startPlayerTurn,
  type BoardContext,
  type PlayTarget,
  type Rng,
} from "../game/cards/match";
import { makeStarterDeck } from "../game/cards/library";
import type {
  AlgebraicSquare,
  Card,
  EmpowerPattern,
  MatchCardState,
  MatchOutcome,
  Piece,
  Side,
} from "../game/types";

import styles from "./Match.module.css";

export type MatchMode = "local-pvp" | "vs-ai";

type Props = {
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

/**
 * Engine + card-state captured at the start of a player turn. The Undo /
 * Redo buttons (a prototype-only convenience — not a game rule) walk this
 * stack. We snapshot once per player turn, so undo rewinds to the start of
 * a clean turn including the AI's preceding move.
 *
 * `cardState` carries the *full* match-side state at snapshot time —
 * including the hand, draw pile, discard pile, energy, and every overlay
 * list — so a restore reproduces the player's exact decision context (same
 * hand, same energy, same threats on the board).
 */
type TurnSnapshot = {
  engineSnapshot: EngineSnapshot;
  cardState: MatchCardState;
};

const DEFAULT_AI_MIN_THINK_MS = 500;

const HUMAN_SIDE: Side = "player";
const AI_SIDE: Side = "opponent";

/**
 * Resolve any trap the moved piece walked into or crossed. Returns the new
 * card state. Mutates the engine in place if the trap displaces or captures
 * the piece.
 *
 * The first trap found along the move path (origin → destination, exclusive
 * of origin) fires; subsequent traps on the same path are not consulted
 * (the piece never made it that far).
 */
function resolveTrapForMove(
  engine: ChoseEngine,
  cardState: MatchCardState,
  mover: Piece,
  from: AlgebraicSquare,
  to: AlgebraicSquare,
): MatchCardState {
  const path = movePath(mover.type, from, to);
  for (let i = 0; i < path.length; i++) {
    const sq = path[i];
    const trap = cardState.traps.find((t) => t.square === sq);
    if (!trap) continue;

    let next: MatchCardState = {
      ...cardState,
      traps: cardState.traps.filter((t) => t.square !== sq),
    };
    if (trap.effect === "capture") {
      // The piece is captured at the trap square. Engine may have it on `to`
      // (if the trap is at `to`) or at `to` after a pass-through; in either
      // case removing from `to` is correct because the moved piece's final
      // engine position is `to` regardless of where on the path the trap sat.
      engine.removePiece(to);
      next = clearStatusesOn(next, to);
    } else if (trap.effect === "freeze") {
      // If the trap was on an intermediate square, drag the piece back to it
      // so it stops at the trigger point. (For a trap on `to` itself, no
      // displacement is needed.)
      if (sq !== to) {
        engine.displacePiece(to, sq);
        next = relocateStatuses(next, to, sq);
      }
      next = {
        ...next,
        freezes: [
          ...next.freezes.filter((f) => f.square !== sq),
          { square: sq, side: mover.side, expiresOnTurn: next.turn + 1 },
        ],
      };
    } else if (trap.effect === "push") {
      // Push back one square along the path. For a trap at index 0 (the only
      // step away from origin) the push lands on `from`; for an intermediate
      // trap it lands on the previous path square. If that square is occupied
      // (e.g. the move originated there but it's now occupied by the same
      // piece returning, which shouldn't happen — or some other piece was
      // displaced into it) the push fizzles and the trap re-arms.
      const pushBack = i === 0 ? from : path[i - 1];
      if (engine.pieceAt(pushBack)) {
        next = { ...next, traps: [...next.traps, trap] };
      } else if (pushBack !== to) {
        engine.displacePiece(to, pushBack);
        next = relocateStatuses(next, to, pushBack);
      }
    }
    return next;
  }
  return cardState;
}

export function Match({
  initialMode = "vs-ai",
  initialDifficulty = "normal",
  initialFen,
  createAi,
  aiMinThinkMs = DEFAULT_AI_MIN_THINK_MS,
  initialDeck,
  rng,
  initialEnergy,
}: Props = {}) {
  const [mode, setMode] = useState<MatchMode>(initialMode);
  const [difficulty, setDifficulty] = useState<Difficulty>(initialDifficulty);
  const [engine, setEngine] = useState(() => new ChoseEngine(initialFen));
  const [selected, setSelected] = useState<AlgebraicSquare | null>(null);
  // Bumped after each move so derived render values recompute.
  const [version, setVersion] = useState(0);
  const [aiThinking, setAiThinking] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
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
    const fresh = startPlayerTurn(
      createMatchCardState(initialDeck ?? makeStarterDeck(), rng),
      rng,
    );
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
  /**
   * Stack of engine + card-state snapshots, one per player turn.
   * `turnSnapshots[turnSnapshots.length - 1]` is the state at the start of
   * the player's CURRENT turn; the Undo button restores the entry before
   * that. Empty until the first effect-driven push (or in non-vs-AI mode).
   * Undo is unlimited — you can rewind all the way to turn 1.
   */
  const [turnSnapshots, setTurnSnapshots] = useState<TurnSnapshot[]>([]);
  /**
   * Snapshots that have been undone but not yet replaced by a new line of
   * play. Each Undo pushes onto this stack; Redo pops back. A new turn
   * snapshot pushed by the AI loop clears the redo stack — once the player
   * has chosen a different line, the previous future is discarded.
   */
  const [redoStack, setRedoStack] = useState<TurnSnapshot[]>([]);

  // Increments on new game / mode change so stale AI replies are ignored.
  const generationRef = useRef(0);
  const aiRef = useRef<StockfishEngine | null>(null);

  // Take the initial turn snapshot once on first mount (and again on reset/
  // mode change — the reset paths reset `turnSnapshots` to []).
  useEffect(() => {
    if (turnSnapshots.length > 0) return;
    if (mode !== "vs-ai") return;
    setTurnSnapshots([{ engineSnapshot: engine.snapshot(), cardState }]);
    // engine + cardState are captured by the closure; intentional.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnSnapshots.length, mode]);

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
  const walledSet = useMemo(() => new Set(cardState.walls.map((w) => w.square)), [cardState.walls]);
  const frozenSet = useMemo(
    () => new Set(cardState.freezes.map((f) => f.square)),
    [cardState.freezes],
  );
  const rootedSet = useMemo(() => new Set(cardState.roots.map((r) => r.square)), [cardState.roots]);
  const disarmedSet = useMemo(
    () => new Set(cardState.disarms.map((d) => d.square)),
    [cardState.disarms],
  );
  const compelledSet = useMemo(
    () => new Set(cardState.compels.map((c) => c.square)),
    [cardState.compels],
  );
  const shieldedSet = useMemo(
    () => new Set(cardState.shields.map((s) => s.square)),
    [cardState.shields],
  );
  const sanctuarySet = useMemo(
    () => new Set(cardState.sanctuaries.map((s) => s.square)),
    [cardState.sanctuaries],
  );
  const trapSet = useMemo(() => new Set(cardState.traps.map((t) => t.square)), [cardState.traps]);
  const empowerMap = useMemo(() => {
    const m = new Map<AlgebraicSquare, Set<EmpowerPattern>>();
    for (const e of cardState.empowers) {
      let set = m.get(e.square);
      if (!set) {
        set = new Set();
        m.set(e.square, set);
      }
      set.add(e.pattern);
    }
    return m;
  }, [cardState.empowers]);
  const extraOverlays: ExtraOverlays = useMemo(
    () => ({
      roots: rootedSet,
      disarms: disarmedSet,
      compels: compelledSet,
      shields: shieldedSet,
      sanctuaries: sanctuarySet,
      empowers: empowerMap,
    }),
    [rootedSet, disarmedSet, compelledSet, shieldedSet, sanctuarySet, empowerMap],
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

  // Per-square badges shown on top of pieces (root/disarm/compel/shield/haste/lightning/empower).
  const pieceBadges = useMemo(() => {
    const m = new Map<AlgebraicSquare, string>();
    for (const r of cardState.roots) m.set(r.square, "rooted");
    for (const d of cardState.disarms) m.set(d.square, "disarmed");
    for (const c of cardState.compels) m.set(c.square, "compelled");
    for (const s of cardState.shields) m.set(s.square, "shielded");
    for (const h of cardState.hastes) m.set(h.square, "haste");
    for (const l of cardState.lightnings) m.set(l.square, "lightning");
    for (const e of cardState.empowers) {
      const existing = m.get(e.square);
      m.set(e.square, existing ? `${existing}, empowered` : "empowered");
    }
    return m;
  }, [
    cardState.roots,
    cardState.disarms,
    cardState.compels,
    cardState.shields,
    cardState.hastes,
    cardState.lightnings,
    cardState.empowers,
  ]);

  const turn: Side = engine.turn();
  const outcome: MatchOutcome = engine.outcome();
  const matchOver = outcome.kind !== "ongoing";
  const inCheck = engine.inCheck();
  const isAiTurn = mode === "vs-ai" && turn === AI_SIDE && !matchOver;

  // Sides the human is allowed to click / drag.
  const controllableSides = useMemo<ReadonlySet<Side>>(() => {
    if (mode === "local-pvp") return new Set<Side>(["player", "opponent"]);
    return new Set<Side>([HUMAN_SIDE]);
  }, [mode]);

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

  useEffect(() => {
    if (!isAiTurn) return;
    const ai = aiRef.current;
    if (!ai) return;

    const myGen = ++generationRef.current;
    setAiThinking(true);

    let cancelled = false;

    (async () => {
      try {
        await ai.ready();
        if (cancelled || generationRef.current !== myGen) return;
        ai.setPosition(engine.fen());
        // Stockfish doesn't know about overlays. We restrict its root choice
        // to our wall/freeze/sanctuary/shield/compel-aware legal-move set via
        // UCI `searchmoves`, so it can't pick a move that walks through a
        // wall, moves a frozen piece, captures a shielded piece, etc.
        const candidates = engine.legalMoves().map(legalMoveToUci);
        const [uci] = await Promise.all([
          ai.getBestMove({
            depth: depthForDifficulty(difficulty),
            searchMoves: candidates,
          }),
          new Promise<void>((resolve) => setTimeout(resolve, aiMinThinkMs)),
        ]);
        if (cancelled || generationRef.current !== myGen) return;
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

        let nextCardState = cardState;
        if (applied && cardsEnabled && mover) {
          nextCardState = resolveTrapForMove(
            engine,
            nextCardState,
            mover,
            applied.from,
            applied.to,
          );
          setVersion((v) => v + 1);
          // Roll over to the next player turn.
          const turnStarted = startPlayerTurn(nextCardState, rng);
          setCardState(turnStarted);
          // Snapshot the start-of-new-turn state so Undo can rewind here.
          // The snapshot's cardState carries the freshly-drawn hand and full
          // pile/energy/overlay state — restore is bit-exact.
          setTurnSnapshots((prev) => [
            ...prev,
            { engineSnapshot: engine.snapshot(), cardState: turnStarted },
          ]);
          // A new line of play invalidates any redo path.
          setRedoStack([]);
        }
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
  }, [isAiTurn, difficulty, version, mode, aiMinThinkMs, cardsEnabled]);

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
        // pile. The helper filters by side and piece-type itself.
        next = grantSoulOnCapture(next, captured, "player", rng);
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

      setCardState(next);
      setSelected(null);
      setTargetingIndex(null);
      setPartialTarget(null);
      setMarionetteMoves([]);
      setVersion((v) => v + 1);
      return true;
    },
    [engine, cardState, rng],
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
  }, []);

  const tryResolveCard = useCallback(
    (index: number, target: PlayTarget): boolean => {
      const card = cardState.hand[index];
      if (!card) return false;
      const result = playCard(cardState, index, target, boardContext, rng);
      if (!result.ok) return false;
      let next = result.state;
      // Card-driven board mutations also need their statuses kept in sync,
      // and any side effect that *moves* a piece on the board can spring a
      // trap on its path.
      for (const fx of result.sideEffects) {
        if (fx.kind === "place-piece") {
          engine.placePiece(fx.square, { type: fx.pieceType, side: "player" });
        } else if (fx.kind === "remove-piece") {
          engine.removePiece(fx.square);
          next = clearStatusesOn(next, fx.square);
        } else if (fx.kind === "swap-pieces") {
          // Swap: each piece's statuses follow it. Two relocates are equivalent
          // to a swap when neither destination originally held a status with the
          // other's square — true by construction here.
          next = relocateStatuses(next, fx.a, "__swap_tmp__");
          next = relocateStatuses(next, fx.b, fx.a);
          next = relocateStatuses(next, "__swap_tmp__", fx.b);
          engine.swapPieces(fx.a, fx.b);
        } else if (fx.kind === "foreign-move") {
          const mover = engine.pieceAt(fx.from);
          engine.applyForeignMove({ from: fx.from, to: fx.to });
          next = relocateStatuses(next, fx.from, fx.to);
          if (mover) next = resolveTrapForMove(engine, next, mover, fx.from, fx.to);
        } else if (fx.kind === "add-card-to-hand") {
          next = addToHand(next, fx.card);
        } else if (fx.kind === "add-card-to-draw") {
          next = shuffleIntoDraw(next, fx.card, rng);
        } else if (fx.kind === "revive-prompt") {
          setRevivePending(true);
        }
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
      return true;
    },
    [cardState, boardContext, rng, engine],
  );

  const onCardClick = useCallback(
    (index: number) => {
      if (matchOver || aiThinking) return;
      if (mode !== "vs-ai") return;
      // Cards can only be played before the chess move — i.e. while it's the
      // player's chess turn.
      if (turn !== HUMAN_SIDE) return;
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

  // ---- Square click / drag (chess move OR card target) ---------------------

  const onSquareClick = useCallback(
    (sq: AlgebraicSquare) => {
      if (matchOver || aiThinking) return;

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
    [matchOver, aiThinking, targetingIndex, selected, tryPlay, onSquareClick],
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
    setTurnSnapshots([]);
    setRedoStack([]);
    if (mode === "vs-ai") {
      setCardState(
        startPlayerTurn(createMatchCardState(initialDeck ?? makeStarterDeck(), rng), rng),
      );
    } else {
      setCardState(createMatchCardState([], rng));
    }
  }, [initialFen, initialDeck, mode, rng]);

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
      setTurnSnapshots([]);
      setRedoStack([]);
      if (next === "vs-ai") {
        setCardState(
          startPlayerTurn(createMatchCardState(initialDeck ?? makeStarterDeck(), rng), rng),
        );
      } else {
        setCardState(createMatchCardState([], rng));
      }
    },
    [mode, initialFen, initialDeck, rng],
  );

  /**
   * Roll the match back to the start of the previous player turn —
   * including undoing the AI's most recent move. Repeatable: each call
   * peels one more turn off the stack, all the way back to turn 1.
   */
  const canUndo = cardsEnabled && turnSnapshots.length >= 2 && !aiThinking && !matchOver;
  const canRedo = cardsEnabled && redoStack.length > 0 && !aiThinking && !matchOver;

  const clearTransientUI = useCallback(() => {
    setSelected(null);
    setTargetingIndex(null);
    setPartialTarget(null);
    setMarionetteMoves([]);
    setScryPending(null);
  }, []);

  const undo = useCallback(() => {
    if (!canUndo) return;
    setTurnSnapshots((prev) => {
      if (prev.length < 2) return prev;
      const popped = prev[prev.length - 1];
      const next = prev.slice(0, -1);
      const target = next[next.length - 1];
      engine.restore(target.engineSnapshot);
      setCardState(target.cardState);
      // Stash the undone snapshot so Redo can re-apply it.
      setRedoStack((r) => [...r, popped]);
      clearTransientUI();
      setVersion((v) => v + 1);
      return next;
    });
  }, [canUndo, engine, clearTransientUI]);

  /**
   * Re-apply the most recently undone turn. Cleared when the player makes
   * a new move (i.e. when the AI loop pushes a fresh snapshot).
   */
  const redo = useCallback(() => {
    if (!canRedo) return;
    setRedoStack((r) => {
      if (r.length === 0) return r;
      const target = r[r.length - 1];
      engine.restore(target.engineSnapshot);
      setCardState(target.cardState);
      setTurnSnapshots((prev) => [...prev, target]);
      clearTransientUI();
      setVersion((v) => v + 1);
      return r.slice(0, -1);
    });
  }, [canRedo, engine, clearTransientUI]);

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
          <div className={`${styles.value} ${turn === "player" ? styles.player : styles.opponent}`}>
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
            <button type="button" onClick={resetGame} className={styles.newGame}>
              New game
            </button>
          </div>
        )}
        {!matchOver && (
          <button type="button" onClick={resetGame} className={styles.resetButton}>
            Reset
          </button>
        )}
        {cardsEnabled && !matchOver && (
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
          attackedByPlayer={attackedByPlayer}
          attackedByOpponent={attackedByOpponent}
          mode={boardMode}
          onSquareClick={onSquareClick}
          onSquareDragStart={onSquareDragStart}
          onSquareDrop={onSquareDrop}
          onDragCancel={onDragCancel}
          locked={boardLocked}
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
            enabled={!aiThinking && !matchOver && turn === HUMAN_SIDE}
            drawPileCount={cardState.drawPile.length}
            consumedPileCount={cardState.consumedPile.length}
            onCardClick={onCardClick}
            onCardDragStart={onCardDragStart}
            onCardDragEnd={onCardDragEnd}
          />
        )}
      </div>
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
    </div>
  );
}

function outcomeHeadline(o: MatchOutcome): string {
  switch (o.kind) {
    case "checkmate":
      return o.winner === "player" ? "White wins" : "Black wins";
    case "stalemate":
      return "Stalemate";
    case "draw":
      return "Draw";
    case "ongoing":
      return "";
  }
}

function outcomeDetail(o: MatchOutcome): string {
  switch (o.kind) {
    case "checkmate":
      return "by checkmate";
    case "stalemate":
      return "no legal moves";
    case "draw":
      switch (o.reason) {
        case "insufficient-material":
          return "insufficient material";
        case "threefold-repetition":
          return "threefold repetition";
        case "fifty-move":
          return "fifty-move rule";
        case "other":
          return "drawn position";
      }
      break;
    case "ongoing":
      return "";
  }
}
