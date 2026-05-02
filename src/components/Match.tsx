// Match shell. M1 scope:
//   - one ChoseEngine instance, both sides controlled by the human
//   - click a piece to select; click a highlighted square to move
//   - declare checkmate / stalemate / draw, offer "new game"
//
// Future milestones replace this with the run state machine + match store.

import { useCallback, useMemo, useState } from "react";

import { Board } from "./Board/Board";
import { ChoseEngine, type LegalMove } from "../game/chess/engine";
import type { AlgebraicSquare, MatchOutcome, Side } from "../game/types";

import styles from "./Match.module.css";

export function Match() {
  const [engine, setEngine] = useState(() => new ChoseEngine());
  const [selected, setSelected] = useState<AlgebraicSquare | null>(null);
  // version: bumped after each move so that derived render values recompute.
  const [version, setVersion] = useState(0);

  const turn: Side = engine.turn();
  const outcome: MatchOutcome = engine.outcome();
  const matchOver = outcome.kind !== "ongoing";
  const inCheck = engine.inCheck();

  // Legal moves originating from the selected square.
  const legalFromSelected: LegalMove[] = useMemo(() => {
    if (!selected) return [];
    return engine.legalMoves(selected);
    // version is included so the memo invalidates after a move
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, selected, version]);

  const onSquareClick = useCallback(
    (sq: AlgebraicSquare) => {
      if (matchOver) return;

      // If a piece is selected and this square is a legal target, move there.
      if (selected) {
        const target = legalFromSelected.find((m) => m.to === sq);
        if (target) {
          engine.move({ from: selected, to: sq, promotion: target.promotion });
          setSelected(null);
          setVersion((v) => v + 1);
          return;
        }
      }

      // Otherwise: select the clicked square iff it has a piece of the side to move.
      const piece = engine.pieceAt(sq);
      if (piece && piece.side === turn) {
        setSelected(sq);
        return;
      }

      // Click on empty / opponent square with nothing selected → clear selection.
      setSelected(null);
    },
    [engine, legalFromSelected, matchOver, selected, turn],
  );

  const onNewGame = useCallback(() => {
    setEngine(new ChoseEngine());
    setSelected(null);
    setVersion(0);
  }, []);

  return (
    <div className={styles.match}>
      <aside className={styles.sidePanel}>
        <div className={styles.statusBlock}>
          <div className={styles.label}>To move</div>
          <div className={`${styles.value} ${turn === "player" ? styles.player : styles.opponent}`}>
            {turn === "player" ? "White" : "Black"}
            {inCheck && !matchOver && <span className={styles.check}>· in check</span>}
          </div>
        </div>
        <div className={styles.statusBlock}>
          <div className={styles.label}>Move</div>
          <div className={styles.value}>{Math.floor(version / 2) + 1}</div>
        </div>
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
        onSquareClick={onSquareClick}
        locked={matchOver}
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
