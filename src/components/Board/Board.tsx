// 8x8 board.
// Two ways to move a piece:
//   - Click the piece, then click a highlighted square.
//   - Drag the piece onto a target square.

import { useState } from "react";

import { squareCoords, squareName, type ChoseEngine, type LegalMove } from "../../game/chess/engine";
import type { AlgebraicSquare, FileIndex, Piece, RankIndex, Side } from "../../game/types";

import { PieceGlyph } from "./PieceGlyph";
import styles from "./Board.module.css";

/**
 * One line in the hover tooltip — a single effect with its label and an
 * optional remaining-turns count. `remaining` is in player turns; for
 * lightning, it's the number of remaining actions on the piece.
 */
export type EffectInfo = {
  label: string;
  /** Remaining turns (or remaining actions for lightning). Undefined means untimed. */
  remaining?: number;
  /** Trailing units (e.g. "actions" for lightning, default "turns"). */
  unit?: string;
};

/** Effects shown for a hovered square — split into piece-applied and square-applied. */
export type SquareEffects = {
  piece: EffectInfo[];
  square: EffectInfo[];
};

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
   * Per-square hover-tooltip data: piece-applied and square-applied effects.
   * Squares without entries get no tooltip. The Board does not interpret
   * the contents — it just renders rows of {label, remaining}.
   */
  squareEffects?: ReadonlyMap<AlgebraicSquare, SquareEffects>;
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
  /**
   * When true, every square accepts a drop (used for sandbox palette drags
   * where any square is a valid place/erase target). Bypasses the per-square
   * legal-target gate in onDragOver.
   */
  acceptAnyDrop?: boolean;
};

const RANKS_TOP_DOWN: RankIndex[] = [7, 6, 5, 4, 3, 2, 1, 0];
const FILES_LEFT_RIGHT: FileIndex[] = [0, 1, 2, 3, 4, 5, 6, 7];

const DRAG_MIME = "application/x-choss-from";

const EMPTY_SET: ReadonlySet<AlgebraicSquare> = new Set();

const EMPTY_BADGES: ReadonlyMap<AlgebraicSquare, string> = new Map();

const EMPTY_EFFECTS: ReadonlyMap<AlgebraicSquare, SquareEffects> = new Map();

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
  squareEffects = EMPTY_EFFECTS,
  attackedByPlayer = EMPTY_SET,
  attackedByOpponent = EMPTY_SET,
  mode = { kind: "play" },
  onSquareClick,
  onSquareDragStart,
  onSquareDrop,
  onDragCancel,
  locked,
  acceptAnyDrop = false,
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
  // Square the mouse is currently over, for the effects tooltip. Separate
  // from `dragOverSquare` (which only tracks card-targeting hover) so the
  // tooltip can appear during ordinary play without interfering with the
  // green/red targeting tints.
  const [hoverSquare, setHoverSquare] = useState<AlgebraicSquare | null>(null);

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
                    // destination (piece drag), a valid card target (hand
                    // drag), or when acceptAnyDrop is set (sandbox palette
                    // drag — every square is a valid place/erase target).
                    if (targetMoves.has(sq) || validTargetForCard || acceptAnyDrop) {
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
                    setHoverSquare(sq);
                    // Cursor-hover feedback during click-driven targeting
                    // (no drag in progress). HTML5 drag suppresses mouseenter
                    // on most browsers, so this only fires when there isn't
                    // an active drag — exactly what we want.
                    if (targeting) setDragOverSquare(sq);
                  }}
                  onMouseLeave={() => {
                    setHoverSquare((curr) => (curr === sq ? null : curr));
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
        {!targeting && hoverSquare && renderTooltip(hoverSquare, squareEffects)}
      </div>
    </div>
  );
}

function renderTooltip(
  sq: AlgebraicSquare,
  squareEffects: ReadonlyMap<AlgebraicSquare, SquareEffects>,
) {
  const fx = squareEffects.get(sq);
  if (!fx) return null;
  if (fx.piece.length === 0 && fx.square.length === 0) return null;
  const { file, rank } = squareCoords(sq);
  // Visual rows count from the top: rank 7 → row 0, rank 0 → row 7.
  const visualRow = 7 - rank;
  // Anchor above the hovered square unless it's in the top row, in which
  // case anchor below so the tooltip stays inside the visible area.
  const anchorAbove = visualRow > 0;
  const leftPct = (file + 0.5) * 12.5;
  const yPct = anchorAbove ? visualRow * 12.5 : (visualRow + 1) * 12.5;
  const transform = anchorAbove
    ? "translate(-50%, calc(-100% - 6px))"
    : "translate(-50%, 6px)";
  return (
    <div
      className={styles.tooltip}
      role="tooltip"
      style={{ left: `${leftPct}%`, top: `${yPct}%`, transform }}
    >
      {fx.piece.length > 0 && (
        <div className={styles.tooltipSection}>
          <div className={styles.tooltipHeader}>Piece</div>
          {fx.piece.map((e, i) => (
            <div key={i} className={styles.tooltipRow}>
              <span>{e.label}</span>
              {e.remaining !== undefined && (
                <span className={styles.tooltipDuration}>
                  {e.remaining} {e.unit ?? (e.remaining === 1 ? "turn" : "turns")}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      {fx.square.length > 0 && (
        <div className={styles.tooltipSection}>
          <div className={styles.tooltipHeader}>Square</div>
          {fx.square.map((e, i) => (
            <div key={i} className={styles.tooltipRow}>
              <span>{e.label}</span>
              {e.remaining !== undefined && (
                <span className={styles.tooltipDuration}>
                  {e.remaining} {e.unit ?? (e.remaining === 1 ? "turn" : "turns")}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
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
