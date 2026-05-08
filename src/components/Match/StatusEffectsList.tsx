// Sidebar list of active status effects (boss curses; future player buffs).
//
// Renders one badge per StatusEffect attached to MatchCardState. Each badge
// shows the def's name, either its trigger description (when idle) or a
// concrete "what it's doing right now" line plus an Active pill (when its
// effect is currently constraining gameplay), an optional remaining-fires /
// remaining-turns hint, and a tooltip with the full description. A short
// glow plays the turn it fires; a persistent glow stays on while the effect
// is active.

import type { CardEffect, MatchCardState, StatusEffect, StatusTrigger } from "../../game/types";
import { getStatusEffectById } from "../../game/status/library";

import styles from "./StatusEffectsList.module.css";

type Props = {
  cardState: MatchCardState;
};

export function StatusEffectsList({ cardState }: Props) {
  const { statusEffects, turn } = cardState;
  if (statusEffects.length === 0) return null;
  return (
    <div className={styles.statusBlock}>
      <div className={styles.label}>Status effects</div>
      <ul className={styles.list} aria-label="Active status effects">
        {statusEffects.map((s, i) => {
          const def = safeLookup(s.defId);
          if (!def) return null;
          const flavorClass = def.flavor === "blessing" ? styles.blessing : styles.curse;
          const recentlyFired = s.lastFiredOnTurn === turn;
          const active = isEffectActive(def.effect, cardState);
          const stateLabel = active
            ? describeActiveState(def.effect, cardState)
            : describeStatusTrigger(def.trigger);
          const lifetime = describeLifetime(s);
          const meta = lifetime ? `${stateLabel} · ${lifetime}` : stateLabel;
          const className = [
            styles.item,
            flavorClass,
            active && styles.active,
            recentlyFired && styles.recentlyFired,
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <li
              key={`${s.defId}:${i}`}
              className={className}
              title={def.description}
              aria-label={`${def.name}${active ? " — active" : ""}`}
            >
              <span className={styles.nameRow}>
                <span className={styles.name}>{def.name}</span>
                {active && <span className={styles.activeBadge}>Active</span>}
              </span>
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

function isEffectActive(effect: CardEffect, state: MatchCardState): boolean {
  switch (effect.kind) {
    case "next-move-constraint":
      return state.mustNotCheckNextMove === true;
    case "pending-energy-loss-on-no-capture":
      return state.pendingEnergyLossOnNoCapture === true;
    case "forbid-zero-cost-this-turn":
      return state.noZeroCostCardsThisTurn === true;
    case "boss-extra-move":
      return (state.bossExtraMoves ?? 0) > 0;
    default:
      return false;
  }
}

function describeActiveState(effect: CardEffect, state: MatchCardState): string {
  switch (effect.kind) {
    case "next-move-constraint":
      return "Your next move must not deliver check";
    case "pending-energy-loss-on-no-capture":
      return "Capture this turn or lose energy next turn";
    case "forbid-zero-cost-this-turn":
      return "0-cost cards locked this turn";
    case "boss-extra-move": {
      const n = state.bossExtraMoves ?? 0;
      return n === 1 ? "Boss takes 1 extra move" : `Boss takes ${n} extra moves`;
    }
    default:
      return "Active";
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
