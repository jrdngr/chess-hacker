// Boss-preview screen — shown at act start so the player knows what's
// coming. Per docs/design/bosses.md: name, signature mechanic, status-effect
// pool.
//
// Surfaces the modifier rule, the hazard list, and one row per status effect
// with its trigger and description so the player can plan shopping and
// drafting around the encounter.

import type { BossDef, StatusTrigger } from "../../game/types";
import { getStatusEffectById } from "../../game/status/library";

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

        {(boss.hazardWalls.length > 0 ||
          (boss.voidSquares && boss.voidSquares.length > 0) ||
          (boss.zoneBuffs && boss.zoneBuffs.length > 0)) && (
          <div className={styles.spec}>
            <dt>Hazards</dt>
            <dd>{describeHazards(boss)}</dd>
          </div>
        )}

        <div className={styles.spec}>
          <dt>Status effects</dt>
          <dd>
            {boss.statusEffects.length === 0 ? (
              <em className={styles.muted}>None.</em>
            ) : (
              <ul className={styles.curseList}>
                {boss.statusEffects.map((id, i) => {
                  const def = safeLookupStatus(id);
                  return (
                    <li key={`${id}-${i}`} className={styles.curse}>
                      <span className={styles.curseTrigger}>
                        {def ? describeStatusTrigger(def.trigger) : ""}
                      </span>
                      <span className={styles.curseName}>{def?.name ?? id}</span>
                      {def && <span className={styles.curseDesc}>{def.description}</span>}
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

function describeHazards(boss: BossDef): string {
  const parts: string[] = [];
  if (boss.hazardWalls.length > 0) {
    parts.push(`Indestructible walls on ${boss.hazardWalls.join(", ")}.`);
  }
  if (boss.voidSquares && boss.voidSquares.length > 0) {
    parts.push(`Void at ${boss.voidSquares.join(", ")} (any piece ending there is destroyed).`);
  }
  if (boss.zoneBuffs && boss.zoneBuffs.length > 0) {
    for (const b of boss.zoneBuffs) {
      const where =
        b.region.kind === "rank"
          ? `rank ${b.region.rank}`
          : b.region.kind === "center"
            ? "the center"
            : b.region.anchor;
      const fx =
        b.buff.kind === "energy-per-turn"
          ? `+${b.buff.amount} energy/turn`
          : `+${b.buff.amount} hand size`;
      parts.push(`Boss-side zone-buff at ${where}: ${fx} while contested.`);
    }
  }
  return parts.join(" ");
}

function describeStatusTrigger(t: StatusTrigger): string {
  switch (t.kind) {
    case "turn-start":
      return "Turn start";
    case "every-n-turns":
      return `Every ${t.n} turns`;
    case "on-self-check":
      return "When you check";
    case "on-self-capture":
      return "When you capture";
    case "on-opponent-capture":
      return "When the boss captures";
    case "on-self-pawn-move":
      return "When you move a pawn";
  }
}

function safeLookupStatus(id: string) {
  try {
    return getStatusEffectById(id);
  } catch {
    return null;
  }
}
