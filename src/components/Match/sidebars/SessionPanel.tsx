// SESSION panel — turn (hex) / ply / to-move / opponent / dashed sep /
// gold / interest / energy bar.

import type { ReactNode } from "react";

import { effectiveEnergyPerTurn } from "../../../game/artifacts/effects";
import { activeZoneBuffs, zoneBuffEnergyPerTurn } from "../../../game/overlays/zoneBuffs";
import type { Artifact, BossDef, MatchCardState, Side } from "../../../game/types";
import type { ZoneBoardContext } from "../../../game/overlays/zoneBuffs";
import { Panel } from "./Panel";
import styles from "./SessionPanel.module.css";

type Props = {
  cardState: MatchCardState;
  artifacts: ReadonlyArray<Artifact>;
  /** Whose turn is it (chess engine.turn()). */
  toMove: Side;
  /** True if AI is mid-think — overrides toMove display. */
  aiThinking?: boolean;
  /** Optional active boss — populates OPPONENT row. */
  boss?: BossDef | null;
  /** Run gold + last interest. Both omitted when out-of-run (tests). */
  gold?: number;
  interest?: number;
  /** Required for zone-buff energy bonus. */
  zoneCtx?: ZoneBoardContext;
};

function Stat({
  label,
  value,
  emphasis,
}: {
  label: ReactNode;
  value: ReactNode;
  emphasis?: "player" | "opp" | "dim";
}) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <span
        className={`${styles.statValue} ${
          emphasis === "player"
            ? styles.player
            : emphasis === "opp"
              ? styles.opp
              : emphasis === "dim"
                ? styles.dim
                : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}

export function SessionPanel({
  cardState,
  artifacts,
  toMove,
  aiThinking,
  boss,
  gold,
  interest,
  zoneCtx,
}: Props) {
  const turn = cardState.turn;
  const ply = Math.max(1, turn * 2 - 1);

  const baseEnergyMax = effectiveEnergyPerTurn(artifacts);
  const zoneBonus = zoneCtx
    ? zoneBuffEnergyPerTurn(activeZoneBuffs(cardState.zoneBuffs ?? [], zoneCtx))
    : 0;
  // Effective per-turn refill. Mid-turn boosts (Cache Warmup, etc.) can push
  // the live energy past this; render whichever is higher so the bar still
  // fills correctly.
  const computedMax = baseEnergyMax + zoneBonus;
  const energyMax = Math.max(cardState.energy, computedMax);

  return (
    <Panel title="SESSION">
      <Stat label="TURN" value={`0x${turn.toString(16).padStart(2, "0").toUpperCase()}`} />
      <Stat label="PLY" value={ply} />
      <Stat
        label="TO MOVE"
        value={aiThinking ? "AI…" : toMove === "player" ? "USR" : "OPP"}
        emphasis={aiThinking ? "dim" : toMove === "player" ? "player" : "opp"}
      />
      <Stat
        label="OPPONENT"
        value={boss ? boss.name.toUpperCase() : "STOCKFISH"}
        emphasis={boss ? "opp" : "dim"}
      />

      {(gold !== undefined || interest !== undefined) && (
        <>
          <hr className={styles.dash} />
          {gold !== undefined && <Stat label="GOLD" value={gold} />}
          {interest !== undefined && interest > 0 && (
            <Stat label="INT" value={`+${interest}`} emphasis="dim" />
          )}
        </>
      )}

      <hr className={styles.dash} />
      <div className={styles.energyHeader} aria-label={`Energy: ${cardState.energy}`}>
        <span className={styles.statLabel}>ENERGY</span>
        <span className={styles.energyValue}>
          {cardState.energy}/{energyMax}
        </span>
      </div>
      <div className={styles.energyBar}>
        {Array.from({ length: Math.max(1, energyMax) }).map((_, i) => (
          <span
            key={i}
            className={`${styles.energySeg} ${i < cardState.energy ? styles.energyLit : ""}`}
          />
        ))}
      </div>
    </Panel>
  );
}
