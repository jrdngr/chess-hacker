// Board interaction — `selected` square + click/drag handlers.
//
// Mostly routing: each board click/drag fans out to either a chess-move
// (tryPlay), card targeting (tryResolveCard), or an editor action depending
// on which mode is active. Logic preserved verbatim from the inline version.
//
// `selected` is passed in from Match (rather than owned here) so it can be
// read+written by the earlier hooks (useCardPlay's tryPlay clears selection,
// dev sandbox resets clear it, etc.) without a hook-ordering cycle.

import { useCallback } from "react";

import type { ChoseEngine, LegalMove } from "../../game/chess/engine";
import type { AlgebraicSquare, Card, PieceType, Side } from "../../game/types";

import type { PromotionChoice } from "../Board/PromotionModal";
import type { EditorPiece } from "./DevPanel";

type Params = {
  engine: ChoseEngine;
  controllableSides: ReadonlySet<Side>;
  turn: Side;
  aiThinking: boolean;
  matchOver: boolean;
  devPanelEnabled: boolean;
  // Selected state owned by Match (passed through from useState).
  selected: AlgebraicSquare | null;
  setSelected: (sq: AlgebraicSquare | null) => void;
  // From useCardPlay
  targetingIndex: number | null;
  targetingCard: Card | null;
  partialTarget: AlgebraicSquare | null;
  marionetteMoves: LegalMove[];
  setPartialTarget: (sq: AlgebraicSquare | null) => void;
  setMarionetteMoves: (moves: LegalMove[]) => void;
  tryPlay: (
    from: AlgebraicSquare,
    to: AlgebraicSquare,
    promotion?: PromotionChoice,
    source?: "click" | "drag",
  ) => boolean;
  tryResolveCard: (
    index: number,
    target:
      | { kind: "none" }
      | { kind: "square"; square: AlgebraicSquare }
      | { kind: "two-squares"; first: AlgebraicSquare; second: AlgebraicSquare }
      | { kind: "hand-card"; index: number },
  ) => boolean;
  cancelTargeting: () => void;
  // From useDevEditor
  editorPiece: EditorPiece;
  setEditorPiece: (piece: EditorPiece) => void;
  editMode: boolean;
  paletteDragRef: React.MutableRefObject<{ type: PieceType; side: Side } | "erase" | null>;
  editDragFromRef: React.MutableRefObject<AlgebraicSquare | null>;
  applyEditorEdit: (sq: AlgebraicSquare, brush: Exclude<EditorPiece, null>) => void;
  applyEditorMove: (from: AlgebraicSquare, to: AlgebraicSquare) => void;
  onPaletteDragEnd: () => void;
  // From shared overlays
  rootedSet: ReadonlySet<AlgebraicSquare>;
};

type Result = {
  trySelect: (sq: AlgebraicSquare) => boolean;
  onSquareClick: (sq: AlgebraicSquare) => void;
  onSquareDragStart: (sq: AlgebraicSquare) => void;
  onSquareDrop: (sq: AlgebraicSquare) => void;
  onDragCancel: () => void;
};

export function useBoardInteraction({
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
}: Params): Result {
  /** Select a square iff it has a piece the human controls right now. */
  const trySelect = useCallback(
    (sq: AlgebraicSquare): boolean => {
      const piece = engine.pieceAt(sq);
      if (!piece) return false;
      if (!controllableSides.has(piece.side)) return false;
      if (piece.side !== turn) return false;
      setSelected(sq);
      return true;
    },
    [engine, controllableSides, turn, setSelected],
  );

  const onSquareClick = useCallback(
    (sq: AlgebraicSquare) => {
      if (aiThinking) return;

      // Editor takes priority while a brush is selected and the dev panel is
      // active — a click places / overwrites / erases the piece on the square
      // per the current brush. The brush is consumed by the placement: the
      // user clicks the palette piece again for each new placement.
      // Bypasses matchOver: invalid positions register as stalemate, and the
      // user needs to keep editing precisely to fix that.
      if (devPanelEnabled && editorPiece !== null) {
        applyEditorEdit(sq, editorPiece);
        setEditorPiece(null);
        return;
      }

      // Edit-mode click flow (sticky toggle): first click selects the piece
      // on `sq`; second click moves the selection to `sq`, overwriting any
      // occupant. Clicking the same square again clears the selection.
      // Bypasses matchOver for the same reason as the brush flow.
      if (devPanelEnabled && editMode) {
        if (selected) {
          if (sq === selected) {
            setSelected(null);
            return;
          }
          applyEditorMove(selected, sq);
          setSelected(null);
          return;
        }
        if (engine.pieceAt(sq)) setSelected(sq);
        return;
      }

      if (matchOver) return;

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
        if (k === "enemy-and-own-piece" || k === "rooted-enemy-and-own-piece") {
          if (!partialTarget) {
            const piece = engine.pieceAt(sq);
            if (piece && piece.side === "opponent" && piece.type !== "king") {
              if (k === "rooted-enemy-and-own-piece" && !rootedSet.has(sq)) {
                cancelTargeting();
                return;
              }
              setPartialTarget(sq);
              return;
            }
            cancelTargeting();
            return;
          }
          // Phase 2: pick one of the player's pieces.
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
      devPanelEnabled,
      editorPiece,
      editMode,
      applyEditorEdit,
      applyEditorMove,
      setEditorPiece,
      targetingIndex,
      targetingCard,
      partialTarget,
      marionetteMoves,
      rootedSet,
      engine,
      tryResolveCard,
      cancelTargeting,
      selected,
      tryPlay,
      trySelect,
      setPartialTarget,
      setMarionetteMoves,
      setSelected,
    ],
  );

  const onSquareDragStart = useCallback(
    (sq: AlgebraicSquare) => {
      if (aiThinking || targetingIndex !== null) return;
      // Edit mode: any piece can be picked up regardless of side or turn.
      // Stash the origin so the drop handler can resolve a reposition (or
      // a delete, if dropped on the Erase button). Bypasses matchOver so
      // the user can recover from invalid positions.
      if (devPanelEnabled && editMode) {
        if (!engine.pieceAt(sq)) return;
        editDragFromRef.current = sq;
        setSelected(sq);
        return;
      }
      if (matchOver) return;
      trySelect(sq);
    },
    [
      matchOver,
      aiThinking,
      targetingIndex,
      devPanelEnabled,
      editMode,
      engine,
      trySelect,
      editDragFromRef,
      setSelected,
    ],
  );

  const onSquareDrop = useCallback(
    (sq: AlgebraicSquare) => {
      if (aiThinking) return;
      // Palette drag (sandbox editor): drop applies the brush regardless of
      // any other in-flight selection. We clear editorPiece here too — the
      // dragend handler also clears it, but dragend is unreliable across
      // browsers, so don't depend on it for the visible highlight.
      // Bypasses matchOver so editor edits can recover from invalid positions.
      if (paletteDragRef.current !== null) {
        applyEditorEdit(sq, paletteDragRef.current);
        onPaletteDragEnd();
        return;
      }
      // Edit-mode reposition: a piece dragged from another square gets
      // moved to `sq`, overwriting any occupant. Bypasses matchOver so the
      // user can edit even from a "checkmate" invalid position.
      if (devPanelEnabled && editMode && editDragFromRef.current) {
        const from = editDragFromRef.current;
        editDragFromRef.current = null;
        applyEditorMove(from, sq);
        setSelected(null);
        return;
      }
      if (matchOver) return;
      if (targetingIndex !== null) {
        // A targeted card was dragged from the hand onto this square. Reuse
        // the same resolution path as a click on the square.
        onSquareClick(sq);
        return;
      }
      if (selected && selected !== sq) {
        // Drag-drop bypasses the slide animation: the user already moved the
        // piece visually with their cursor.
        if (tryPlay(selected, sq, undefined, "drag")) return;
      }
      // Drop on an invalid target leaves the piece where it was; clear selection.
      setSelected(null);
    },
    [
      matchOver,
      aiThinking,
      targetingIndex,
      selected,
      tryPlay,
      onSquareClick,
      applyEditorEdit,
      devPanelEnabled,
      editMode,
      applyEditorMove,
      paletteDragRef,
      onPaletteDragEnd,
      editDragFromRef,
      setSelected,
    ],
  );

  const onDragCancel = useCallback(() => {
    // Drag ended without landing in a board square or on the Erase button —
    // both of those handlers clear the ref themselves. In Edit mode, dragging
    // a piece off the board deletes it (a more discoverable shortcut than
    // hunting for the Erase button).
    const from = editDragFromRef.current;
    editDragFromRef.current = null;
    setSelected(null);
    if (from && devPanelEnabled && editMode) {
      applyEditorEdit(from, "erase");
    }
  }, [devPanelEnabled, editMode, applyEditorEdit, editDragFromRef, setSelected]);

  return {
    trySelect,
    onSquareClick,
    onSquareDragStart,
    onSquareDrop,
    onDragCancel,
  };
}
