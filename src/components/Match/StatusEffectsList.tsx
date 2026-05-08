// Sidebar list of active status effects (boss curses; future player buffs).
//
// Renders one badge per active StatusEffect on MatchCardState. Each badge
// shows the def's name, a one-liner trigger description, an optional
// remaining-fires / remaining-turns hint, and a tooltip with the full
// description. Hidden when the list is empty (mirrors the zone-buff block).

import type { StatusEffect, StatusTrigger } from "../../game/types";
import { getStatusEffectById } from "../../game/status/library";

import styles from "./StatusEffectsList.module.css";

type Props = {
  statusEffects: ReadonlyArray<StatusEffect>;
  /** Current player turn — used to fire the brief "just fired" glow. */
  currentTurn: number;
};

export function StatusEffectsList({ statusEffects, currentTurn }: Props) {
  if (statusEffects.length === 0) return null;
  return (
    <div className={styles.statusBlock}>
      <div className={styles.label}>Status effects</div>
      <ul className={styles.list} aria-label="Active status effects">
        {statusEffects.map((s, i) => {
          const def = safeLookup(s.defId);
          if (!def) return null;
          const flavorClass = def.flavor === "blessing" ? styles.blessing : styles.curse;
          const recentlyFired = s.lastFiredOnTurn === currentTurn;
          const triggerLabel = describeStatusTrigger(def.trigger);
          const lifetime = describeLifetime(s);
          const meta = lifetime ? `${triggerLabel} · ${lifetime}` : triggerLabel;
          return (
            <li
              key={`${s.defId}:${i}`}
              className={[styles.item, flavorClass, recentlyFired && styles.recentlyFired]
                .filter(Boolean)
                .join(" ")}
              title={def.description}
            >
              <span className={styles.name}>{def.name}</span>
              <span className={styles.meta}>{meta}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function safeLookup(id: string) {
  try {
    return getStatusEffectById(id);
  } catch {
    return null;
  }
}

function describeStatusTrigger(t: StatusTrigger): string {
  switch (t.kind) {
    case "turn-start":
      return "Each turn";
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

function describeLifetime(s: StatusEffect): string | null {
  if (s.remainingTriggers !== undefined) {
    return `${s.remainingTriggers} fire${s.remainingTriggers === 1 ? "" : "s"} left`;
  }
  if (s.expiresOnTurn !== undefined) {
    return `expires turn ${s.expiresOnTurn}`;
  }
  return null;
}
