// Dev panel — board editor, side-to-move toggle, AI controls, free card
// library, and energy controls. Rendered only when Match's `runMode` is
// "dev". All state lives in Match; this component is purely presentational.

import { useMemo } from "react";

import { CARD_LIBRARY } from "../../game/cards/library";
import type { Card, PieceType, Side } from "../../game/types";

import styles from "./DevPanel.module.css";

/** A piece picked in the editor palette, or "erase" to clear a square. */
export type EditorPiece = { type: PieceType; side: Side } | "erase" | null;

type Props = {
  // Editor
  editorActive: boolean;
  editorPiece: EditorPiece;
  onToggleEditor: () => void;
  onPickEditorPiece: (piece: EditorPiece) => void;
  sideToMove: Side;
  onSetSideToMove: (side: Side) => void;
  onClearBoard: () => void;
  onStandardStart: () => void;

  // AI
  devAiOn: boolean;
  onToggleDevAi: () => void;
  aiSingleMoveDisabled: boolean;
  onTriggerAiSingleMove: () => void;

  // Library
  libraryDisabled: boolean;
  onPlayLibraryCard: (card: Card) => void;

  // Energy
  onBumpEnergy: () => void;
  onRefillEnergy: () => void;
};

const PIECE_TYPES: PieceType[] = ["king", "queen", "rook", "bishop", "knight", "pawn"];
const PIECE_GLYPH: Record<PieceType, string> = {
  king: "K",
  queen: "Q",
  rook: "R",
  bishop: "B",
  knight: "N",
  pawn: "P",
};

export function DevPanel({
  editorActive,
  editorPiece,
  onToggleEditor,
  onPickEditorPiece,
  sideToMove,
  onSetSideToMove,
  onClearBoard,
  onStandardStart,
  devAiOn,
  onToggleDevAi,
  aiSingleMoveDisabled,
  onTriggerAiSingleMove,
  libraryDisabled,
  onPlayLibraryCard,
  onBumpEnergy,
  onRefillEnergy,
}: Props) {
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

  const isPieceSelected = (type: PieceType, side: Side): boolean =>
    editorPiece !== null &&
    editorPiece !== "erase" &&
    editorPiece.type === type &&
    editorPiece.side === side;

  return (
    <aside className={styles.devPanel}>
      <h3 className={styles.heading}>Dev</h3>

      <Section label="Editor">
        <button
          type="button"
          className={`${styles.toggle} ${editorActive ? styles.toggleOn : ""}`}
          onClick={onToggleEditor}
        >
          Editor: {editorActive ? "on" : "off"}
        </button>
        <div className={styles.paletteGrid}>
          {(["player", "opponent"] as Side[]).map((side) => (
            <div key={side} className={styles.paletteRow}>
              <span className={styles.paletteLabel}>{side === "player" ? "White" : "Black"}</span>
              {PIECE_TYPES.map((type) => (
                <button
                  key={`${side}-${type}`}
                  type="button"
                  className={`${styles.paletteButton} ${
                    isPieceSelected(type, side) ? styles.paletteActive : ""
                  } ${side === "player" ? styles.palettePlayer : styles.paletteOpponent}`}
                  onClick={() => onPickEditorPiece({ type, side })}
                  title={`${side} ${type}`}
                  aria-label={`Pick ${side} ${type}`}
                >
                  {PIECE_GLYPH[type]}
                </button>
              ))}
            </div>
          ))}
        </div>
        <button
          type="button"
          className={`${styles.eraseButton} ${editorPiece === "erase" ? styles.paletteActive : ""}`}
          onClick={() => onPickEditorPiece("erase")}
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
          <button type="button" className={styles.smallButton} onClick={onRefillEnergy}>
            Refill (10)
          </button>
        </div>
      </Section>

      <Section label="Card library">
        <p className={styles.note}>
          Plays are free and don't enter the spent pile. Effects (statuses, added cards, summons)
          persist.
        </p>
        <div className={styles.libraryList}>
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
      </Section>
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
