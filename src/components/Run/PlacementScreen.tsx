import { useCallback, useMemo, useRef, useState } from "react";
import { Board, type BoardMode } from "../Board/Board";
import { PieceGlyph } from "../Board/PieceGlyph";
import { ChoseEngine, squareName, squareCoords, type LegalMove } from "../../game/chess/engine";
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
  PieceType,
  RankIndex,
  Side,
  Piece,
} from "../../game/types";

import styles from "./PlacementScreen.module.css";

type Props = {
  roster: ReadonlyArray<Piece>;
  boardSize: BoardSize;
  matchNumber: number;
  onConfirm: (backRank: (PieceType | null)[], pawnFiles: boolean[]) => void;
};

const PLAYER_ONLY: ReadonlySet<Side> = new Set(["player"]);

function emptyBoardFen(size: BoardSize): string {
  const row = String(size.files);
  return Array(size.ranks).fill(row).join("/") + " w - - 0 1";
}

export function PlacementScreen({ roster, boardSize, matchNumber, onConfirm }: Props) {
  const { files, ranks } = boardSize;
  const valueCap = skirmishValueCap(matchNumber);

  const [engine] = useState(() => new ChoseEngine(emptyBoardFen(boardSize), boardSize));
  const [version, setVersion] = useState(0);
  const bumpVersion = useCallback(() => setVersion((v) => v + 1), []);

  // Roster index → square on the board.
  const [placedMap, setPlacedMap] = useState<Map<number, AlgebraicSquare>>(() => new Map());

  const [selectedTrayIdx, setSelectedTrayIdx] = useState<number | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<AlgebraicSquare | null>(null);

  const trayDragRef = useRef<{
    rosterIdx: number;
    pieceType: PieceType;
  } | null>(null);
  const [trayDragPieceType, setTrayDragPieceType] = useState<PieceType | null>(null);

  const boardDragFromRef = useRef<AlgebraicSquare | null>(null);

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
  }, [selectedTrayIdx, trayDragPieceType, roster, validSquaresFor]);

  const legalMovesFromSelected: LegalMove[] = useMemo(() => {
    if (!selectedSquare) return [];
    const piece = engine.pieceAt(selectedSquare);
    if (!piece || piece.side !== "player") return [];
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
  }, [selectedSquare, engine, version, validSquaresFor]);

  // ---- Roster lookup helpers ------------------------------------------------

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

  const handleBoardClick = useCallback(
    (sq: AlgebraicSquare) => {
      // Tray piece selected → place on valid square.
      if (selectedTrayIdx !== null) {
        const piece = roster[selectedTrayIdx];
        if (isValidPlacement(sq, piece.type)) {
          placePieceWithMirror(sq, piece.type);
          setPlacedMap((m) => new Map(m).set(selectedTrayIdx, sq));
          setSelectedTrayIdx(null);
        }
        return;
      }

      // Board piece selected → reposition or unplace.
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

      // Nothing selected → select a player piece on the board.
      const piece = engine.pieceAt(sq);
      if (piece?.side === "player") {
        setSelectedSquare(sq);
        setSelectedTrayIdx(null);
      }
    },
    [
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

  const handleBoardDragStart = useCallback(
    (sq: AlgebraicSquare) => {
      const piece = engine.pieceAt(sq);
      if (!piece || piece.side !== "player") return;
      boardDragFromRef.current = sq;
      setSelectedSquare(sq);
      setSelectedTrayIdx(null);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [engine, version],
  );

  const handleBoardDrop = useCallback(
    (sq: AlgebraicSquare) => {
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
      engine,
      isValidPlacement,
      placePieceWithMirror,
      movePieceWithMirror,
      findRosterIdxAtSquare,
      // eslint-disable-next-line react-hooks/exhaustive-deps
      version,
    ],
  );

  const handleDragCancel = useCallback(() => {
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

  // Tray accepts drops from the board (returning pieces to tray).
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
    for (const { square } of engine.pieces()) engine.removePiece(square);

    const newPlaced = new Map<number, AlgebraicSquare>();
    const nonPawnIdxs: number[] = [];
    const pawnIdxs: number[] = [];
    let kingIdx = -1;
    for (let i = 0; i < roster.length; i++) {
      if (roster[i].type === "king") kingIdx = i;
      else if (roster[i].type === "pawn") pawnIdxs.push(i);
      else nonPawnIdxs.push(i);
    }

    const kingFile = Math.floor(files / 2);
    const kingSq = squareName(kingFile as FileIndex, 0 as RankIndex);
    engine.placePiece(kingSq, { type: "king", side: "player" });
    engine.placePiece(mirrorSq(kingSq), { type: "king", side: "opponent" });
    if (kingIdx >= 0) newPlaced.set(kingIdx, kingSq);

    let fi = 0;
    for (const i of nonPawnIdxs) {
      while (fi < files && engine.pieceAt(squareName(fi as FileIndex, 0 as RankIndex))) fi++;
      if (fi >= files) break;
      const piece = roster[i];
      const placed: PieceType[] = [];
      for (let f = 0; f < files; f++) {
        const p = engine.pieceAt(squareName(f as FileIndex, 0 as RankIndex));
        if (p?.side === "player") placed.push(p.type);
      }
      const pawnVal = Math.min(pawnIdxs.length, files) * SKIRMISH_PIECE_VALUE.pawn;
      if (placementValue([...placed, piece.type]) + pawnVal > valueCap) continue;
      const sq = squareName(fi as FileIndex, 0 as RankIndex);
      engine.placePiece(sq, { type: piece.type, side: "player" });
      engine.placePiece(mirrorSq(sq), { type: piece.type, side: "opponent" });
      newPlaced.set(i, sq);
      fi++;
    }

    for (let pi = 0; pi < Math.min(pawnIdxs.length, files); pi++) {
      const sq = squareName(pi as FileIndex, 1 as RankIndex);
      engine.placePiece(sq, { type: "pawn", side: "player" });
      engine.placePiece(mirrorSq(sq), { type: "pawn", side: "opponent" });
      newPlaced.set(pawnIdxs[pi], sq);
    }

    setPlacedMap(newPlaced);
    setSelectedSquare(null);
    setSelectedTrayIdx(null);
    bumpVersion();
  }, [engine, roster, files, valueCap, mirrorSq, bumpVersion]);

  // ---- Subtitle -------------------------------------------------------------

  const subtitle = useMemo(() => {
    if (trayDragPieceType) return `Drop your ${trayDragPieceType} on a highlighted square.`;
    if (selectedTrayIdx !== null)
      return `Click a highlighted square to place your ${roster[selectedTrayIdx].type}.`;
    if (selectedSquare) return "Click a dot to move, or click the piece again to remove it.";
    return "Select or drag a piece from below to place it on the board.";
  }, [trayDragPieceType, selectedTrayIdx, selectedSquare, roster]);

  // ---- Render ---------------------------------------------------------------

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h2 className={styles.title}>Place your army</h2>
        <p className={styles.subtitle}>{subtitle}</p>
      </header>

      <div className={styles.boardArea}>
        <Board
          engine={engine}
          selected={selectedSquare}
          legalMovesFromSelected={legalMovesFromSelected}
          controllableSides={PLAYER_ONLY}
          mode={boardMode}
          onSquareClick={handleBoardClick}
          onSquareDragStart={handleBoardDragStart}
          onSquareDrop={handleBoardDrop}
          onDragCancel={handleDragCancel}
          acceptAnyDrop={trayDragPieceType !== null}
          locked={false}
        />
      </div>

      <div className={styles.tray} onDragOver={handleTrayDragOver} onDrop={handleTrayDrop}>
        <div className={styles.trayTop}>
          <span className={`${styles.valueMeter} ${currentValue > valueCap ? styles.overCap : ""}`}>
            Value: {currentValue} / {valueCap}
          </span>
          {validation.errors.length > 0 && (
            <span className={styles.errors}>
              {validation.errors.map((e, i) => (
                <span key={i} className={styles.error}>
                  {e}
                </span>
              ))}
            </span>
          )}
        </div>

        <div className={styles.trayPieces}>
          {roster.map((p, i) => {
            if (placedIndicesSet.has(i)) return null;
            const isSelected = selectedTrayIdx === i;
            return (
              <button
                key={`${p.type}-${i}`}
                type="button"
                className={`${styles.trayPiece} ${isSelected ? styles.selected : ""}`}
                onClick={() => handleTrayClick(i)}
                draggable
                onDragStart={(e) => handleTrayDragStart(e, i, p.type)}
                onDragEnd={handleTrayDragEnd}
                aria-label={`${p.type} (${SKIRMISH_PIECE_VALUE[p.type]} value)`}
              >
                <span className={styles.trayGlyph}>
                  <PieceGlyph piece={p} />
                </span>
                <span className={styles.trayLabel}>{p.type}</span>
              </button>
            );
          })}
          {placedIndicesSet.size === roster.length && (
            <span className={styles.trayEmpty}>All pieces placed</span>
          )}
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.autoButton} onClick={handleAutoPlace}>
            Auto-place
          </button>
          <button
            type="button"
            className={styles.startButton}
            disabled={!canStart}
            onClick={() => onConfirm(backRank, pawnRank)}
          >
            Start match
          </button>
        </div>
      </div>
    </div>
  );
}
