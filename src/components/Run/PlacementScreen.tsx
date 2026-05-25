import { useCallback, useMemo, useState } from "react";
import { PieceGlyph } from "../Board/PieceGlyph";
import { validatePlacement } from "../../game/progression/placement";
import {
  SKIRMISH_PIECE_VALUE,
  placementValue,
  skirmishValueCap,
} from "../../game/progression/skirmish";
import type { BoardSize, Piece, PieceType } from "../../game/types";

import styles from "./PlacementScreen.module.css";

type Props = {
  roster: ReadonlyArray<Piece>;
  boardSize: BoardSize;
  matchNumber: number;
  onConfirm: (backRank: (PieceType | null)[], pawnFiles: boolean[]) => void;
};

export function PlacementScreen({ roster, boardSize, matchNumber, onConfirm }: Props) {
  const { files, ranks } = boardSize;
  const valueCap = skirmishValueCap(matchNumber);

  const nonPawnPieces = useMemo(
    () => roster.filter((p) => p.type !== "pawn" && p.type !== "king"),
    [roster],
  );
  const pawnCount = useMemo(() => roster.filter((p) => p.type === "pawn").length, [roster]);

  const [backRank, setBackRank] = useState<(PieceType | null)[]>(() => new Array(files).fill(null));
  const [pawnRank, setPawnRank] = useState<boolean[]>(() => {
    const arr = new Array(files).fill(false);
    for (let i = 0; i < Math.min(pawnCount, files); i++) arr[i] = true;
    return arr;
  });
  const [selectedRosterIdx, setSelectedRosterIdx] = useState<number | null>(null);
  const [placedIndices, setPlacedIndices] = useState<Set<number>>(() => new Set());

  const kingPlaced = backRank.includes("king");

  const placedPawnCount = pawnRank.filter(Boolean).length;
  const allPlacedTypes: PieceType[] = [
    ...backRank.filter((t): t is PieceType => t !== null),
    ...new Array(placedPawnCount).fill("pawn" as PieceType),
  ];
  const currentValue = placementValue(allPlacedTypes);

  const validation = useMemo(
    () => validatePlacement(backRank, pawnRank, files, matchNumber),
    [backRank, pawnRank, files, matchNumber],
  );

  const canStart = validation.valid && kingPlaced;

  const handleSquareClick = useCallback(
    (file: number, rank: number) => {
      // Rank 0 = player back rank (rank 1 in chess notation)
      if (rank === 0) {
        // If square has a piece, pick it up
        if (backRank[file] !== null) {
          const pieceType = backRank[file]!;
          if (pieceType === "king") {
            // Remove king from the back rank
            setBackRank((br) => {
              const next = [...br];
              next[file] = null;
              return next;
            });
          } else {
            // Find which roster index placed this piece and unplace it
            const idx = findPlacedIndex(nonPawnPieces, pieceType, placedIndices, file, backRank);
            setBackRank((br) => {
              const next = [...br];
              next[file] = null;
              return next;
            });
            if (idx !== null) {
              setPlacedIndices((s) => {
                const next = new Set(s);
                next.delete(idx);
                return next;
              });
            }
          }
          return;
        }
        // Place the selected roster piece
        if (selectedRosterIdx !== null) {
          const piece = nonPawnPieces[selectedRosterIdx];
          setBackRank((br) => {
            const next = [...br];
            next[file] = piece.type;
            return next;
          });
          setPlacedIndices((s) => new Set(s).add(selectedRosterIdx));
          setSelectedRosterIdx(null);
          return;
        }
        // If king not placed and nothing selected, place king
        if (!kingPlaced) {
          setBackRank((br) => {
            const next = [...br];
            next[file] = "king";
            return next;
          });
        }
      }
      // Rank 1 = pawn rank (rank 2 in chess notation)
      if (rank === 1) {
        setPawnRank((pr) => {
          const next = [...pr];
          if (next[file]) {
            next[file] = false;
          } else {
            const currentPawns = next.filter(Boolean).length;
            if (currentPawns < pawnCount) {
              next[file] = true;
            }
          }
          return next;
        });
      }
    },
    [backRank, selectedRosterIdx, nonPawnPieces, kingPlaced, placedIndices, pawnCount],
  );

  const handleAutoPlace = useCallback(() => {
    const newBackRank: (PieceType | null)[] = new Array(files).fill(null);
    const newPlaced = new Set<number>();

    // Place king in a roughly central position
    const kingFile = Math.floor(files / 2);
    newBackRank[kingFile] = "king";

    // Place available non-pawn pieces left to right
    let fileIdx = 0;
    for (let i = 0; i < nonPawnPieces.length; i++) {
      while (fileIdx < files && newBackRank[fileIdx] !== null) fileIdx++;
      if (fileIdx >= files) break;
      const piece = nonPawnPieces[i];
      // Check if adding this piece would exceed the value cap
      const alreadyPlaced = newBackRank.filter((t): t is PieceType => t !== null);
      const pawnVal = Math.min(pawnCount, files);
      const futureVal =
        placementValue([...alreadyPlaced, piece.type]) + pawnVal * SKIRMISH_PIECE_VALUE.pawn;
      if (futureVal > valueCap) continue;
      newBackRank[fileIdx] = piece.type;
      newPlaced.add(i);
      fileIdx++;
    }

    // Auto-place pawns left to right
    const newPawnRank = new Array(files).fill(false);
    for (let f = 0; f < Math.min(pawnCount, files); f++) {
      newPawnRank[f] = true;
    }

    setBackRank(newBackRank);
    setPawnRank(newPawnRank);
    setPlacedIndices(newPlaced);
    setSelectedRosterIdx(null);
  }, [files, nonPawnPieces, pawnCount, valueCap]);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h2 className={styles.title}>Place your army</h2>
        <p className={styles.subtitle}>
          {!kingPlaced
            ? "Click a back-rank square to place your king."
            : selectedRosterIdx !== null
              ? `Click a back-rank square to place your ${nonPawnPieces[selectedRosterIdx].type}.`
              : "Select a piece from your roster, then click a square."}
        </p>
      </header>

      <div className={styles.layout}>
        <div className={styles.board} style={{ gridTemplateColumns: `repeat(${files}, 52px)` }}>
          {Array.from({ length: ranks }, (_, visualRank) => {
            const rank = ranks - 1 - visualRank;
            return Array.from({ length: files }, (_, file) => {
              const isLight = (file + rank) % 2 === 1;
              const isBackRank = rank === 0;
              const isPawnRank = rank === 1;
              const isPlaceable = isBackRank || isPawnRank;
              const piece = isBackRank
                ? backRank[file]
                  ? { type: backRank[file]!, side: "player" as const }
                  : null
                : isPawnRank && pawnRank[file]
                  ? { type: "pawn" as const, side: "player" as const }
                  : null;

              return (
                <div
                  key={`${file}-${rank}`}
                  className={`${styles.square} ${isLight ? styles.light : styles.dark} ${isPlaceable ? styles.placeable : styles.inactive}`}
                  onClick={() => isPlaceable && handleSquareClick(file, rank)}
                  role={isPlaceable ? "button" : undefined}
                  aria-label={
                    isPlaceable
                      ? `${String.fromCharCode(97 + file)}${rank + 1}${piece ? ` (${piece.type})` : ""}`
                      : undefined
                  }
                >
                  {piece && (
                    <span className={styles.glyph}>
                      <PieceGlyph piece={piece} />
                    </span>
                  )}
                </div>
              );
            });
          }).flat()}
        </div>

        <div className={styles.roster}>
          <span className={styles.rosterTitle}>{!kingPlaced ? "Place king first" : "Roster"}</span>
          <div className={styles.rosterPieces}>
            {nonPawnPieces.map((p, i) => {
              const isPlaced = placedIndices.has(i);
              if (isPlaced) return null;
              return (
                <button
                  key={`${p.type}-${i}`}
                  type="button"
                  className={`${styles.rosterPiece} ${selectedRosterIdx === i ? styles.selected : ""}`}
                  onClick={() => {
                    if (!kingPlaced) return;
                    setSelectedRosterIdx(selectedRosterIdx === i ? null : i);
                  }}
                  disabled={!kingPlaced}
                  aria-label={`${p.type} (${SKIRMISH_PIECE_VALUE[p.type]} value)`}
                >
                  <span className={styles.glyph}>
                    <PieceGlyph piece={p} />
                  </span>
                </button>
              );
            })}
          </div>
          <span className={styles.rosterTitle}>
            Pawns: {placedPawnCount} / {pawnCount} placed (click rank 2)
          </span>
        </div>
      </div>

      <div className={styles.info}>
        <span className={`${styles.valueMeter} ${currentValue > valueCap ? styles.overCap : ""}`}>
          Value: {currentValue} / {valueCap}
        </span>
        {validation.errors.length > 0 && (
          <ul className={styles.errors}>
            {validation.errors.map((e, i) => (
              <li key={i} className={styles.error}>
                {e}
              </li>
            ))}
          </ul>
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
  );
}

function findPlacedIndex(
  nonPawnPieces: ReadonlyArray<Piece>,
  pieceType: PieceType,
  placedIndices: Set<number>,
  _file: number,
  _backRank: (PieceType | null)[],
): number | null {
  for (const idx of placedIndices) {
    if (nonPawnPieces[idx]?.type === pieceType) return idx;
  }
  return null;
}
