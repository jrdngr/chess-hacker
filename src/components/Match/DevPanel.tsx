// Sandbox-mode side panel — board editor, side-to-move toggle, AI controls,
// energy controls, and a Library overlay. Rendered only when Match's
// `runMode` is "dev". All state lives in Match; this component is purely
// presentational.

import { useMemo, useState } from "react";

import { PieceGlyph } from "../Board/PieceGlyph";
import { CARD_LIBRARY } from "../../game/cards/library";
import type { BoardSize, Card, Piece, PieceType, Side } from "../../game/types";

import styles from "./DevPanel.module.css";

/** A piece picked in the editor palette, or "erase" to clear a square. */
export type EditorPiece = { type: PieceType; side: Side } | "erase" | null;

const SIZE_OPTIONS = [3, 4, 5, 6, 7, 8] as const;

type Props = {
  // Editor
  editorPiece: EditorPiece;
  onPickEditorPiece: (piece: EditorPiece) => void;
  /** Drag a palette piece (or "erase") onto the board. */
  onPaletteDragStart: (piece: { type: PieceType; side: Side } | "erase") => void;
  onPaletteDragEnd: () => void;
  sideToMove: Side;
  onSetSideToMove: (side: Side) => void;
  onClearBoard: () => void;
  onStandardStart: () => void;
  /**
   * Current board size. Pickers are shown for files (3..8) and ranks (3..8)
   * independently — devs can build any rectangle for testing.
   */
  boardSize: BoardSize;
  onResizeBoard: (size: BoardSize) => void;
  /**
   * Plain-English list of validation violations for the current position
   * (e.g. "Two white kings", "Pawn on rank 8"). Empty when the position is
   * valid. Renders below the editor controls.
   */
  validationMessages: ReadonlyArray<string>;

  // AI
  devAiOn: boolean;
  onToggleDevAi: () => void;
  aiSingleMoveDisabled: boolean;
  onTriggerAiSingleMove: () => void;

  // Library
  libraryDisabled: boolean;
  onPlayLibraryCard: (card: Card) => void;
  /** Drag a library card onto the board (synth + enter targeting). */
  onLibraryCardDragStart: (card: Card) => void;
  onLibraryCardDragEnd: () => void;

  // Energy
  onBumpEnergy: () => void;

  /** Heading shown at the top of the panel. Defaults to "Sandbox". */
  heading?: string;
  /** When provided, renders a close button in the panel header. */
  onClose?: () => void;
};

const PIECE_TYPES: PieceType[] = ["king", "queen", "rook", "bishop", "knight", "pawn"];

export function DevPanel({
  editorPiece,
  onPickEditorPiece,
  onPaletteDragStart,
  onPaletteDragEnd,
  sideToMove,
  onSetSideToMove,
  onClearBoard,
  onStandardStart,
  boardSize,
  onResizeBoard,
  validationMessages,
  devAiOn,
  onToggleDevAi,
  aiSingleMoveDisabled,
  onTriggerAiSingleMove,
  libraryDisabled,
  onPlayLibraryCard,
  onLibraryCardDragStart,
  onLibraryCardDragEnd,
  onBumpEnergy,
  heading = "Sandbox",
  onClose,
}: Props) {
  const [showLibrary, setShowLibrary] = useState(false);

  if (showLibrary) {
    return (
      <LibraryOverlay
        libraryDisabled={libraryDisabled}
        onPlayLibraryCard={onPlayLibraryCard}
        onLibraryCardDragStart={onLibraryCardDragStart}
        onLibraryCardDragEnd={onLibraryCardDragEnd}
        onClose={() => setShowLibrary(false)}
      />
    );
  }

  const isPieceSelected = (type: PieceType, side: Side): boolean =>
    editorPiece !== null &&
    editorPiece !== "erase" &&
    editorPiece.type === type &&
    editorPiece.side === side;

  return (
    <aside className={styles.devPanel}>
      <div className={styles.libraryHeader}>
        <h3 className={styles.heading}>{heading}</h3>
        {onClose && (
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Hide dev panel"
          >
            ×
          </button>
        )}
      </div>

      <Section label="Editor">
        <p className={styles.note}>
          Click a piece to select it, then click a square to place. Or drag the piece straight onto
          the board. Each placement consumes the brush — pick again to place another.
        </p>
        <div className={styles.paletteGrid}>
          {(["player", "opponent"] as Side[]).map((side) => (
            <div key={side} className={styles.paletteRow}>
              <span className={styles.paletteLabel}>{side === "player" ? "White" : "Black"}</span>
              {PIECE_TYPES.map((type) => {
                const selected = isPieceSelected(type, side);
                return (
                  <button
                    key={`${side}-${type}`}
                    type="button"
                    className={`${styles.paletteButton} ${selected ? styles.paletteActive : ""}`}
                    onClick={() => onPickEditorPiece(selected ? null : { type, side })}
                    title={`${side} ${type}`}
                    aria-label={`Pick ${side} ${type}`}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "copy";
                      e.dataTransfer.setData("text/plain", `${side}-${type}`);
                      const img = e.currentTarget.querySelector("img");
                      if (img && typeof e.dataTransfer.setDragImage === "function") {
                        const rect = img.getBoundingClientRect();
                        e.dataTransfer.setDragImage(
                          img,
                          e.clientX - rect.left,
                          e.clientY - rect.top,
                        );
                      }
                      onPaletteDragStart({ type, side });
                    }}
                    onDragEnd={onPaletteDragEnd}
                  >
                    <PaletteGlyph piece={{ type, side }} />
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <button
          type="button"
          className={`${styles.eraseButton} ${editorPiece === "erase" ? styles.paletteActive : ""}`}
          onClick={() => onPickEditorPiece(editorPiece === "erase" ? null : "erase")}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = "copy";
            e.dataTransfer.setData("text/plain", "erase");
            onPaletteDragStart("erase");
          }}
          onDragEnd={onPaletteDragEnd}
        >
          Erase
        </button>
        <div className={styles.row}>
          <button type="button" className={styles.smallButton} onClick={onClearBoard}>
            Clear board
          </button>
          <button type="button" className={styles.smallButton} onClick={onStandardStart}>
            Standard start
          </button>
        </div>
        <div className={styles.row} role="radiogroup" aria-label="Side to move">
          <span className={styles.label}>To move</span>
          <button
            type="button"
            role="radio"
            aria-checked={sideToMove === "player"}
            className={`${styles.smallButton} ${sideToMove === "player" ? styles.toggleOn : ""}`}
            onClick={() => onSetSideToMove("player")}
          >
            White
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={sideToMove === "opponent"}
            className={`${styles.smallButton} ${sideToMove === "opponent" ? styles.toggleOn : ""}`}
            onClick={() => onSetSideToMove("opponent")}
          >
            Black
          </button>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>Size</span>
          <label className={styles.sizeLabel}>
            files
            <select
              className={styles.select}
              value={boardSize.files}
              onChange={(e) =>
                onResizeBoard({ files: Number(e.target.value), ranks: boardSize.ranks })
              }
              aria-label="Board files"
            >
              {SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.sizeLabel}>
            ranks
            <select
              className={styles.select}
              value={boardSize.ranks}
              onChange={(e) =>
                onResizeBoard({ files: boardSize.files, ranks: Number(e.target.value) })
              }
              aria-label="Board ranks"
            >
              {SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
        {validationMessages.length > 0 && (
          <div className={styles.validationBlock} role="status" aria-live="polite">
            <div className={styles.validationHeading}>Position invalid</div>
            <ul className={styles.validationList}>
              {validationMessages.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      <Section label="AI">
        <label className={styles.checkboxRow}>
          <input type="checkbox" checked={devAiOn} onChange={onToggleDevAi} />
          <span>AI plays Black</span>
        </label>
        <button
          type="button"
          className={styles.smallButton}
          disabled={aiSingleMoveDisabled}
          onClick={onTriggerAiSingleMove}
        >
          AI: play one move
        </button>
      </Section>

      <Section label="Energy">
        <div className={styles.row}>
          <button type="button" className={styles.smallButton} onClick={onBumpEnergy}>
            +1 energy
          </button>
        </div>
      </Section>

      <Section label="Library">
        <button type="button" className={styles.smallButton} onClick={() => setShowLibrary(true)}>
          Open library
        </button>
      </Section>
    </aside>
  );
}

/** Inner glyph used by palette buttons. Wraps PieceGlyph so we can size it. */
function PaletteGlyph({ piece }: { piece: Piece }) {
  return (
    <span className={styles.paletteGlyph}>
      <PieceGlyph piece={piece} />
    </span>
  );
}

type LibraryProps = {
  libraryDisabled: boolean;
  onPlayLibraryCard: (card: Card) => void;
  onLibraryCardDragStart: (card: Card) => void;
  onLibraryCardDragEnd: () => void;
  onClose: () => void;
};

function LibraryOverlay({
  libraryDisabled,
  onPlayLibraryCard,
  onLibraryCardDragStart,
  onLibraryCardDragEnd,
  onClose,
}: LibraryProps) {
  // Group library cards by archetype for browsability.
  const groupedCards = useMemo(() => {
    const groups = new Map<string, Card[]>();
    for (const card of Object.values(CARD_LIBRARY)) {
      const key = card.archetype;
      const list = groups.get(key);
      if (list) list.push(card);
      else groups.set(key, [card]);
    }
    for (const list of groups.values()) {
      list.sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, []);

  return (
    <aside className={`${styles.devPanel} ${styles.libraryPanel}`}>
      <div className={styles.libraryHeader}>
        <h3 className={styles.heading}>Library</h3>
        <button
          type="button"
          className={styles.closeButton}
          onClick={onClose}
          aria-label="Close library"
        >
          ×
        </button>
      </div>
      <p className={styles.note}>
        Plays are free and don't enter the spent pile. Effects (statuses, added cards, summons)
        persist. Click to play, or drag onto the board.
      </p>
      <div className={styles.libraryListFull}>
        {groupedCards.map(([archetype, cards]) => (
          <div key={archetype} className={styles.libraryGroup}>
            <div className={styles.libraryGroupHeading}>{archetype}</div>
            {cards.map((card) => (
              <button
                key={card.id}
                type="button"
                className={styles.libraryCard}
                disabled={libraryDisabled}
                onClick={() => onPlayLibraryCard(card)}
                draggable={!libraryDisabled}
                onDragStart={(e) => {
                  if (libraryDisabled) {
                    e.preventDefault();
                    return;
                  }
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", card.id);
                  if (typeof e.dataTransfer.setDragImage === "function") {
                    e.dataTransfer.setDragImage(e.currentTarget, 0, 0);
                  }
                  onLibraryCardDragStart(card);
                }}
                onDragEnd={onLibraryCardDragEnd}
                data-card-id={card.id}
              >
                <span className={styles.libraryCardCost}>{card.cost}</span>
                <span className={styles.libraryCardName}>{card.name}</span>
                <span className={styles.libraryCardDesc}>{card.description}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </aside>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionHeading}>{label}</div>
      {children}
    </div>
  );
}
