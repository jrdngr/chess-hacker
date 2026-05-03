// 8x8 board.
// Two ways to move a piece:
//   - Click the piece, then click a highlighted square.
//   - Drag the piece onto a target square.

import { useState } from "react";

import { squareName, type ChoseEngine, type LegalMove } from "../../game/chess/engine";
import type { AlgebraicSquare, FileIndex, Piece, RankIndex, Side } from "../../game/types";

import { PieceGlyph } from "./PieceGlyph";
import styles from "./Board.module.css";

/**
 * What the board is currently asking the player to do.
 *
 * - `play`: normal chess move flow.
 * - `target`: a card is in flight; the user must click one of `validTargets`.
 *   The `hint` is shown above the board (e.g., "Pick an empty square for
 *   Barricade"). `valid` decides which squares are highlighted as legal
 *   targets and which are dimmed.
 * - `drop-anywhere`: a no-target card is in flight; the entire board is a
 *   valid drop. The board paints itself green and any drop resolves the card.
 */
export type BoardMode =
  | { kind: "play" }
  | { kind: "target"; cardName: string; hint: string; valid: ReadonlySet<AlgebraicSquare> }
  | { kind: "drop-anywhere"; cardName: string; hint: string };

type Props = {
  engine: ChoseEngine;
  selected: AlgebraicSquare | null;
  legalMovesFromSelected: LegalMove[];
  /** Side(s) the human is allowed to move. Drag/click only enables for these sides. */
  controllableSides: ReadonlySet<Side>;
  /** Squares that have a wall overlay on them. */
  walledSquares?: ReadonlySet<AlgebraicSquare>;
  /** Squares that hold a frozen piece. */
  frozenSquares?: ReadonlySet<AlgebraicSquare>;
  /** Squares with a sanctuary overlay. */
  sanctuarySquares?: ReadonlySet<AlgebraicSquare>;
  /** Squares with a trap overlay. */
  trapSquares?: ReadonlySet<AlgebraicSquare>;
  /** Player pieces with active status badges (root/disarm/compel/shield/haste/lightning/empower). */
  pieceBadges?: ReadonlyMap<AlgebraicSquare, string>;
  /**
   * "Chess vision" overlays: squares attacked by each side. When both sets
   * contain a square, it renders purple; player-only is blue, opponent-only
   * is red. Pass empty sets (or omit) to disable the overlay.
   */
  attackedByPlayer?: ReadonlySet<AlgebraicSquare>;
  attackedByOpponent?: ReadonlySet<AlgebraicSquare>;
  /** Targeting mode for card play. Defaults to plain "play" (chess move). */
  mode?: BoardMode;
  onSquareClick: (square: AlgebraicSquare) => void;
  onSquareDragStart: (square: AlgebraicSquare) => void;
  onSquareDrop: (square: AlgebraicSquare) => void;
  onDragCancel: () => void;
  /** Disable interaction (e.g. when the match is over or AI is thinking). */
  locked?: boolean;
};

const RANKS_TOP_DOWN: RankIndex[] = [7, 6, 5, 4, 3, 2, 1, 0];
const FILES_LEFT_RIGHT: FileIndex[] = [0, 1, 2, 3, 4, 5, 6, 7];

const DRAG_MIME = "application/x-choss-from";

const EMPTY_SET: ReadonlySet<AlgebraicSquare> = new Set();

const EMPTY_BADGES: ReadonlyMap<AlgebraicSquare, string> = new Map();

export function Board({
  engine,
  selected,
  legalMovesFromSelected,
  controllableSides,
  walledSquares = EMPTY_SET,
  frozenSquares = EMPTY_SET,
  sanctuarySquares = EMPTY_SET,
  trapSquares = EMPTY_SET,
  pieceBadges = EMPTY_BADGES,
  attackedByPlayer = EMPTY_SET,
  attackedByOpponent = EMPTY_SET,
  mode = { kind: "play" },
  onSquareClick,
  onSquareDragStart,
  onSquareDrop,
  onDragCancel,
  locked,
}: Props) {
  // ChoseEngine mutates internally on move(), so we recompute these every render.
  // Memoizing on `[engine]` would serve stale data because the ref doesn't change.
  const piecesBySquare = new Map<AlgebraicSquare, Piece>();
  for (const { square, piece } of engine.pieces()) piecesBySquare.set(square, piece);

  const targetMoves = new Map<AlgebraicSquare, LegalMove>();
  for (const mv of legalMovesFromSelected) targetMoves.set(mv.to, mv);

  // Highlight the king's square when the side-to-move is in check.
  let checkSquare: AlgebraicSquare | null = null;
  if (engine.inCheck()) {
    const sideInCheck = engine.turn();
    for (const { square, piece } of engine.pieces()) {
      if (piece.type === "king" && piece.side === sideInCheck) {
        checkSquare = square;
        break;
      }
    }
  }

  const turn = engine.turn();
  const lastMove = engine.lastMove();
  const [dragOverSquare, setDragOverSquare] = useState<AlgebraicSquare | null>(null);

  const targeting = mode.kind !== "play";
  const dropAnywhere = mode.kind === "drop-anywhere";
  const validTargets = mode.kind === "target" ? mode.valid : EMPTY_SET;

  return (
    <div className={styles.boardWrapper} aria-label="Chess board">
      {targeting && (mode.kind === "target" || mode.kind === "drop-anywhere") && (
        <div className={styles.targetingHint} role="status">
          {mode.hint}
        </div>
      )}
      <div
        className={[styles.board, dropAnywhere && styles.boardDropAnywhere]
          .filter(Boolean)
          .join(" ")}
        role="grid"
      >
        {RANKS_TOP_DOWN.map((rank) => (
          <div key={rank} className={styles.row} role="row">
            {FILES_LEFT_RIGHT.map((file) => {
              const sq = squareName(file, rank);
              const piece = piecesBySquare.get(sq) ?? null;
              const isLight = (file + rank) % 2 === 1;
              const isSelected = selected === sq;
              const target = targetMoves.get(sq);
              const isInCheck = sq === checkSquare;
              const isLastMoveSquare = lastMove?.from === sq || lastMove?.to === sq;
              const validTargetForCard =
                dropAnywhere || (targeting && validTargets.has(sq));
              const isPointerOver = dragOverSquare === sq;
              // During card targeting, the cursor square gets a clear
              // green-or-red tint so the player can see exactly which square
              // their drag would land on. (Drop-anywhere skips the per-square
              // tint — the whole board is already painted green.)
              const isDragOver = isPointerOver && !targeting && !!target;
              const cardHoverValid =
                isPointerOver && targeting && !dropAnywhere && validTargetForCard;
              const cardHoverInvalid =
                isPointerOver && targeting && !dropAnywhere && !validTargetForCard;
              const isWalled = walledSquares.has(sq);
              const isFrozen = frozenSquares.has(sq);
              const isSanctuary = sanctuarySquares.has(sq);
              const isTrap = trapSquares.has(sq);
              const badge = pieceBadges.get(sq);

              const attackedByUs = attackedByPlayer.has(sq);
              const attackedByThem = attackedByOpponent.has(sq);
              const visionClass =
                attackedByUs && attackedByThem
                  ? styles.visionBoth
                  : attackedByUs
                    ? styles.visionPlayer
                    : attackedByThem
                      ? styles.visionOpponent
                      : null;

              const draggable =
                !targeting &&
                !locked &&
                piece !== null &&
                piece.side === turn &&
                controllableSides.has(piece.side);

              const cls = [
                styles.square,
                isLight ? styles.light : styles.dark,
                isLastMoveSquare && !targeting && styles.lastMove,
                isSelected && !targeting && styles.selected,
                !targeting && target && (target.isCapture ? styles.capture : styles.target),
                isInCheck && !targeting && styles.check,
                isDragOver && styles.dragOver,
                locked && styles.locked,
                isWalled && styles.walled,
                isFrozen && styles.frozen,
                visionClass,
                targeting &&
                  !dropAnywhere &&
                  validTargetForCard &&
                  !cardHoverValid &&
                  styles.cardTarget,
                targeting &&
                  !dropAnywhere &&
                  !validTargetForCard &&
                  !cardHoverInvalid &&
                  styles.cardTargetDim,
                cardHoverValid && styles.cardHoverValid,
                cardHoverInvalid && styles.cardHoverInvalid,
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <button
                  key={sq}
                  type="button"
                  className={cls}
                  role="gridcell"
                  aria-label={describeSquare(sq, piece, target, {
                    isWalled,
                    isFrozen,
                    isSanctuary,
                    isTrap,
                    badge,
                  })}
                  onClick={() => !locked && onSquareClick(sq)}
                  draggable={draggable}
                  onDragStart={(e) => {
                    if (!draggable) {
                      e.preventDefault();
                      return;
                    }
                    e.dataTransfer.effectAllowed = "move";
                    // Some browsers refuse a drag without setData.
                    e.dataTransfer.setData(DRAG_MIME, sq);
                    e.dataTransfer.setData("text/plain", sq);
                    // Use just the piece glyph as the drag image so the
                    // square's background doesn't trail along with the cursor.
                    // (setDragImage is missing under jsdom — guard for tests.)
                    const pieceEl = e.currentTarget.querySelector("img");
                    if (pieceEl && typeof e.dataTransfer.setDragImage === "function") {
                      const rect = pieceEl.getBoundingClientRect();
                      e.dataTransfer.setDragImage(
                        pieceEl,
                        e.clientX - rect.left,
                        e.clientY - rect.top,
                      );
                    }
                    onSquareDragStart(sq);
                  }}
                  onDragEnd={() => {
                    setDragOverSquare(null);
                    onDragCancel();
                  }}
                  onDragOver={(e) => {
                    // Accept the drop when the square is either a legal chess
                    // destination (piece drag) or a valid card target (hand
                    // drag). The drag source is irrelevant — both flows fire
                    // here, and the dragOver highlight gives feedback.
                    if (targetMoves.has(sq) || validTargetForCard) {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                    } else if (targeting) {
                      // Allow the dragover to register so the red "invalid"
                      // tint shows; preventDefault here would also enable a
                      // drop on this square, which we don't want, so leave it
                      // off — the cursor will show "no-drop" instead.
                    }
                    // Track the hovered square in either case so we can paint
                    // green/red feedback during card-targeting drags.
                    if (
                      dragOverSquare !== sq &&
                      (targetMoves.has(sq) || targeting)
                    ) {
                      setDragOverSquare(sq);
                    }
                  }}
                  onDragLeave={() => {
                    if (dragOverSquare === sq) setDragOverSquare(null);
                  }}
                  onMouseEnter={() => {
                    // Cursor-hover feedback during click-driven targeting
                    // (no drag in progress). HTML5 drag suppresses mouseenter
                    // on most browsers, so this only fires when there isn't
                    // an active drag — exactly what we want.
                    if (targeting) setDragOverSquare(sq);
                  }}
                  onMouseLeave={() => {
                    if (targeting && dragOverSquare === sq) setDragOverSquare(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverSquare(null);
                    onSquareDrop(sq);
                  }}
                  disabled={locked}
                >
                  {file === 0 && <span className={styles.rankLabel}>{rank + 1}</span>}
                  {rank === 0 && <span className={styles.fileLabel}>{"abcdefgh"[file]}</span>}
                  {piece && <PieceGlyph piece={piece} />}
                  {!targeting && target && !piece && (
                    <span className={styles.targetDot} aria-hidden />
                  )}
                  {isWalled && <span className={styles.wallMark} aria-label="wall" />}
                  {isFrozen && <span className={styles.frostMark} aria-label="frozen" />}
                  {isSanctuary && <span className={styles.sanctuaryMark} aria-label="sanctuary" />}
                  {isTrap && <span className={styles.trapMark} aria-label="trap" />}
                  {badge && (
                    <span className={styles.statusBadge} aria-label={badge}>
                      {badgeGlyph(badge)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function describeSquare(
  sq: AlgebraicSquare,
  piece: ReturnType<ChoseEngine["pieces"]>[number]["piece"] | null,
  target: LegalMove | undefined,
  flags: {
    isWalled: boolean;
    isFrozen: boolean;
    isSanctuary: boolean;
    isTrap: boolean;
    badge: string | undefined;
  },
): string {
  const parts: string[] = [sq];
  if (piece) parts.push(`${piece.side} ${piece.type}`);
  if (flags.isFrozen) parts.push("frozen");
  if (flags.isWalled) parts.push("walled");
  if (flags.isSanctuary) parts.push("sanctuary");
  if (flags.isTrap) parts.push("trap");
  if (flags.badge) parts.push(flags.badge);
  if (target) parts.push(target.isCapture ? "capture" : "move");
  return parts.join(", ");
}

function badgeGlyph(badge: string): string {
  if (badge.includes("rooted")) return "⚓";
  if (badge.includes("disarmed")) return "✕";
  if (badge.includes("compelled")) return "!";
  if (badge.includes("shielded")) return "🛡";
  if (badge.includes("haste")) return "⚡";
  if (badge.includes("lightning")) return "⚡⚡";
  if (badge.includes("empower")) return "♞";
  return "•";
}
