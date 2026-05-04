// Undo / redo stack for the Match shell.
//
// A snapshot captures the engine's mutable state plus the full MatchCardState
// and the chronological history-event log at a point in time. The stack is
// pushed at every turn rollover (prototype mode) and additionally at editor
// edits / energy bumps / library card plays (dev mode). Redo holds undone
// snapshots until a fresh push clears it.
//
// NOTE: when M5 lands, snapshots will need to extend to cover run state too —
// today the stack is purely match-scoped. See `docs/technical/dev-mode.md`.

import { useCallback, useState } from "react";

import type { ChoseEngine, EngineSnapshot } from "../../game/chess/engine";
import type { MatchCardState } from "../../game/types";
import type { HistoryEvent } from "./history";

export type TurnSnapshot = {
  engineSnapshot: EngineSnapshot;
  cardState: MatchCardState;
  history: HistoryEvent[];
};

export type UndoRedo = {
  /** Number of snapshots on the undo stack. Caller gates `canUndo` on this >= 2. */
  undoDepth: number;
  /** Number of snapshots on the redo stack. Caller gates `canRedo` on this > 0. */
  redoDepth: number;

  /**
   * Push a snapshot onto the undo stack and clear redo. Use this whenever a
   * meaningful unit of action completes — turn rollover (the prototype's only
   * caller) or any dev-mode action (editor edit, energy bump, library play).
   */
  pushSnapshot: (state: MatchCardState, history: HistoryEvent[]) => void;

  /**
   * Rewind the engine + card state to the previous snapshot. Calls
   * `onRestore` with the restored card state and history so the caller can
   * sync React state. Returns true iff anything was popped.
   */
  undo: (onRestore: (cardState: MatchCardState, history: HistoryEvent[]) => void) => boolean;

  /** Re-apply the most recently undone snapshot. Mirror of `undo`. */
  redo: (onRestore: (cardState: MatchCardState, history: HistoryEvent[]) => void) => boolean;

  /**
   * Reset the entire stack. Used when the match resets / mode changes —
   * the next push (typically the initial-mount push) starts a fresh stack.
   */
  reset: () => void;

  /**
   * Seed the stack with a single snapshot. Used at first mount in vs-ai
   * mode — the initial position is the "turn 1" entry that subsequent
   * undos can rewind to.
   */
  seed: (snapshot: TurnSnapshot) => void;
};

export function useUndoRedo(engine: ChoseEngine): UndoRedo {
  const [stack, setStack] = useState<TurnSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<TurnSnapshot[]>([]);

  const pushSnapshot = useCallback(
    (state: MatchCardState, history: HistoryEvent[]) => {
      setStack((prev) => [
        ...prev,
        { engineSnapshot: engine.snapshot(), cardState: state, history: history.slice() },
      ]);
      setRedoStack([]);
    },
    [engine],
  );

  const doUndo = useCallback(
    (onRestore: (cardState: MatchCardState, history: HistoryEvent[]) => void) => {
      let popped = false;
      setStack((prev) => {
        if (prev.length < 2) return prev;
        const top = prev[prev.length - 1];
        const next = prev.slice(0, -1);
        const target = next[next.length - 1];
        engine.restore(target.engineSnapshot);
        onRestore(target.cardState, target.history.slice());
        setRedoStack((r) => [...r, top]);
        popped = true;
        return next;
      });
      return popped;
    },
    [engine],
  );

  const doRedo = useCallback(
    (onRestore: (cardState: MatchCardState, history: HistoryEvent[]) => void) => {
      let applied = false;
      setRedoStack((r) => {
        if (r.length === 0) return r;
        const target = r[r.length - 1];
        engine.restore(target.engineSnapshot);
        onRestore(target.cardState, target.history.slice());
        setStack((prev) => [...prev, target]);
        applied = true;
        return r.slice(0, -1);
      });
      return applied;
    },
    [engine],
  );

  const reset = useCallback(() => {
    setStack([]);
    setRedoStack([]);
  }, []);

  const seed = useCallback((snapshot: TurnSnapshot) => {
    setStack([{ ...snapshot, history: snapshot.history.slice() }]);
    setRedoStack([]);
  }, []);

  return {
    undoDepth: stack.length,
    redoDepth: redoStack.length,
    pushSnapshot,
    undo: doUndo,
    redo: doRedo,
    reset,
    seed,
  };
}
