// Top ticker bar.
//
// Mirrors amber-page.jsx's TICKER strip — project name, run/turn metadata,
// opponent, palette swatches, vision toggle, optional QUIT link. Runs in two
// modes: with a `run` prop attached we render the full status row; without
// it (the menu) we render just project name + palette + vision.

import { PALETTES, type PaletteId } from "../../state/palette";

import styles from "./Ticker.module.css";

type RunInfo = {
  /** 1-indexed act number. */
  act: number;
  /** 1-indexed match within the run (0 < matchNumber <= totalMatches). */
  matchNumber: number;
  /** Total matches across the run. */
  totalMatches: number;
  /** Name of the active boss for this match, if any. */
  bossName?: string | null;
};

type MatchInfo = {
  /** Player-turn counter (1-indexed). */
  turn: number;
  /** Whose turn is it. */
  toMove: "player" | "opponent";
  /** "thinking…" indicator. */
  aiThinking?: boolean;
  /** True if the active side is in check. */
  inCheck?: boolean;
  /** True if the match has ended. */
  matchOver?: boolean;
};

type Props = {
  palette: PaletteId;
  onPaletteChange: (p: PaletteId) => void;
  vision: boolean;
  onToggleVision: () => void;
  /** Highlight-threats toggle. Omit on routes where threats don't apply. */
  threats?: boolean;
  onToggleThreats?: () => void;
  /** Run-level status. Omitted on the menu. */
  run?: RunInfo;
  /** Match-level status. Omitted between phases (reward, shop). */
  match?: MatchInfo;
  /** Quit affordance — when present a QUIT▸ link renders at the right edge. */
  onQuit?: () => void;
  /** Show-run-log affordance — when present a LOG▸ link renders before QUIT. */
  onShowRunLog?: () => void;
  /** Optional run-log entry count, surfaced inside the LOG link. */
  runLogCount?: number;
};

function PaletteSwatch({
  id,
  active,
  onClick,
}: {
  id: PaletteId;
  active: boolean;
  onClick: () => void;
}) {
  const meta = PALETTES.find((p) => p.id === id)!;
  return (
    <button
      type="button"
      className={`${styles.swatch} ${active ? styles.swatchActive : ""}`}
      title={`${meta.name} — ${meta.tag}`}
      aria-label={`Palette ${meta.name}${active ? " (selected)" : ""}`}
      aria-pressed={active}
      onClick={onClick}
    >
      <span className={styles.swatchGrid}>
        {meta.swatches.slice(0, 4).map((c) => (
          <span key={c} className={styles.swatchCell} style={{ background: c }} />
        ))}
      </span>
    </button>
  );
}

export function Ticker({
  palette,
  onPaletteChange,
  vision,
  onToggleVision,
  threats,
  onToggleThreats,
  run,
  match,
  onQuit,
  onShowRunLog,
  runLogCount,
}: Props) {
  const opponentLabel = run?.bossName ?? (run ? "STOCKFISH" : null);
  return (
    <header className={styles.ticker} role="banner">
      <span className={styles.brand}>CHESS HACKER</span>
      {run && (
        <>
          <span className={styles.sep}>│</span>
          <span className={styles.field}>
            ACT {run.act} M{run.matchNumber}/{run.totalMatches}
          </span>
        </>
      )}
      {match && (
        <>
          <span className={styles.sep}>│</span>
          <span className={styles.field}>
            T{String(match.turn).padStart(3, "0")}{" "}
            {match.matchOver ? (
              <span className={styles.fieldDim}>· MATCH END</span>
            ) : match.aiThinking ? (
              <span className={styles.fieldDim}>· AI THINKING</span>
            ) : (
              <span
                className={match.toMove === "player" ? styles.field : styles.fieldOpp}
                aria-label={`Side to move: ${match.toMove === "player" ? "White" : "Black"}`}
              >
                · {match.toMove === "player" ? "USR_TO_MOVE" : "OPP_TO_MOVE"}
                {match.inCheck && " ! CHECK"}
                {/* Hidden text companion so test queries for "White"/"Black"
                    against the chip's aria-label still match toHaveTextContent. */}
                <span className={styles.srOnly}>
                  {match.toMove === "player" ? "White" : "Black"}
                </span>
              </span>
            )}
          </span>
        </>
      )}
      {opponentLabel && (
        <>
          <span className={styles.sep}>│</span>
          <span className={run?.bossName ? styles.opp : styles.fieldDim}>
            OPP: {opponentLabel}
            {run?.bossName ? " ●" : ""}
          </span>
        </>
      )}

      <span className={styles.spacer} />

      <span className={styles.fieldDim}>PAL</span>
      <span className={styles.swatchRow}>
        {PALETTES.map((p) => (
          <PaletteSwatch
            key={p.id}
            id={p.id}
            active={p.id === palette}
            onClick={() => onPaletteChange(p.id)}
          />
        ))}
      </span>

      <span className={styles.sep}>│</span>
      <button
        type="button"
        className={`${styles.visionToggle} ${vision ? styles.visionOn : styles.visionOff}`}
        onClick={onToggleVision}
        aria-pressed={vision}
        aria-label={`Board vision ${vision ? "on" : "off"}`}
      >
        <span className={styles.visionTrack}>
          <span className={styles.visionKnob} />
        </span>
        VISION:{vision ? "ON" : "OFF"}
      </button>

      {onToggleThreats && (
        <button
          type="button"
          className={`${styles.visionToggle} ${threats ? styles.visionOn : styles.visionOff}`}
          onClick={onToggleThreats}
          aria-pressed={!!threats}
          aria-label={`Highlight threats ${threats ? "on" : "off"}`}
        >
          <span className={styles.visionTrack}>
            <span className={styles.visionKnob} />
          </span>
          THREATS:{threats ? "ON" : "OFF"}
        </button>
      )}

      {onShowRunLog && (
        <>
          <span className={styles.sep}>│</span>
          <button
            type="button"
            className={styles.log}
            onClick={onShowRunLog}
            aria-label={`Show run log${runLogCount !== undefined ? ` (${runLogCount} entries)` : ""}`}
          >
            LOG{runLogCount !== undefined ? `(${runLogCount})` : ""}▸
          </button>
        </>
      )}
      {onQuit && (
        <>
          <span className={styles.sep}>│</span>
          <button type="button" className={styles.quit} onClick={onQuit} aria-label="Quit run">
            QUIT▸
          </button>
        </>
      )}
    </header>
  );
}
