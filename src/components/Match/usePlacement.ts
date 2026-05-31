// Placement mode — lets the player drag-and-drop roster pieces onto the board
// before a skirmish match begins.  Lives as a hook inside Match so the full
// match UI (ticker, sidebars, board) is visible during placement.  When active,
// its returned board overrides replace useBoardInteraction's handlers, and its
// trayNode replaces the Hand.

import { createElement, useCallback, useMemo, useRef, useState } from "react";

import type { ChoseEngine, LegalMove } from "../../game/chess/engine";
import { squareCoords, squareName } from "../../game/chess/engine";
import { validatePlacement } from "../../game/progression/placement";
import {
  SKIRMISH_PIECE_VALUE,
  placementValue,
  skirmishValueCap,
} from "../../game/progression/skirmish";
import type {
  AlgebraicSquare,
  BoardSize,
  FileIndex,
  Piece,
  PieceType,
  RankIndex,
  Side,
} from "../../game/types";
import type { BoardMode } from "../Board/Board";

import { PlacementTray } from "./PlacementTray";

// ---- Public types -----------------------------------------------------------

export type PlacementConfig = {
  roster: ReadonlyArray<Piece>;
  boardSize: BoardSize;
  matchNumber: number;
  onConfirm: (backRank: (PieceType | null)[], pawnFiles: boolean[]) => void;
};

export type PlacementActive = {
  active: true;
  selected: AlgebraicSquare | null;
  legalMovesFromSelected: LegalMove[];
  boardMode: BoardMode;
  acceptAnyDrop: boolean;
  controllableSides: ReadonlySet<Side>;
  onSquareClick: (sq: AlgebraicSquare) => void;
  onSquareDragStart: (sq: AlgebraicSquare) => void;
  onSquareDrop: (sq: AlgebraicSquare) => void;
  onDragCancel: () => void;
  trayNode: React.ReactNode;
};

export type PlacementResult = PlacementActive | { active: false };

// ---- Constants --------------------------------------------------------------

const PLAYER_ONLY: ReadonlySet<Side> = new Set(["player"]);

// ---- Hook -------------------------------------------------------------------

export function usePlacement(
  config: PlacementConfig | null,
  engine: ChoseEngine,
  bumpVersion: () => void,
  version: number,
): PlacementResult {
  // All hooks must be called unconditionally (React rules).

  const [placedMap, setPlacedMap] = useState<Map<number, AlgebraicSquare>>(() => new Map());
  const [selectedTrayIdx, setSelectedTrayIdx] = useState<number | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<AlgebraicSquare | null>(null);
  const trayDragRef = useRef<{
    rosterIdx: number;
    pieceType: PieceType;
  } | null>(null);
  const [trayDragPieceType, setTrayDragPieceType] = useState<PieceType | null>(null);
  const boardDragFromRef = useRef<AlgebraicSquare | null>(null);

  // ---- Early exit (inactive) ------------------------------------------------

  // Wrap config values for stable references when inactive.
  const roster = config?.roster ?? EMPTY_ROSTER;
  const files = config?.boardSize.files ?? 8;
  const ranks = config?.boardSize.ranks ?? 8;
  const matchNumber = config?.matchNumber ?? 1;
  const valueCap = config ? skirmishValueCap(matchNumber) : 0;
  const onConfirmCb = config?.onConfirm;

  // ---- Mirror helpers -------------------------------------------------------

  const mirrorSq = useCallback(
    (sq: AlgebraicSquare): AlgebraicSquare => {
      const { file, rank } = squareCoords(sq);
      return squareName(file, (ranks - 1 - rank) as RankIndex);
    },
    [ranks],
  );

  const placePieceWithMirror = useCallback(
    (sq: AlgebraicSquare, pieceType: PieceType) => {
      engine.placePiece(sq, { type: pieceType, side: "player" });
      engine.placePiece(mirrorSq(sq), { type: pieceType, side: "opponent" });
      bumpVersion();
    },
    [engine, mirrorSq, bumpVersion],
  );

  const removePieceWithMirror = useCallback(
    (sq: AlgebraicSquare) => {
      engine.removePiece(sq);
      engine.removePiece(mirrorSq(sq));
      bumpVersion();
    },
    [engine, mirrorSq, bumpVersion],
  );

  const movePieceWithMirror = useCallback(
    (from: AlgebraicSquare, to: AlgebraicSquare) => {
      const piece = engine.pieceAt(from);
      if (!piece || from === to) return;
      engine.removePiece(from);
      engine.removePiece(mirrorSq(from));
      engine.removePiece(to);
      engine.removePiece(mirrorSq(to));
      engine.placePiece(to, piece);
      engine.placePiece(mirrorSq(to), { type: piece.type, side: "opponent" });
      bumpVersion();
    },
    [engine, mirrorSq, bumpVersion],
  );

  // ---- Valid squares --------------------------------------------------------

  const validSquaresFor = useCallback(
    (pieceType: PieceType, excludeSquare?: AlgebraicSquare): Set<AlgebraicSquare> => {
      const valid = new Set<AlgebraicSquare>();
      const targetRank = pieceType === "pawn" ? 1 : 0;
      for (let f = 0; f < files; f++) {
        const sq = squareName(f as FileIndex, targetRank as RankIndex);
        const occupied = engine.pieceAt(sq) !== null;
        const isSource = sq === excludeSquare;
        if (!occupied || isSource) valid.add(sq);
      }
      return valid;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [engine, files, version],
  );

  const isValidPlacement = useCallback(
    (sq: AlgebraicSquare, pieceType: PieceType, excludeSquare?: AlgebraicSquare): boolean => {
      const { rank } = squareCoords(sq);
      const expectedRank = pieceType === "pawn" ? 1 : 0;
      if (rank !== expectedRank) return false;
      const occupied = engine.pieceAt(sq) !== null;
      return !occupied || sq === excludeSquare;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [engine, version],
  );

  // ---- Derived state --------------------------------------------------------

  const { backRank, pawnRank, currentValue, kingPlaced } = useMemo(() => {
    const br: (PieceType | null)[] = [];
    const pr: boolean[] = [];
    const types: PieceType[] = [];
    for (let f = 0; f < files; f++) {
      const bSq = squareName(f as FileIndex, 0 as RankIndex);
      const bPiece = engine.pieceAt(bSq);
      const bType = bPiece?.side === "player" ? bPiece.type : null;
      br.push(bType);
      if (bType) types.push(bType);

      const pSq = squareName(f as FileIndex, 1 as RankIndex);
      const pPiece = engine.pieceAt(pSq);
      const hasPawn = !!(pPiece?.side === "player" && pPiece.type === "pawn");
      pr.push(hasPawn);
      if (hasPawn) types.push("pawn");
    }
    return {
      backRank: br,
      pawnRank: pr,
      currentValue: placementValue(types),
      kingPlaced: br.includes("king"),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, files, version]);

  const validation = useMemo(
    () => validatePlacement(backRank, pawnRank, files, matchNumber),
    [backRank, pawnRank, files, matchNumber],
  );
  const canStart = validation.valid && kingPlaced;

  const placedIndicesSet = useMemo(() => new Set(placedMap.keys()), [placedMap]);

  // ---- Board mode & legal moves ---------------------------------------------

  const boardMode: BoardMode = useMemo(() => {
    if (!config) return { kind: "play" };
    if (selectedTrayIdx !== null) {
      const piece = roster[selectedTrayIdx];
      return {
        kind: "target",
        cardName: "",
        hint: `Click a highlighted square to place your ${piece.type}.`,
        valid: validSquaresFor(piece.type),
      };
    }
    if (trayDragPieceType !== null) {
      return {
        kind: "target",
        cardName: "",
        hint: `Drop your ${trayDragPieceType} on a highlighted square.`,
        valid: validSquaresFor(trayDragPieceType),
      };
    }
    return { kind: "play" };
  }, [config, selectedTrayIdx, trayDragPieceType, roster, validSquaresFor]);

  const legalMovesFromSelected: LegalMove[] = useMemo(() => {
    if (!config || !selectedSquare) return EMPTY_LEGAL;
    const piece = engine.pieceAt(selectedSquare);
    if (!piece || piece.side !== "player") return EMPTY_LEGAL;
    const valid = validSquaresFor(piece.type, selectedSquare);
    const moves: LegalMove[] = [];
    for (const sq of valid) {
      if (sq === selectedSquare) continue;
      moves.push({
        from: selectedSquare,
        to: sq,
        san: "",
        isCapture: false,
        isPromotion: false,
        isCastle: false,
      });
    }
    return moves;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, selectedSquare, engine, version, validSquaresFor]);

  // ---- Roster lookup --------------------------------------------------------

  const findRosterIdxAtSquare = useCallback(
    (sq: AlgebraicSquare): number | null => {
      for (const [idx, placedSq] of placedMap) {
        if (placedSq === sq) return idx;
      }
      return null;
    },
    [placedMap],
  );

  // ---- Board interaction handlers -------------------------------------------

  const onSquareClick = useCallback(
    (sq: AlgebraicSquare) => {
      if (!config) return;

      if (selectedTrayIdx !== null) {
        const piece = roster[selectedTrayIdx];
        if (isValidPlacement(sq, piece.type)) {
          placePieceWithMirror(sq, piece.type);
          setPlacedMap((m) => new Map(m).set(selectedTrayIdx, sq));
          setSelectedTrayIdx(null);
        }
        return;
      }

      if (selectedSquare !== null) {
        if (sq === selectedSquare) {
          const rosterIdx = findRosterIdxAtSquare(selectedSquare);
          removePieceWithMirror(selectedSquare);
          if (rosterIdx !== null) {
            setPlacedMap((m) => {
              const next = new Map(m);
              next.delete(rosterIdx);
              return next;
            });
          }
          setSelectedSquare(null);
          return;
        }
        const piece = engine.pieceAt(selectedSquare);
        if (piece && isValidPlacement(sq, piece.type, selectedSquare)) {
          const rosterIdx = findRosterIdxAtSquare(selectedSquare);
          movePieceWithMirror(selectedSquare, sq);
          if (rosterIdx !== null) {
            setPlacedMap((m) => new Map(m).set(rosterIdx, sq));
          }
          setSelectedSquare(null);
          return;
        }
        const clickedPiece = engine.pieceAt(sq);
        if (clickedPiece?.side === "player") {
          setSelectedSquare(sq);
          return;
        }
        setSelectedSquare(null);
        return;
      }

      const piece = engine.pieceAt(sq);
      if (piece?.side === "player") {
        setSelectedSquare(sq);
        setSelectedTrayIdx(null);
      }
    },
    [
      config,
      selectedTrayIdx,
      selectedSquare,
      roster,
      engine,
      isValidPlacement,
      placePieceWithMirror,
      removePieceWithMirror,
      movePieceWithMirror,
      findRosterIdxAtSquare,
      // eslint-disable-next-line react-hooks/exhaustive-deps
      version,
    ],
  );

  const onSquareDragStart = useCallback(
    (sq: AlgebraicSquare) => {
      if (!config) return;
      const piece = engine.pieceAt(sq);
      if (!piece || piece.side !== "player") return;
      boardDragFromRef.current = sq;
      setSelectedSquare(sq);
      setSelectedTrayIdx(null);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config, engine, version],
  );

  const onSquareDrop = useCallback(
    (sq: AlgebraicSquare) => {
      if (!config) return;

      if (trayDragRef.current) {
        const { rosterIdx, pieceType } = trayDragRef.current;
        boardDragFromRef.current = null;
        if (isValidPlacement(sq, pieceType)) {
          placePieceWithMirror(sq, pieceType);
          setPlacedMap((m) => new Map(m).set(rosterIdx, sq));
        }
        trayDragRef.current = null;
        setTrayDragPieceType(null);
        setSelectedTrayIdx(null);
        return;
      }

      const from = boardDragFromRef.current;
      boardDragFromRef.current = null;
      if (from && from !== sq) {
        const piece = engine.pieceAt(from);
        if (piece && isValidPlacement(sq, piece.type, from)) {
          const rosterIdx = findRosterIdxAtSquare(from);
          movePieceWithMirror(from, sq);
          if (rosterIdx !== null) {
            setPlacedMap((m) => new Map(m).set(rosterIdx, sq));
          }
        }
      }
      setSelectedSquare(null);
    },
    [
      config,
      engine,
      isValidPlacement,
      placePieceWithMirror,
      movePieceWithMirror,
      findRosterIdxAtSquare,
      // eslint-disable-next-line react-hooks/exhaustive-deps
      version,
    ],
  );

  const onDragCancel = useCallback(() => {
    boardDragFromRef.current = null;
    trayDragRef.current = null;
    setTrayDragPieceType(null);
    setSelectedSquare(null);
  }, []);

  // ---- Tray handlers --------------------------------------------------------

  const handleTrayClick = useCallback(
    (rosterIdx: number) => {
      setSelectedSquare(null);
      setSelectedTrayIdx(selectedTrayIdx === rosterIdx ? null : rosterIdx);
    },
    [selectedTrayIdx],
  );

  const handleTrayDragStart = useCallback(
    (e: React.DragEvent, rosterIdx: number, pieceType: PieceType) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(rosterIdx));
      const img = e.currentTarget.querySelector("img");
      if (img && typeof e.dataTransfer.setDragImage === "function") {
        const rect = img.getBoundingClientRect();
        e.dataTransfer.setDragImage(img, e.clientX - rect.left, e.clientY - rect.top);
      }
      trayDragRef.current = { rosterIdx, pieceType };
      setTrayDragPieceType(pieceType);
      setSelectedSquare(null);
      setSelectedTrayIdx(null);
    },
    [],
  );

  const handleTrayDragEnd = useCallback(() => {
    trayDragRef.current = null;
    setTrayDragPieceType(null);
  }, []);

  const handleTrayDragOver = useCallback((e: React.DragEvent) => {
    if (boardDragFromRef.current) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    }
  }, []);

  const handleTrayDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const from = boardDragFromRef.current;
      boardDragFromRef.current = null;
      if (from) {
        const rosterIdx = findRosterIdxAtSquare(from);
        removePieceWithMirror(from);
        if (rosterIdx !== null) {
          setPlacedMap((m) => {
            const next = new Map(m);
            next.delete(rosterIdx);
            return next;
          });
        }
      }
      setSelectedSquare(null);
    },
    [findRosterIdxAtSquare, removePieceWithMirror],
  );

  // ---- Auto-place -----------------------------------------------------------

  const handleAutoPlace = useCallback(() => {
    if (!config) return;

    const newPlaced = new Map(placedMap);

    let totalPawns = 0;
    for (const p of roster) if (p.type === "pawn") totalPawns++;

    let unplacedKingIdx = -1;
    const unplacedNonPawns: number[] = [];
    const unplacedPawns: number[] = [];
    for (let i = 0; i < roster.length; i++) {
      if (newPlaced.has(i)) continue;
      if (roster[i].type === "king") unplacedKingIdx = i;
      else if (roster[i].type === "pawn") unplacedPawns.push(i);
      else unplacedNonPawns.push(i);
    }

    if (unplacedKingIdx >= 0) {
      const center = Math.floor(files / 2);
      let kingFile = -1;
      for (let d = 0; d < files; d++) {
        for (const f of d === 0 ? [center] : [center - d, center + d]) {
          if (f >= 0 && f < files && !engine.pieceAt(squareName(f as FileIndex, 0 as RankIndex))) {
            kingFile = f;
            break;
          }
        }
        if (kingFile >= 0) break;
      }
      if (kingFile >= 0) {
        const kingSq = squareName(kingFile as FileIndex, 0 as RankIndex);
        engine.placePiece(kingSq, { type: "king", side: "player" });
        engine.placePiece(mirrorSq(kingSq), { type: "king", side: "opponent" });
        newPlaced.set(unplacedKingIdx, kingSq);
      }
    }

    let fi = 0;
    for (const i of unplacedNonPawns) {
      while (fi < files && engine.pieceAt(squareName(fi as FileIndex, 0 as RankIndex))) fi++;
      if (fi >= files) break;
      const piece = roster[i];
      const placed: PieceType[] = [];
      for (let f = 0; f < files; f++) {
        const p = engine.pieceAt(squareName(f as FileIndex, 0 as RankIndex));
        if (p?.side === "player") placed.push(p.type);
      }
      const pawnVal = Math.min(totalPawns, files) * SKIRMISH_PIECE_VALUE.pawn;
      if (placementValue([...placed, piece.type]) + pawnVal > valueCap) continue;
      const sq = squareName(fi as FileIndex, 0 as RankIndex);
      engine.placePiece(sq, { type: piece.type, side: "player" });
      engine.placePiece(mirrorSq(sq), { type: piece.type, side: "opponent" });
      newPlaced.set(i, sq);
      fi++;
    }

    let pf = 0;
    for (const idx of unplacedPawns) {
      while (pf < files && engine.pieceAt(squareName(pf as FileIndex, 1 as RankIndex))) pf++;
      if (pf >= files) break;
      const sq = squareName(pf as FileIndex, 1 as RankIndex);
      engine.placePiece(sq, { type: "pawn", side: "player" });
      engine.placePiece(mirrorSq(sq), { type: "pawn", side: "opponent" });
      newPlaced.set(idx, sq);
      pf++;
    }

    setPlacedMap(newPlaced);
    setSelectedSquare(null);
    setSelectedTrayIdx(null);
    bumpVersion();
  }, [config, engine, roster, files, valueCap, mirrorSq, bumpVersion, placedMap]);

  // ---- Subtitle -------------------------------------------------------------

  const subtitle = useMemo(() => {
    if (trayDragPieceType) return `Drop your ${trayDragPieceType} on a highlighted square.`;
    if (selectedTrayIdx !== null)
      return `Click a highlighted square to place your ${roster[selectedTrayIdx].type}.`;
    if (selectedSquare) return "Click a dot to move, or click the piece again to remove it.";
    return "Select or drag a piece from below to place it on the board.";
  }, [trayDragPieceType, selectedTrayIdx, selectedSquare, roster]);

  // ---- Confirm wrapper ------------------------------------------------------

  const handleConfirm = useCallback(() => {
    onConfirmCb?.(backRank, pawnRank);
  }, [onConfirmCb, backRank, pawnRank]);

  // ---- Return ---------------------------------------------------------------

  if (!config) return { active: false } as const;

  const trayNode = createElement(PlacementTray, {
    roster,
    placedIndicesSet,
    selectedTrayIdx,
    currentValue,
    valueCap,
    conscriptValue: Math.max(0, valueCap - currentValue),
    validationErrors: validation.errors,
    canStart,
    subtitle,
    onTrayClick: handleTrayClick,
    onTrayDragStart: handleTrayDragStart,
    onTrayDragEnd: handleTrayDragEnd,
    onTrayDragOver: handleTrayDragOver,
    onTrayDrop: handleTrayDrop,
    onAutoPlace: handleAutoPlace,
    onConfirm: handleConfirm,
  });

  return {
    active: true,
    selected: selectedSquare,
    legalMovesFromSelected,
    boardMode,
    acceptAnyDrop: trayDragPieceType !== null,
    controllableSides: PLAYER_ONLY,
    onSquareClick,
    onSquareDragStart,
    onSquareDrop,
    onDragCancel,
    trayNode,
  };
}

// ---- Module-level constants -------------------------------------------------

const EMPTY_ROSTER: ReadonlyArray<Piece> = [];
const EMPTY_LEGAL: LegalMove[] = [];
