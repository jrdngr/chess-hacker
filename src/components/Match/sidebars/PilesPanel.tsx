// PILES panel — 3-column DRAW / DISC / CONS grid. Clicking a pile opens
// the full PileInspector modal directly.

import type { Card } from "../../../game/types";

import { Panel } from "./Panel";
import styles from "./PilesPanel.module.css";

type PileId = "draw" | "discard" | "consumed";

type Props = {
  drawPile: ReadonlyArray<Card>;
  discardPile: ReadonlyArray<Card>;
  consumedPile: ReadonlyArray<Card>;
  /** Open today's PileInspector modal (full card art, hint, etc.). */
  onOpenFull: (kind: PileId) => void;
};

const LABEL: Record<PileId, string> = { draw: "DRAW", discard: "DISC", consumed: "CONS" };
const ARIA_LABEL: Record<PileId, string> = {
  draw: "Draw pile",
  discard: "Discard pile",
  consumed: "Consumed pile",
};

function PileButton({ id, count, onClick }: { id: PileId; count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`${styles.pile} ${styles[id]}`}
      onClick={onClick}
      aria-label={`${ARIA_LABEL[id]}, ${count} cards`}
    >
      <span className={styles.pileLabel}>{LABEL[id]}</span>
      <span className={styles.pileCount}>{String(count).padStart(2, "0")}</span>
      <span className={styles.pileHint}>VIEW ▸</span>
    </button>
  );
}

export function PilesPanel({ drawPile, discardPile, consumedPile, onOpenFull }: Props) {
  return (
    <Panel title="PILES">
      <div className={styles.grid}>
        <PileButton id="draw" count={drawPile.length} onClick={() => onOpenFull("draw")} />
        <PileButton id="discard" count={discardPile.length} onClick={() => onOpenFull("discard")} />
        <PileButton
          id="consumed"
          count={consumedPile.length}
          onClick={() => onOpenFull("consumed")}
        />
      </div>
    </Panel>
  );
}
