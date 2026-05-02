// Match shell.
//
// Two play modes:
//   - "local-pvp" — both sides controlled on the same screen (legacy M1 mode).
//   - "vs-ai"     — the human plays White, Stockfish plays Black (M2).
//
// Interaction:
//   - Click a piece to select; click a highlighted square to move.
//   - Or drag a piece onto a target square.
//
// AI lifecycle:
//   - A single StockfishEngine instance is owned by the component.
//   - On every position change where it's the AI's turn, we kick off a
//     getBestMove() at the difficulty's depth and apply the result.
//   - We track a "generation" counter so a late bestmove from a torn-down
//     game (mode change, new game) is discarded silently.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Board } from "./Board/Board";
import { ChoseEngine, type LegalMove } from "../game/chess/engine";
import {
  StockfishEngine,
  uciToMove,
  depthForDifficulty,
  type Difficulty,
  type StockfishOptions,
} from "../ai/stockfish";
import type { AlgebraicSquare, MatchOutcome, Side } from "../game/types";

import styles from "./Match.module.css";

export type MatchMode = "local-pvp" | "vs-ai";

type Props = {
  /** Default mode. Defaults to "vs-ai". Tests pass "local-pvp" to skip AI. */
  initialMode?: MatchMode;
  initialDifficulty?: Difficulty;
  /** Hook to swap the AI engine in tests. */
  createAi?: (opts?: StockfishOptions) => StockfishEngine;
};

const HUMAN_SIDE: Side = "player";
const AI_SIDE: Side = "opponent";

export function Match({
  initialMode = "vs-ai",
  initialDifficulty = "normal",
  createAi,
}: Props = {}) {
  const [mode, setMode] = useState<MatchMode>(initialMode);
  const [difficulty, setDifficulty] = useState<Difficulty>(initialDifficulty);
  const [engine, setEngine] = useState(() => new ChoseEngine());
  const [selected, setSelected] = useState<AlgebraicSquare | null>(null);
  // Bumped after each move so derived render values recompute.
  const [version, setVersion] = useState(0);
  const [aiThinking, setAiThinking] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

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
        const uci = await ai.getBestMove({ depth: depthForDifficulty(difficulty) });
        if (cancelled || generationRef.current !== myGen) return;
        if (!uci) return; // no legal move (mate / stalemate handled separately)
        const move = uciToMove(uci);
        engine.move(move);
        setVersion((v) => v + 1);
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
  }, [isAiTurn, difficulty, version, mode]);

  // ---- Player input handlers -----------------------------------------------

  /**
   * Try to play `target` from `selected`. Returns true if a move was made.
   */
  const tryPlay = useCallback(
    (from: AlgebraicSquare, to: AlgebraicSquare): boolean => {
      const legal = engine.legalMoves(from).find((m) => m.to === to);
      if (!legal) return false;
      engine.move({ from, to, promotion: legal.promotion });
      setSelected(null);
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

  const onSquareClick = useCallback(
    (sq: AlgebraicSquare) => {
      if (matchOver || aiThinking) return;
      if (selected) {
        if (tryPlay(selected, sq)) return;
        // Re-target: clicking another own piece switches the selection.
        if (trySelect(sq)) return;
      } else if (trySelect(sq)) {
        return;
      }
      setSelected(null);
    },
    [matchOver, aiThinking, selected, tryPlay, trySelect],
  );

  const onSquareDragStart = useCallback(
    (sq: AlgebraicSquare) => {
      if (matchOver || aiThinking) return;
      trySelect(sq);
    },
    [matchOver, aiThinking, trySelect],
  );

  const onSquareDrop = useCallback(
    (sq: AlgebraicSquare) => {
      if (matchOver || aiThinking) return;
      if (selected && selected !== sq) {
        if (tryPlay(selected, sq)) return;
      }
      // Drop on an invalid target leaves the piece where it was; clear selection.
      setSelected(null);
    },
    [matchOver, aiThinking, selected, tryPlay],
  );

  const onDragCancel = useCallback(() => {
    // Mouse released outside any valid target: clear selection.
    // (We keep the click-selection model otherwise consistent.)
    setSelected(null);
  }, []);

  // ---- Game lifecycle -------------------------------------------------------

  const onNewGame = useCallback(() => {
    generationRef.current++;
    aiRef.current?.stop();
    setEngine(new ChoseEngine());
    setSelected(null);
    setVersion(0);
    setAiThinking(false);
    setAiError(null);
  }, []);

  const onModeChange = useCallback(
    (next: MatchMode) => {
      if (next === mode) return;
      generationRef.current++;
      aiRef.current?.stop();
      setMode(next);
      setEngine(new ChoseEngine());
      setSelected(null);
      setVersion(0);
      setAiThinking(false);
      setAiError(null);
    },
    [mode],
  );

  // ---- Render ---------------------------------------------------------------

  const boardLocked = matchOver || aiThinking;

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

        {aiError && (
          <div className={styles.aiError} role="alert">
            AI error: {aiError}
          </div>
        )}

        {matchOver && (
          <div className={styles.outcome} role="status" aria-live="polite">
            <div className={styles.outcomeHeadline}>{outcomeHeadline(outcome)}</div>
            <div className={styles.outcomeDetail}>{outcomeDetail(outcome)}</div>
            <button type="button" onClick={onNewGame} className={styles.newGame}>
              New game
            </button>
          </div>
        )}
        {!matchOver && (
          <button type="button" onClick={onNewGame} className={styles.resetButton}>
            Reset
          </button>
        )}
      </aside>

      <Board
        engine={engine}
        selected={selected}
        legalMovesFromSelected={legalFromSelected}
        controllableSides={controllableSides}
        onSquareClick={onSquareClick}
        onSquareDragStart={onSquareDragStart}
        onSquareDrop={onSquareDrop}
        onDragCancel={onDragCancel}
        locked={boardLocked}
      />
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
