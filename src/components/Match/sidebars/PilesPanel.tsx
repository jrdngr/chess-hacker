// PILES panel — 3-column DRAW / DISC / CONS grid with click-to-toggle
// inline popover. The popover shows a numbered card-name list and
// links out to today's PileInspector modal for the full-art view.

import { useState } from "react";

import type { Card } from "../../../game/types";

import { Panel } from "./Panel";
import styles from "./PilesPanel.module.css";

type PileId = "draw" | "discard" | "consumed";

type Props = {
  drawPile: ReadonlyArray<Card>;
  discardPile: ReadonlyArray<Card>;
  consumedPile: ReadonlyArray<Card>;
  /** Open today's PileInspector modal (full card art, hint, etc.). */
  onOpenFull: (kind: "draw" | "discard") => void;
};

const LABEL: Record<PileId, string> = { draw: "DRAW", discard: "DISC", consumed: "CONS" };
const ARIA_LABEL: Record<PileId, string> = {
  draw: "Draw pile",
  discard: "Discard pile",
  consumed: "Consumed pile",
};

function PileButton({
  id,
  count,
  selected,
  onClick,
}: {
  id: PileId;
  count: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`${styles.pile} ${styles[id]} ${selected ? styles.selected : ""}`}
      onClick={onClick}
      aria-expanded={selected}
      aria-label={`${ARIA_LABEL[id]}, ${count} cards`}
    >
      <span className={styles.pileLabel}>{LABEL[id]}</span>
      <span className={styles.pileCount}>{String(count).padStart(2, "0")}</span>
      <span className={styles.pileHint}>VIEW ▸</span>
    </button>
  );
}

export function PilesPanel({ drawPile, discardPile, consumedPile, onOpenFull }: Props) {
  const [open, setOpen] = useState<PileId | null>(null);

  const piles: Record<PileId, ReadonlyArray<Card>> = {
    draw: drawPile,
    discard: discardPile,
    consumed: consumedPile,
  };
  const list = open ? piles[open] : [];

  return (
    <Panel title="PILES" asAnchor>
      <div className={styles.grid}>
        <PileButton
          id="draw"
          count={drawPile.length}
          selected={open === "draw"}
          onClick={() => setOpen((p) => (p === "draw" ? null : "draw"))}
        />
        <PileButton
          id="discard"
          count={discardPile.length}
          selected={open === "discard"}
          onClick={() => setOpen((p) => (p === "discard" ? null : "discard"))}
        />
        <PileButton
          id="consumed"
          count={consumedPile.length}
          selected={open === "consumed"}
          onClick={() => setOpen((p) => (p === "consumed" ? null : "consumed"))}
        />
      </div>

      {open && (
        <div
          className={`${styles.popover} ${styles[open]}`}
          role="dialog"
          aria-label={`${LABEL[open]} pile contents`}
        >
          <div className={styles.popoverHeader}>
            <span>
              ▌{LABEL[open]} · {list.length} REC
            </span>
            <span className={styles.popoverActions}>
              {open !== "consumed" && (
                <button
                  type="button"
                  className={styles.expand}
                  onClick={() => onOpenFull(open as "draw" | "discard")}
                >
                  FULL▸
                </button>
              )}
              <button type="button" className={styles.close} onClick={() => setOpen(null)}>
                X
              </button>
            </span>
          </div>
          <div className={styles.popoverList}>
            {list.length === 0 && <div className={styles.popoverEmpty}>// PILE EMPTY</div>}
            {list.map((c, i) => (
              <div key={`${c.id}-${i}`} className={styles.popoverRow}>
                <span>
                  {String(i + 1).padStart(3, "0")} · {c.name.toUpperCase()}
                </span>
                <span className={styles.popoverCost}>{c.cost}E</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}
