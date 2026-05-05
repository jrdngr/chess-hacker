// Match history — a chronological, JSON-serializable log of every action
// taken during a match. Powers the History modal and its export button so
// players can paste a session log into bug reports.
//
// History events are appended as actions resolve (card plays, chess moves,
// turn rollovers, dev-mode edits). Each entry in the undo stack carries the
// history-as-of-that-snapshot so undo / redo rewind the log alongside the
// engine and card state.

import type { AlgebraicSquare, BoardSize, CardId, PieceType, Side } from "../../game/types";
import type { PlayTarget } from "../../game/cards/match";

export type HistoryEvent =
  | {
      kind: "match-start";
      turn: number;
      fen: string;
      size: BoardSize;
      mode: "local-pvp" | "vs-ai";
    }
  | {
      kind: "turn-start";
      turn: number;
      side: Side;
      fen: string;
      energy: number;
      handIds: CardId[];
    }
  | {
      kind: "card-played";
      turn: number;
      cardId: CardId;
      cardName: string;
      cost: number;
      energyAfter: number;
      target: PlayTarget;
    }
  | {
      kind: "move";
      turn: number;
      by: Side;
      from: AlgebraicSquare;
      to: AlgebraicSquare;
      san: string;
      isCapture: boolean;
      isPromotion: boolean;
      isCastle: boolean;
      promotion?: "q" | "r" | "b" | "n";
      capturedType?: PieceType;
      capturedSide?: Side;
      fenAfter: string;
    }
  | {
      kind: "editor-edit";
      turn: number;
      square: AlgebraicSquare;
      action: "place" | "erase";
      pieceType?: PieceType;
      side?: Side;
    }
  | {
      kind: "energy-bump";
      turn: number;
      delta: number;
      energyAfter: number;
    }
  | {
      kind: "scry-reorder";
      turn: number;
      newTopIds: CardId[];
    };

export type SerializedHistory = {
  version: 1;
  events: HistoryEvent[];
};

export function serializeHistory(events: ReadonlyArray<HistoryEvent>): string {
  const payload: SerializedHistory = { version: 1, events: events.slice() };
  return JSON.stringify(payload, null, 2);
}

/**
 * Plain-English one-liner for an event. Used by the History modal so each
 * row reads as a sentence ("Turn 4 · You played Encrypted on e4").
 */
export function describeEvent(ev: HistoryEvent): string {
  switch (ev.kind) {
    case "match-start":
      return `Match start (${ev.size.files}×${ev.size.ranks}, ${ev.mode})`;
    case "turn-start": {
      const who = ev.side === "player" ? "Your" : "Opponent's";
      return `Turn ${ev.turn} · ${who} turn — energy ${ev.energy}, hand ${ev.handIds.length}`;
    }
    case "card-played": {
      const t = ev.target;
      let where = "";
      if (t.kind === "square") where = ` on ${t.square}`;
      else if (t.kind === "two-squares") where = ` on ${t.first} → ${t.second}`;
      return `Turn ${ev.turn} · Played ${ev.cardName}${where} (cost ${ev.cost}, energy ${ev.energyAfter} left)`;
    }
    case "move": {
      const who = ev.by === "player" ? "You" : "Opponent";
      const cap = ev.isCapture
        ? ` capturing ${ev.capturedSide === "player" ? "your" : "their"} ${ev.capturedType ?? "piece"}`
        : "";
      return `Turn ${ev.turn} · ${who} moved ${ev.san} (${ev.from}→${ev.to})${cap}`;
    }
    case "editor-edit":
      if (ev.action === "erase") return `Turn ${ev.turn} · Editor erased ${ev.square}`;
      return `Turn ${ev.turn} · Editor placed ${ev.side ?? ""} ${ev.pieceType ?? ""} on ${ev.square}`;
    case "energy-bump":
      return `Turn ${ev.turn} · Energy ${ev.delta >= 0 ? "+" : ""}${ev.delta} (now ${ev.energyAfter})`;
    case "scry-reorder":
      return `Turn ${ev.turn} · Reordered top of deck (${ev.newTopIds.length} cards)`;
  }
}
