// MOVE LOG panel — always-visible compact stream of HistoryEvents.
// EXPORT▸ button mounts today's HistoryModal so JSON export still works.

import type { PieceType } from "../../../game/types";
import type { HistoryEvent } from "../history";

import { Panel } from "./Panel";
import styles from "./MoveLogPanel.module.css";

type Props = {
  events: ReadonlyArray<HistoryEvent>;
  onExport?: () => void;
};

const PIECE_LETTER: Record<PieceType, string> = {
  king: "K",
  queen: "Q",
  rook: "R",
  bishop: "B",
  knight: "N",
  pawn: "P",
};

type Row = {
  turn: number;
  side: "USR" | "OPP" | "—" | "EDIT";
  text: string;
  tag: string;
  tagTone: "primary" | "opp" | "dim";
};

function eventToRow(ev: HistoryEvent): Row | null {
  switch (ev.kind) {
    case "match-start":
      return { turn: 1, side: "—", text: "MATCH START", tag: "INIT", tagTone: "dim" };
    case "move": {
      const side = ev.by === "player" ? "USR" : "OPP";
      const text = ev.san.toUpperCase();
      let tag = "MOVE";
      let tagTone: Row["tagTone"] = "primary";
      if (ev.isCapture) {
        tag = `CAPTURE_${PIECE_LETTER[ev.capturedType ?? "pawn"] ?? "P"}`;
        tagTone = "opp";
      } else if (ev.san.includes("+")) {
        tag = "CHECK";
        tagTone = "opp";
      } else if (ev.san.includes("#")) {
        tag = "MATE";
        tagTone = "opp";
      } else if (ev.isCastle) {
        tag = "CASTLE";
      } else if (ev.isPromotion) {
        tag = "PROMO";
      }
      return { turn: ev.turn, side, text, tag, tagTone };
    }
    case "card-played": {
      const where =
        ev.target.kind === "square"
          ? `→${ev.target.square.toUpperCase()}`
          : ev.target.kind === "two-squares"
            ? `→${ev.target.first.toUpperCase()}/${ev.target.second.toUpperCase()}`
            : "";
      return {
        turn: ev.turn,
        side: "USR",
        text: `${ev.cardName.toUpperCase()}${where}`,
        tag: `CARD/${ev.cost}E`,
        tagTone: "primary",
      };
    }
    case "scry-reorder":
      return {
        turn: ev.turn,
        side: "USR",
        text: "DECK REORDER",
        tag: "SCRY",
        tagTone: "primary",
      };
    case "energy-bump":
      return {
        turn: ev.turn,
        side: "—",
        text: `ENERGY ${ev.delta >= 0 ? "+" : ""}${ev.delta}`,
        tag: "DEV",
        tagTone: "dim",
      };
    case "editor-edit":
      return {
        turn: ev.turn,
        side: "EDIT",
        text:
          ev.action === "erase"
            ? `ERASE ${ev.square.toUpperCase()}`
            : `PLACE ${(ev.side ?? "?")[0].toUpperCase()}${(ev.pieceType ?? "?")[0].toUpperCase()} ${ev.square.toUpperCase()}`,
        tag: "EDIT",
        tagTone: "dim",
      };
    case "turn-start":
      // Skipped — the leading T### header conveys this.
      return null;
  }
}

export function MoveLogPanel({ events, onExport }: Props) {
  // Newest-first.
  const rows: Row[] = [];
  for (let i = events.length - 1; i >= 0; i--) {
    const r = eventToRow(events[i]);
    if (r) rows.push(r);
  }
  const ticker = onExport ? (
    <button type="button" className={styles.exportBtn} onClick={onExport}>
      EXPORT▸
    </button>
  ) : undefined;
  return (
    <Panel title="MOVE LOG" ticker={ticker} className={styles.panel}>
      <div className={styles.list}>
        {rows.length === 0 && <div className={styles.empty}>// NO EVENTS</div>}
        {rows.map((r, i) => (
          <div key={i} className={styles.row}>
            <span className={styles.turnCell}>T{String(r.turn).padStart(3, "0")}</span>
            <span
              className={`${styles.sideCell} ${
                r.side === "OPP"
                  ? styles.opp
                  : r.side === "USR"
                    ? styles.player
                    : r.side === "EDIT"
                      ? styles.dim
                      : styles.dim
              }`}
            >
              {r.side}
            </span>
            <span className={styles.textCell}>{r.text}</span>
            <span
              className={`${styles.tagCell} ${
                r.tagTone === "opp" ? styles.opp : r.tagTone === "dim" ? styles.dim : styles.primary
              }`}
            >
              {r.tag}
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}
