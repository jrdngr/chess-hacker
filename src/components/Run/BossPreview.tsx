// Boss-preview screen — shown at act start so the player knows what's
// coming. Per docs/design/bosses.md: name, signature mechanic, curse pool.
//
// Surfaces the modifier rule, the hazard list, and one row per scheduled
// curse with its trigger and (looked-up) description so the player can plan
// shopping and drafting around the encounter.

import type { BossDef, CurseTrigger } from "../../game/types";
import { getCardById } from "../../game/cards/library";

import styles from "./BossPreview.module.css";

type Props = {
  boss: BossDef;
  onContinue: () => void;
};

export function BossPreview({ boss, onContinue }: Props) {
  return (
    <section className={styles.preview} aria-label="Boss preview">
      <header className={styles.header}>
        <span className={styles.tag}>Coming this act</span>
        <h2 className={styles.title}>{boss.name}</h2>
        <p className={styles.subtitle}>{boss.description}</p>
      </header>

      <dl className={styles.specs}>
        <div className={styles.spec}>
          <dt>Modifier</dt>
          <dd>{boss.modifierDescription}</dd>
        </div>

        {boss.hazardWalls.length > 0 && (
          <div className={styles.spec}>
            <dt>Hazards</dt>
            <dd>Indestructible walls on {boss.hazardWalls.join(", ")}.</dd>
          </div>
        )}

        <div className={styles.spec}>
          <dt>Curses</dt>
          <dd>
            {boss.curses.length === 0 ? (
              <em className={styles.muted}>None.</em>
            ) : (
              <ul className={styles.curseList}>
                {boss.curses.map((c, i) => {
                  const card = safeLookupCurse(c.curseId);
                  return (
                    <li key={`${c.curseId}-${i}`} className={styles.curse}>
                      <span className={styles.curseTrigger}>{describeTrigger(c.trigger)}</span>
                      <span className={styles.curseName}>{card?.name ?? c.curseId}</span>
                      {card && <span className={styles.curseDesc}>{card.description}</span>}
                    </li>
                  );
                })}
              </ul>
            )}
          </dd>
        </div>
      </dl>

      <button type="button" className={styles.continue} onClick={onContinue}>
        Continue
      </button>
    </section>
  );
}

function describeTrigger(t: CurseTrigger): string {
  switch (t.kind) {
    case "turn":
      return `Turn ${t.turn}`;
    case "every-n-turns":
      return `Every ${t.n} turns`;
    case "on-player-check":
      return "When you check";
    case "on-player-capture":
      return "When you capture";
  }
}

function safeLookupCurse(id: string) {
  try {
    return getCardById(id);
  } catch {
    return null;
  }
}
