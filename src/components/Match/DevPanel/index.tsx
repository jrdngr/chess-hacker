// Sandbox-mode side panel — board editor, side-to-move toggle, AI controls,
// energy controls, and a Library overlay. Rendered only when Match's
// `runMode` is "dev". All state lives in Match; this component is purely
// presentational.

import { useState } from "react";

import { PieceGlyph } from "../../Board/PieceGlyph";
import type { Artifact, BoardSize, Card, Piece, PieceType, Side } from "../../../game/types";

import { ArtifactEditorOverlay } from "./ArtifactEditorOverlay";
import { DeckEditorOverlay } from "./DeckEditorOverlay";
import { LibraryOverlay } from "./LibraryOverlay";
import styles from "./DevPanel.module.css";

/** A piece picked in the editor palette, or "erase" to clear a square. */
export type EditorPiece = { type: PieceType; side: Side } | "erase" | null;

const MIN_BOARD_SIZE = 3;
const MAX_BOARD_SIZE = 8;

type Props = {
  // Editor
  editorPiece: EditorPiece;
  onPickEditorPiece: (piece: EditorPiece) => void;
  /** Drag a palette piece (or "erase") onto the board. */
  onPaletteDragStart: (piece: { type: PieceType; side: Side } | "erase") => void;
  onPaletteDragEnd: () => void;
  /**
   * When on, board clicks/drags move existing pieces freely (any side, any
   * destination — overwrite on collision). Toggle is sticky until clicked off.
   */
  editMode: boolean;
  onToggleEditMode: () => void;
  /**
   * Called when a piece dragged from the board is dropped on the Erase
   * button. Match deletes the piece at the in-flight drag's origin square.
   */
  onErasePieceDrop: () => void;
  sideToMove: Side;
  onSetSideToMove: (side: Side) => void;
  onClearBoard: () => void;
  onStandardStart: () => void;
  /**
   * Wipe the board and seed a Chess960 starting position on the *current*
   * board size, using a Standard-mode piece set that fits within the file
   * count. Does not change ranks/files.
   */
  onRandomStart: () => void;
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

  // Deck
  /** Cards still in the player's draw pile. */
  drawPile: ReadonlyArray<Card>;
  /** Cards in the player's discard pile (cycle back when draw empties). */
  discardPile: ReadonlyArray<Card>;
  /** Cards consumed for the match (Consume keyword; will not return). */
  consumedPile: ReadonlyArray<Card>;
  /**
   * Commit the deck-editor changes: replace draw / discard / consumed piles
   * wholesale. `addedCards` is the subset of `drawPile` that wasn't in the
   * deck before (so Match can append it to acquisitionLog). Match is
   * responsible for any rng-y reshuffle.
   */
  onSaveDeck: (next: {
    drawPile: Card[];
    discardPile: Card[];
    consumedPile: Card[];
    addedCards: Card[];
  }) => void;
  /**
   * Named decks authored in the Content Designer and written to
   * `src/game/cards/decks/named/`. Empty when no such decks exist.
   */
  namedDecks: ReadonlyArray<{ name: string; cards: Card[] }>;
  /**
   * Load a named deck wholesale: replace the run's deck and the current
   * match's draw / discard / consumed piles with `cards`. Hand cards stay
   * put. Match pushes a snapshot for undo.
   */
  onLoadDeck: (cards: Card[]) => void;

  // Artifacts
  /** Artifacts currently held by the player. */
  artifacts: ReadonlyArray<Artifact>;
  /**
   * Commit the artifact-editor changes: replace the run's artifact list
   * wholesale. The dev panel surfaces this as Add / Remove buttons against
   * the full artifact library; changes are deferred until Save.
   */
  onSaveArtifacts: (next: Artifact[]) => void;

  // Energy
  onBumpEnergy: () => void;

  /**
   * Dev-only: instantly win the current match and advance the run to the
   * Reward + Shop steps. Provided by Match only when `runMode === "run"`;
   * undefined in the standalone dev sandbox / prototype where there's no
   * run shell to advance.
   */
  onSkipMatchAndWin?: () => void;
  /** True when a real outcome has already fired and the skip is moot. */
  skipMatchDisabled?: boolean;

  // Engine analysis
  devShowEval: boolean;
  onToggleDevShowEval: () => void;
  devShowBestMove: boolean;
  onToggleDevShowBestMove: () => void;

  // History
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  /** Total recorded match-history events. Shown next to the History button. */
  historyCount: number;
  /** Open the History modal. */
  onShowHistory: () => void;

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
  editMode,
  onToggleEditMode,
  onErasePieceDrop,
  sideToMove,
  onSetSideToMove,
  onClearBoard,
  onStandardStart,
  onRandomStart,
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
  drawPile,
  discardPile,
  consumedPile,
  onSaveDeck,
  namedDecks,
  onLoadDeck,
  artifacts,
  onSaveArtifacts,
  devShowEval,
  onToggleDevShowEval,
  devShowBestMove,
  onToggleDevShowBestMove,
  onBumpEnergy,
  onSkipMatchAndWin,
  skipMatchDisabled,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  historyCount,
  onShowHistory,
  heading = "Sandbox",
  onClose,
}: Props) {
  const [showLibrary, setShowLibrary] = useState(false);
  const [showDeckEditor, setShowDeckEditor] = useState(false);
  const [showArtifactEditor, setShowArtifactEditor] = useState(false);

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

  if (showDeckEditor) {
    return (
      <DeckEditorOverlay
        drawPile={drawPile}
        discardPile={discardPile}
        consumedPile={consumedPile}
        namedDecks={namedDecks}
        onLoadDeck={(cards) => {
          onLoadDeck(cards);
          setShowDeckEditor(false);
        }}
        onSave={(next) => {
          onSaveDeck(next);
          setShowDeckEditor(false);
        }}
        onClose={() => setShowDeckEditor(false)}
      />
    );
  }

  if (showArtifactEditor) {
    return (
      <ArtifactEditorOverlay
        artifacts={artifacts}
        onSave={(next) => {
          onSaveArtifacts(next);
          setShowArtifactEditor(false);
        }}
        onClose={() => setShowArtifactEditor(false)}
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

      <Section>
        <div className={styles.row}>
          <button type="button" className={styles.smallButton} onClick={onUndo} disabled={!canUndo}>
            Undo turn
          </button>
          <button type="button" className={styles.smallButton} onClick={onRedo} disabled={!canRedo}>
            Redo turn
          </button>
        </div>
        <div className={styles.row}>
          <button
            type="button"
            className={styles.smallButton}
            onClick={onShowHistory}
            aria-label="Show match history"
          >
            History ({historyCount})
          </button>
        </div>
      </Section>

      <Section>
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
        <div className={styles.row}>
          <button
            type="button"
            className={`${styles.editButton} ${editMode ? styles.paletteActive : ""}`}
            onClick={onToggleEditMode}
            aria-pressed={editMode}
          >
            Edit
          </button>
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
            onDragOver={(e) => {
              // Accept drops of pieces dragged off the board (edit mode) so
              // the user can delete them by dragging onto Erase.
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }}
            onDrop={(e) => {
              e.preventDefault();
              onErasePieceDrop();
            }}
          >
            Erase
          </button>
        </div>
        <div className={styles.row}>
          <button type="button" className={styles.smallButton} onClick={onClearBoard}>
            Clear board
          </button>
          <button type="button" className={styles.smallButton} onClick={onStandardStart}>
            Standard start
          </button>
          <button type="button" className={styles.smallButton} onClick={onRandomStart}>
            Random start
          </button>
        </div>
        <div className={styles.row} role="radiogroup" aria-label="Side to move">
          <span className={styles.label}>To move</span>
          <button
            type="button"
            role="radio"
            aria-checked={sideToMove === "player"}
            className={`${styles.smallButton} ${sideToMove === "player" ? styles.toggleOnPlayer : ""}`}
            onClick={() => onSetSideToMove("player")}
          >
            White
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={sideToMove === "opponent"}
            className={`${styles.smallButton} ${sideToMove === "opponent" ? styles.toggleOnOpponent : ""}`}
            onClick={() => onSetSideToMove("opponent")}
          >
            Black
          </button>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>Size</span>
          <SizeStepper
            label="files"
            value={boardSize.files}
            onChange={(files) => onResizeBoard({ files, ranks: boardSize.ranks })}
          />
          <SizeStepper
            label="ranks"
            value={boardSize.ranks}
            onChange={(ranks) => onResizeBoard({ files: boardSize.files, ranks })}
          />
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

      <Section>
        <div className={styles.row}>
          <label className={styles.checkboxRow}>
            <input type="checkbox" checked={devAiOn} onChange={onToggleDevAi} />
            <span>AI Opponent</span>
          </label>
          <button
            type="button"
            className={styles.smallButton}
            disabled={aiSingleMoveDisabled}
            onClick={onTriggerAiSingleMove}
          >
            AI Move
          </button>
        </div>
      </Section>

      <Section>
        <div className={styles.row}>
          <label className={styles.checkboxRow}>
            <input type="checkbox" checked={devShowEval} onChange={onToggleDevShowEval} />
            <span>Show Eval Bar</span>
          </label>
        </div>
        <div className={styles.row}>
          <label className={styles.checkboxRow}>
            <input type="checkbox" checked={devShowBestMove} onChange={onToggleDevShowBestMove} />
            <span>Show Best Move</span>
          </label>
        </div>
      </Section>

      <Section>
        <div className={styles.row}>
          <button type="button" className={styles.smallButton} onClick={onBumpEnergy}>
            +1 energy
          </button>
        </div>
      </Section>

      {onSkipMatchAndWin && (
        <Section>
          <div className={styles.row}>
            <button
              type="button"
              className={styles.smallButton}
              disabled={skipMatchDisabled}
              onClick={onSkipMatchAndWin}
              title="Skip the rest of this match and advance to Reward + Shop"
            >
              Skip match (auto-win)
            </button>
          </div>
        </Section>
      )}

      <Section>
        <div className={styles.row}>
          <button type="button" className={styles.smallButton} onClick={() => setShowLibrary(true)}>
            Library
          </button>
          <button
            type="button"
            className={styles.smallButton}
            onClick={() => setShowDeckEditor(true)}
          >
            Deck
          </button>
        </div>
        <div className={styles.row}>
          <button
            type="button"
            className={styles.smallButton}
            onClick={() => setShowArtifactEditor(true)}
          >
            Artifacts
          </button>
        </div>
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

function SizeStepper({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const dec = () => {
    if (value > MIN_BOARD_SIZE) onChange(value - 1);
  };
  const inc = () => {
    if (value < MAX_BOARD_SIZE) onChange(value + 1);
  };
  return (
    <div className={styles.sizeStepper}>
      <span className={styles.sizeStepperLabel}>{label}</span>
      <button
        type="button"
        className={styles.sizeStepperButton}
        onClick={dec}
        disabled={value <= MIN_BOARD_SIZE}
        aria-label={`Decrease ${label}`}
      >
        −
      </button>
      <span className={styles.sizeStepperValue} aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        className={styles.sizeStepperButton}
        onClick={inc}
        disabled={value >= MAX_BOARD_SIZE}
        aria-label={`Increase ${label}`}
      >
        +
      </button>
    </div>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return <div className={styles.section}>{children}</div>;
}
