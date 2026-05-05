// Sandbox-mode side panel — board editor, side-to-move toggle, AI controls,
// energy controls, and a Library overlay. Rendered only when Match's
// `runMode` is "dev". All state lives in Match; this component is purely
// presentational.

import { useMemo, useRef, useState } from "react";

import { PieceGlyph } from "../Board/PieceGlyph";
import { CARD_LIBRARY } from "../../game/cards/library";
import { allArtifacts } from "../../game/artifacts/library";
import { ARTIFACT_SLOT_CAP } from "../../game/types";
import type { Artifact, BoardSize, Card, Piece, PieceType, Side } from "../../game/types";

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

/**
 * Deck-editor entry: a single row in the editor, tagged with where it came
 * from so saving can rebuild the draw / discard / consumed piles correctly.
 * `kind: "new"` rows came from the library and append to the draw pile on
 * save; existing rows preserve their position in their original pile if
 * not removed.
 */
type DeckEntry =
  | { kind: "draw"; card: Card; key: string; removed: boolean }
  | { kind: "discard"; card: Card; key: string; removed: boolean }
  | { kind: "consumed"; card: Card; key: string; removed: boolean }
  | { kind: "new"; card: Card; key: string };

type DeckEditorProps = {
  drawPile: ReadonlyArray<Card>;
  discardPile: ReadonlyArray<Card>;
  consumedPile: ReadonlyArray<Card>;
  namedDecks: ReadonlyArray<{ name: string; cards: Card[] }>;
  onLoadDeck: (cards: Card[]) => void;
  onSave: (next: {
    drawPile: Card[];
    discardPile: Card[];
    consumedPile: Card[];
    addedCards: Card[];
  }) => void;
  onClose: () => void;
};

function DeckEditorOverlay({
  drawPile,
  discardPile,
  consumedPile,
  namedDecks,
  onLoadDeck,
  onSave,
  onClose,
}: DeckEditorProps) {
  const [entries, setEntries] = useState<DeckEntry[]>(() => {
    const out: DeckEntry[] = [];
    drawPile.forEach((card, i) => {
      out.push({ kind: "draw", card, key: `draw-${i}`, removed: false });
    });
    discardPile.forEach((card, i) => {
      out.push({ kind: "discard", card, key: `discard-${i}`, removed: false });
    });
    consumedPile.forEach((card, i) => {
      out.push({ kind: "consumed", card, key: `consumed-${i}`, removed: false });
    });
    return out;
  });
  const [exportText, setExportText] = useState<string | null>(null);
  // Counter for unique keys on newly-added cards.
  const newKeyRef = useRef(0);

  const libraryCards = useMemo(() => {
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

  const liveCards = entries.filter((e) => e.kind === "new" || !e.removed);
  const liveCount = liveCards.length;
  const removedCount = entries.filter((e) => e.kind !== "new" && e.removed).length;
  const addedCount = entries.filter((e) => e.kind === "new").length;

  const toggleRemove = (key: string) => {
    setEntries((prev) =>
      prev.flatMap((e) => {
        if (e.key !== key) return [e];
        if (e.kind === "new") return []; // newly added → drop entirely
        return [{ ...e, removed: !e.removed }];
      }),
    );
  };

  const addCard = (card: Card) => {
    setEntries((prev) => [...prev, { kind: "new", card, key: `new-${newKeyRef.current++}` }]);
  };

  const handleSave = () => {
    const newDraw: Card[] = [];
    const newDiscard: Card[] = [];
    const newConsumed: Card[] = [];
    const added: Card[] = [];
    for (const entry of entries) {
      if (entry.kind === "draw" && !entry.removed) newDraw.push(entry.card);
      else if (entry.kind === "discard" && !entry.removed) newDiscard.push(entry.card);
      else if (entry.kind === "consumed" && !entry.removed) newConsumed.push(entry.card);
      else if (entry.kind === "new") {
        newDraw.push(entry.card);
        added.push(entry.card);
      }
    }
    onSave({
      drawPile: newDraw,
      discardPile: newDiscard,
      consumedPile: newConsumed,
      addedCards: added,
    });
  };

  const handleExport = () => {
    const ids = liveCards.map((e) => e.card.id).join(",");
    setExportText(ids);
  };

  return (
    <aside className={`${styles.devPanel} ${styles.libraryPanel}`}>
      <div className={styles.libraryHeader}>
        <h3 className={styles.heading}>Deck editor</h3>
        <button
          type="button"
          className={styles.closeButton}
          onClick={onClose}
          aria-label="Close deck editor"
        >
          ×
        </button>
      </div>
      <p className={styles.note}>
        Edit your draw + spent piles. Removed cards leave both piles; added cards drop into the draw
        pile. Hand cards are unaffected. Changes apply on Save.
      </p>

      <div className={styles.deckSummaryRow}>
        <span>{liveCount} cards</span>
        {addedCount > 0 && <span className={styles.deckSummaryAdded}>+{addedCount}</span>}
        {removedCount > 0 && <span className={styles.deckSummaryRemoved}>−{removedCount}</span>}
      </div>

      <div className={styles.deckActions}>
        <button type="button" className={styles.smallButton} onClick={handleSave}>
          Save deck
        </button>
        <button type="button" className={styles.smallButton} onClick={onClose}>
          Cancel
        </button>
        <button type="button" className={styles.smallButton} onClick={handleExport}>
          Export deck
        </button>
      </div>

      {exportText !== null && (
        <div className={styles.exportBlock}>
          <textarea
            className={styles.exportTextarea}
            readOnly
            value={exportText}
            rows={3}
            onFocus={(e) => e.currentTarget.select()}
          />
        </div>
      )}

      {namedDecks.length > 0 && (
        <div className={styles.namedDecks}>
          <div className={styles.libraryGroupHeading}>Named decks (Content Designer)</div>
          {namedDecks.map((deck) => (
            <div key={deck.name} className={styles.namedDeckRow}>
              <span className={styles.namedDeckName}>{deck.name}</span>
              <span className={styles.namedDeckCount}>{deck.cards.length} cards</span>
              <button
                type="button"
                className={styles.smallButton}
                onClick={() => {
                  if (
                    confirm(
                      `Replace the current run deck and the match's draw / discard / consumed piles with '${deck.name}' (${deck.cards.length} cards)?`,
                    )
                  ) {
                    onLoadDeck(deck.cards.slice());
                  }
                }}
              >
                Load
              </button>
            </div>
          ))}
        </div>
      )}

      <div className={styles.libraryListFull}>
        <div className={styles.libraryGroup}>
          <div className={styles.libraryGroupHeading}>Current deck</div>
          {entries.length === 0 && <div className={styles.note}>Deck is empty.</div>}
          {entries.map((entry) => {
            const removed = entry.kind !== "new" && entry.removed;
            const tag = entry.kind;
            return (
              <div
                key={entry.key}
                className={`${styles.deckEntry} ${removed ? styles.deckEntryRemoved : ""}`}
              >
                <span className={styles.libraryCardCost}>{entry.card.cost}</span>
                <span className={styles.deckEntryBody}>
                  <span className={styles.libraryCardName}>{entry.card.name}</span>
                  <span className={styles.libraryCardDesc}>{entry.card.description}</span>
                </span>
                <span className={`${styles.deckEntryTag} ${styles[`deckEntryTag_${tag}`] ?? ""}`}>
                  {tag}
                </span>
                <button
                  type="button"
                  className={styles.deckEntryRemoveButton}
                  onClick={() => toggleRemove(entry.key)}
                  aria-label={removed ? "Restore card" : "Remove card"}
                >
                  {entry.kind === "new" ? "×" : removed ? "↺" : "×"}
                </button>
              </div>
            );
          })}
        </div>

        <div className={styles.libraryGroup}>
          <div className={styles.libraryGroupHeading}>Add from library</div>
          {libraryCards.map(([archetype, cards]) => (
            <div key={archetype} className={styles.libraryGroup}>
              <div className={styles.libraryGroupHeading}>{archetype}</div>
              {cards.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  className={styles.libraryCard}
                  onClick={() => addCard(card)}
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
      </div>
    </aside>
  );
}

/**
 * Artifact-editor entry. Existing artifacts can be marked `removed` and undone;
 * newly added ones drop entirely when un-added.
 */
type ArtifactEntry =
  | { kind: "existing"; artifact: Artifact; key: string; removed: boolean }
  | { kind: "new"; artifact: Artifact; key: string };

type ArtifactEditorProps = {
  artifacts: ReadonlyArray<Artifact>;
  onSave: (next: Artifact[]) => void;
  onClose: () => void;
};

function ArtifactEditorOverlay({ artifacts, onSave, onClose }: ArtifactEditorProps) {
  const [entries, setEntries] = useState<ArtifactEntry[]>(() =>
    artifacts.map((artifact, i) => ({
      kind: "existing",
      artifact,
      key: `existing-${i}-${artifact.id}`,
      removed: false,
    })),
  );
  const newKeyRef = useRef(0);

  const liveEntries = entries.filter((e) => e.kind === "new" || !e.removed);
  const liveCount = liveEntries.length;
  const removedCount = entries.filter((e) => e.kind === "existing" && e.removed).length;
  const addedCount = entries.filter((e) => e.kind === "new").length;
  const heldIds = new Set(liveEntries.map((e) => e.artifact.id));

  const groupedLibrary = useMemo(() => {
    const groups = new Map<Artifact["rarity"], Artifact[]>();
    for (const a of allArtifacts()) {
      const list = groups.get(a.rarity);
      if (list) list.push(a);
      else groups.set(a.rarity, [a]);
    }
    for (const list of groups.values()) {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    const order: Artifact["rarity"][] = ["common", "uncommon", "rare"];
    return order
      .filter((r) => groups.has(r))
      .map((r) => [r, groups.get(r)!] as [Artifact["rarity"], Artifact[]]);
  }, []);

  const toggleRemove = (key: string) => {
    setEntries((prev) =>
      prev.flatMap((e) => {
        if (e.key !== key) return [e];
        if (e.kind === "new") return [];
        return [{ ...e, removed: !e.removed }];
      }),
    );
  };

  const addArtifact = (artifact: Artifact) => {
    setEntries((prev) => [...prev, { kind: "new", artifact, key: `new-${newKeyRef.current++}` }]);
  };

  const handleSave = () => {
    const next: Artifact[] = [];
    for (const entry of entries) {
      if (entry.kind === "existing" && !entry.removed) next.push(entry.artifact);
      else if (entry.kind === "new") next.push(entry.artifact);
    }
    onSave(next);
  };

  return (
    <aside className={`${styles.devPanel} ${styles.libraryPanel}`}>
      <div className={styles.libraryHeader}>
        <h3 className={styles.heading}>Artifact editor</h3>
        <button
          type="button"
          className={styles.closeButton}
          onClick={onClose}
          aria-label="Close artifact editor"
        >
          ×
        </button>
      </div>
      <p className={styles.note}>
        Add or remove artifacts on the run. Slot cap is {ARTIFACT_SLOT_CAP}; the dev editor lets you
        go over for testing. Changes apply on Save.
      </p>

      <div className={styles.deckSummaryRow}>
        <span>{liveCount} artifacts</span>
        {addedCount > 0 && <span className={styles.deckSummaryAdded}>+{addedCount}</span>}
        {removedCount > 0 && <span className={styles.deckSummaryRemoved}>−{removedCount}</span>}
      </div>

      <div className={styles.deckActions}>
        <button type="button" className={styles.smallButton} onClick={handleSave}>
          Save artifacts
        </button>
        <button type="button" className={styles.smallButton} onClick={onClose}>
          Cancel
        </button>
      </div>

      <div className={styles.libraryListFull}>
        <div className={styles.libraryGroup}>
          <div className={styles.libraryGroupHeading}>Held</div>
          {entries.length === 0 && <div className={styles.note}>No artifacts held.</div>}
          {entries.map((entry) => {
            const removed = entry.kind === "existing" && entry.removed;
            const tag = entry.kind === "new" ? "new" : "draw";
            return (
              <div
                key={entry.key}
                className={`${styles.deckEntry} ${styles.artifactEntry} ${removed ? styles.deckEntryRemoved : ""}`}
              >
                <span className={styles.deckEntryBody}>
                  <span className={styles.libraryCardName}>{entry.artifact.name}</span>
                  <span className={styles.libraryCardDesc}>{entry.artifact.description}</span>
                </span>
                <span className={`${styles.deckEntryTag} ${styles[`deckEntryTag_${tag}`] ?? ""}`}>
                  {entry.kind === "new" ? "new" : entry.artifact.rarity}
                </span>
                <button
                  type="button"
                  className={styles.deckEntryRemoveButton}
                  onClick={() => toggleRemove(entry.key)}
                  aria-label={removed ? "Restore artifact" : "Remove artifact"}
                >
                  {entry.kind === "new" ? "×" : removed ? "↺" : "×"}
                </button>
              </div>
            );
          })}
        </div>

        <div className={styles.libraryGroup}>
          <div className={styles.libraryGroupHeading}>Add from library</div>
          {groupedLibrary.map(([rarity, list]) => (
            <div key={rarity} className={styles.libraryGroup}>
              <div className={styles.libraryGroupHeading}>{rarity}</div>
              {list.map((a) => {
                const alreadyHeld = heldIds.has(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    className={styles.libraryCard}
                    disabled={alreadyHeld}
                    onClick={() => addArtifact(a)}
                    data-artifact-id={a.id}
                  >
                    <span className={styles.libraryCardName}>{a.name}</span>
                    <span className={styles.libraryCardDesc}>{a.description}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </aside>
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
