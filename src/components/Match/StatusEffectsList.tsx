// Sidebar list of active status effects (boss curses; future player buffs)
// plus optional zone-buff overlays. Renders nothing when both lists are
// empty. The panel takes a red accent when at least one curse is active so
// the player notices the constraint at a glance.

import type {
  CardEffect,
  MatchCardState,
  StatusEffect,
  StatusTrigger,
  ZoneBuff,
} from "../../game/types";
import { getStatusEffectById } from "../../game/status/library";

import { Panel } from "./sidebars/Panel";
import styles from "./StatusEffectsList.module.css";

type Props = {
  cardState: MatchCardState;
  /** Zone buffs to surface alongside status effects. Pass [] to omit. */
  zoneBuffs?: ReadonlyArray<ZoneBuff>;
  /** Subset of `zoneBuffs` that are currently active (controlled by the player). */
  activeBuffs?: ReadonlyArray<ZoneBuff>;
};

export function StatusEffectsList({ cardState, zoneBuffs, activeBuffs }: Props) {
  const { statusEffects, turn } = cardState;
  const buffs = zoneBuffs ?? [];
  if (statusEffects.length === 0 && buffs.length === 0) return null;

  // Panel accent: red if any curse is present, amber otherwise. Title varies
  // to match — CURSE if a hostile status is active, STATUS for blessings/buffs.
  const hasCurse = statusEffects.some((s) => safeLookup(s.defId)?.flavor !== "blessing");
  const accentVar = hasCurse ? "--p-opp" : "--p-primary";
  const title = hasCurse ? "CURSE" : "STATUS";

  return (
    <Panel title={title} accentVar={accentVar}>
      {statusEffects.length > 0 && (
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
      )}

      {buffs.length > 0 && (
        <>
          {statusEffects.length > 0 && <div className={styles.subheader}>BUFFS</div>}
          <ul className={styles.list} aria-label="Active zone buffs">
            {buffs.map((b, i) => {
              const isActive = activeBuffs?.includes(b) ?? false;
              const remaining =
                b.expiresOnTurn === undefined
                  ? null
                  : Math.max(0, b.expiresOnTurn - cardState.turn);
              const className = [styles.item, styles.buff, isActive && styles.active]
                .filter(Boolean)
                .join(" ");
              const effect =
                b.effect.kind === "energy-per-turn"
                  ? `+${b.effect.amount} energy/turn`
                  : `+${b.effect.amount} hand size`;
              const meta = remaining !== null ? `${effect} · ${remaining}T` : effect;
              return (
                <li
                  key={`${b.sourceLabel}:${i}`}
                  className={className}
                  aria-label={`${b.sourceLabel} — ${effect}`}
                >
                  <span className={styles.nameRow}>
                    <span className={styles.name}>{b.sourceLabel}</span>
                    {isActive && <span className={styles.activeBadge}>Active</span>}
                  </span>
                  <span className={styles.meta}>{meta}</span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Panel>
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
      return "Next move must not deliver check";
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
