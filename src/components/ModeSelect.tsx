import type { RunMode } from "../game/types";
import styles from "./ModeSelect.module.css";

type Props = {
  onSelect: (mode: RunMode) => void;
};

export function ModeSelect({ onSelect }: Props) {
  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Choose a mode</h2>
      <div className={styles.modes}>
        <button type="button" className={styles.modeButton} onClick={() => onSelect("standard")}>
          <span className={styles.modeName}>Standard</span>
          <span className={styles.modeDesc}>
            Both sides start each match with a set army that grows across the run. Board scales from
            6x6 to 8x8 across three acts. No piece drafting.
          </span>
        </button>

        <button type="button" className={styles.modeButton} onClick={() => onSelect("skirmish")}>
          <span className={styles.modeName}>Skirmish</span>
          <span className={styles.modeDesc}>
            Start with a tiny army and draft new pieces between matches. Place your own back rank
            before each fight. The enemy mirrors your composition.
          </span>
        </button>

        <button type="button" className={styles.modeButton} disabled>
          <span className={styles.modeName}>Royal</span>
          <span className={styles.modeDesc}>
            Full 16-piece chess armies every match. Chess960 starting positions.
          </span>
          <span className={styles.modeTag}>Coming soon</span>
        </button>
      </div>
    </div>
  );
}
