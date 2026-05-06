// Dev-mode board editor — brush palette, edit-mode reposition, erase.
//
// Owns the continuous-interaction state for the editor (which brush is
// loaded, whether edit-mode reposition is on, the in-flight palette / piece
// drags). Per-piece statuses on edited squares are scrubbed on every edit so
// a fresh piece doesn't inherit a stale freeze / shield / etc.
//
// One-shot dev sandbox actions (clearBoard, resize, standardStart, ...) live
// in `useDevSandbox` because they're not editor-continuous-interaction —
// they're more like "reset to a new scenario."

import { useCallback, useRef, useState } from "react";

import type { ChoseEngine } from "../../game/chess/engine";
import { clearStatusesOn } from "../../game/cards/match";
import type { AlgebraicSquare, MatchCardState, PieceType, Side } from "../../game/types";

import type { EditorPiece } from "./DevPanel";
import type { HistoryEvent } from "./history";

type Params = {
  engine: ChoseEngine;
  cardState: MatchCardState;
  setCardState: (next: MatchCardState | ((prev: MatchCardState) => MatchCardState)) => void;
  bumpVersion: () => void;
  pushSnapshot: (state: MatchCardState) => void;
  pushHistory: (event: HistoryEvent) => HistoryEvent[];
  /** Provided by Match (eventually by useBoardInteraction). */
  setSelected: (sq: AlgebraicSquare | null) => void;
};

type Result = {
  // State (read by board interaction + JSX)
  editorPiece: EditorPiece;
  setEditorPiece: (piece: EditorPiece) => void;
  editMode: boolean;
  paletteDragActive: boolean;
  paletteDragRef: React.MutableRefObject<{ type: PieceType; side: Side } | "erase" | null>;
  editDragFromRef: React.MutableRefObject<AlgebraicSquare | null>;
  // Callbacks
  onToggleEditMode: () => void;
  onPaletteDragStart: (piece: { type: PieceType; side: Side } | "erase") => void;
  onPaletteDragEnd: () => void;
  /** Place / overwrite / erase the piece at `sq`, applying `brush`. */
  applyEditorEdit: (sq: AlgebraicSquare, brush: Exclude<EditorPiece, null>) => void;
  /** Edit-mode reposition: move piece at `from` to `to`, overwriting any occupant. */
  applyEditorMove: (from: AlgebraicSquare, to: AlgebraicSquare) => void;
  /** Resolve a drop on the Erase button while an edit-mode drag is in flight. */
  eraseDraggedPiece: () => void;
  /** Reset all editor state (brush cleared, drags cancelled). */
  resetDevEditor: () => void;
};

export function useDevEditor({
  engine,
  cardState,
  setCardState,
  bumpVersion,
  pushSnapshot,
  pushHistory,
  setSelected,
}: Params): Result {
  /**
   * Currently-selected editor brush. When non-null in dev mode, board clicks
   * place / overwrite / erase pieces instead of doing chess moves.
   */
  const [editorPiece, setEditorPiece] = useState<EditorPiece>(null);
  /**
   * Sticky edit-mode toggle. When on (and dev panel is active), board
   * clicks/drags reposition any existing piece — destination is overwritten,
   * sides are ignored, and dropping on the Erase button deletes the piece.
   * Stays on across edits until the user clicks the toggle off.
   */
  const [editMode, setEditMode] = useState(false);
  /**
   * Source square of an in-flight edit-mode drag (a piece dragged off a
   * board square). Read by the board-drop and erase-button-drop handlers
   * so they can resolve the drag as a move or a deletion respectively.
   */
  const editDragFromRef = useRef<AlgebraicSquare | null>(null);
  /**
   * In flight while the user is dragging a piece from the editor palette
   * (or "erase") onto the board. Read by the board-drop handler so we can
   * resolve the drop as an edit even if no brush was clicked first.
   */
  const paletteDragRef = useRef<{ type: PieceType; side: Side } | "erase" | null>(null);
  /** Mirror of paletteDragRef so the Board re-renders to accept any-drop. */
  const [paletteDragActive, setPaletteDragActive] = useState(false);

  const onToggleEditMode = useCallback(() => {
    setEditMode((v) => !v);
  }, []);

  const onPaletteDragStart = useCallback((piece: { type: PieceType; side: Side } | "erase") => {
    paletteDragRef.current = piece;
    setPaletteDragActive(true);
  }, []);

  const onPaletteDragEnd = useCallback(() => {
    paletteDragRef.current = null;
    setPaletteDragActive(false);
    // Drag is a fresh action — clear any previously-clicked brush so
    // it doesn't linger after the drag completes.
    setEditorPiece(null);
  }, []);

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
      bumpVersion();
      pushHistory(
        brush === "erase"
          ? { kind: "editor-edit", turn: next.turn, square: sq, action: "erase" }
          : {
              kind: "editor-edit",
              turn: next.turn,
              square: sq,
              action: "place",
              pieceType: brush.type,
              side: brush.side,
            },
      );
      pushSnapshot(next);
    },
    [engine, cardState, pushSnapshot, pushHistory, bumpVersion, setCardState],
  );

  /**
   * Edit-mode reposition: move the piece at `from` to `to`, overwriting any
   * occupant. Bypasses chess-move legality entirely. Statuses on both squares
   * are dropped (the piece's identity may have shifted in ways the tracker
   * can't follow). Pushes an undo snapshot.
   */
  const applyEditorMove = useCallback(
    (from: AlgebraicSquare, to: AlgebraicSquare) => {
      if (from === to) return;
      const piece = engine.pieceAt(from);
      if (!piece) return;
      engine.removePiece(from);
      engine.removePiece(to);
      engine.placePiece(to, piece);
      let next = clearStatusesOn(cardState, from);
      next = clearStatusesOn(next, to);
      setCardState(next);
      bumpVersion();
      pushSnapshot(next);
    },
    [engine, cardState, pushSnapshot, bumpVersion, setCardState],
  );

  /**
   * Resolve a drop on the Erase button while an edit-mode drag is in flight:
   * delete the piece at the drag's origin square. No-op if no edit drag is
   * active (e.g. palette-erase released onto its own button).
   */
  const eraseDraggedPiece = useCallback(() => {
    const from = editDragFromRef.current;
    editDragFromRef.current = null;
    if (!from) return;
    applyEditorEdit(from, "erase");
    setSelected(null);
  }, [applyEditorEdit, setSelected]);

  const resetDevEditor = useCallback(() => {
    setEditorPiece(null);
    paletteDragRef.current = null;
    setPaletteDragActive(false);
    editDragFromRef.current = null;
  }, []);

  return {
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
  };
}
