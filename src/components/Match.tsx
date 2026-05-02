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
import { ChoseEngine, type LegalMove } from "../game/chess/engine";
import {
  StockfishEngine,
  uciToMove,
  depthForDifficulty,
  type Difficulty,
  type StockfishOptions,
} from "../ai/stockfish";
import {
  createMatchCardState,
  hasWallOn,
  playCard,
  startPlayerTurn,
  type BoardContext,
  type PlayTarget,
  type Rng,
} from "../game/cards/match";
import { makeStarterDeck } from "../game/cards/library";
import type { AlgebraicSquare, Card, MatchCardState, MatchOutcome, Side } from "../game/types";

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
};

const DEFAULT_AI_MIN_THINK_MS = 250;

const HUMAN_SIDE: Side = "player";
const AI_SIDE: Side = "opponent";

export function Match({
  initialMode = "vs-ai",
  initialDifficulty = "normal",
  initialFen,
  createAi,
  aiMinThinkMs = DEFAULT_AI_MIN_THINK_MS,
  initialDeck,
  rng,
}: Props = {}) {
  const [mode, setMode] = useState<MatchMode>(initialMode);
  const [difficulty, setDifficulty] = useState<Difficulty>(initialDifficulty);
  const [engine, setEngine] = useState(() => new ChoseEngine(initialFen));
  const [selected, setSelected] = useState<AlgebraicSquare | null>(null);
  // Bumped after each move so derived render values recompute.
  const [version, setVersion] = useState(0);
  const [aiThinking, setAiThinking] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // ---- Card-system state (vs-ai only) --------------------------------------

  const cardsEnabled = mode === "vs-ai";
  const [cardState, setCardState] = useState<MatchCardState>(() =>
    cardsEnabled
      ? startPlayerTurn(createMatchCardState(initialDeck ?? makeStarterDeck(), rng), rng)
      : createMatchCardState([], rng),
  );
  /** Hand index waiting for a target click, or null. */
  const [targetingIndex, setTargetingIndex] = useState<number | null>(null);

  // Increments on new game / mode change so stale AI replies are ignored.
  const generationRef = useRef(0);
  const aiRef = useRef<StockfishEngine | null>(null);

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

  // Legal moves originating from the selected square.
  const legalFromSelected: LegalMove[] = useMemo(() => {
    if (!selected) return [];
    return engine.legalMoves(selected);
    // version invalidates the memo after a move
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, selected, version]);

  const targetingCard: Card | null =
    targetingIndex !== null ? (cardState.hand[targetingIndex] ?? null) : null;

  const boardMode: BoardMode = useMemo(() => {
    if (!targetingCard) return { kind: "play" };
    if (targetingCard.target.kind === "empty-square") {
      return { kind: "target-empty-square", cardName: targetingCard.name };
    }
    if (targetingCard.target.kind === "enemy-piece") {
      return { kind: "target-enemy-piece", cardName: targetingCard.name };
    }
    return { kind: "play" };
  }, [targetingCard]);

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
        // Run the search and a minimum-think timer in parallel: the move can't
        // land sooner than AI_MIN_THINK_MS, but Stockfish's depth dictates the
        // upper bound. This prevents instant snap-moves on shallow depths.
        const [uci] = await Promise.all([
          ai.getBestMove({ depth: depthForDifficulty(difficulty) }),
          new Promise<void>((resolve) => setTimeout(resolve, aiMinThinkMs)),
        ]);
        if (cancelled || generationRef.current !== myGen) return;
        if (!uci) return; // no legal move (mate / stalemate handled separately)
        const move = uciToMove(uci);
        engine.move(move);
        setVersion((v) => v + 1);
        // Roll over to the next player turn (refill + energy reset + tick overlays).
        if (cardsEnabled) {
          setCardState((prev) => startPlayerTurn(prev, rng));
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
    }),
    // engine is mutable; version forces recompute on each move
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [engine, version, cardState],
  );

  /**
   * Try to play `target` from `selected`. Returns true if a move was made.
   * Making a move ends the player's turn — the AI loop kicks in via
   * `isAiTurn` once chess.js flips the turn.
   */
  const tryPlay = useCallback(
    (from: AlgebraicSquare, to: AlgebraicSquare): boolean => {
      const legal = engine.legalMoves(from).find((m) => m.to === to);
      if (!legal) return false;
      engine.move({ from, to, promotion: legal.promotion });
      setSelected(null);
      // Cards are no longer playable on this turn — clear any in-flight target.
      setTargetingIndex(null);
      setVersion((v) => v + 1);
      return true;
    },
    [engine],
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
  }, []);

  const tryResolveCard = useCallback(
    (index: number, target: PlayTarget): boolean => {
      const result = playCard(cardState, index, target, boardContext, rng);
      if (!result.ok) return false;
      setCardState(result.state);
      setTargetingIndex(null);
      return true;
    },
    [cardState, boardContext, rng],
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
        setTargetingIndex(null);
        return;
      }
      if (cardState.energy < card.cost) return;
      if (card.target.kind === "none") {
        tryResolveCard(index, { kind: "none" });
        return;
      }
      // Targeted card — switch into targeting mode and clear any selection.
      setSelected(null);
      setTargetingIndex(index);
    },
    [matchOver, aiThinking, mode, turn, cardState, targetingIndex, tryResolveCard],
  );

  // ---- Square click / drag (chess move OR card target) ---------------------

  const onSquareClick = useCallback(
    (sq: AlgebraicSquare) => {
      if (matchOver || aiThinking) return;

      // Card-targeting takes priority over chess interaction.
      if (targetingIndex !== null) {
        if (tryResolveCard(targetingIndex, { kind: "square", square: sq })) return;
        // Click on an invalid target cancels targeting.
        cancelTargeting();
        return;
      }

      if (selected) {
        if (tryPlay(selected, sq)) return;
        // Re-target: clicking another own piece switches the selection.
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
      if (targetingIndex !== null) return; // drag is for chess moves, not card targeting
      if (selected && selected !== sq) {
        if (tryPlay(selected, sq)) return;
      }
      // Drop on an invalid target leaves the piece where it was; clear selection.
      setSelected(null);
    },
    [matchOver, aiThinking, targetingIndex, selected, tryPlay],
  );

  const onDragCancel = useCallback(() => {
    setSelected(null);
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

  // ---- Render ---------------------------------------------------------------

  const boardLocked = matchOver || aiThinking;

  // Recompute on each move (version bump invalidates).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const captured = useMemo(() => engine.capturedPieces(), [engine, version]);
  const playerMaterial = materialAdvantage(captured.byPlayer);
  const opponentMaterial = materialAdvantage(captured.byOpponent);
  const playerLead = playerMaterial - opponentMaterial;

  const walledSet = useMemo(() => new Set(cardState.walls.map((w) => w.square)), [cardState.walls]);
  const frozenSet = useMemo(
    () => new Set(cardState.freezes.map((f) => f.square)),
    [cardState.freezes],
  );

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

        {cardsEnabled && (
          <div className={styles.statusBlock}>
            <div className={styles.label}>Energy</div>
            <div className={styles.energy} aria-label={`Energy: ${cardState.energy}`}>
              <span className={styles.energyValue}>{cardState.energy}</span>
              <span className={styles.energyMax}>/ {cardState.energyMax}</span>
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
            discardPileCount={cardState.discardPile.length}
            onCardClick={onCardClick}
          />
        )}
      </div>
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
