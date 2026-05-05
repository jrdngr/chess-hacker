// Curse-AI scheduler. Pure logic. The boss has no deck — instead, on
// specific triggers (turn N, on player check, on capture, every N turns) it
// inserts a curse card into the player's hand. Per docs/design/bosses.md:
// "The boss may insert curses at most once per turn to prevent unfair
// pile-ons."
//
// The scheduler is event-driven. The Match shell fires events at the
// matching points (turn-start, player-check, player-capture) and the
// scheduler returns the curse card ids to inject.

import type { CardId, CurseScheduleEntry, CurseTrigger } from "../types";

/**
 * Per-match scheduler state. Tracks which trigger entries have already
 * fired, plus the most recent player-turn a curse landed (the once-per-turn
 * cap).
 */
export type SchedulerState = {
  /** Indexes of `every-n-turns` / `turn` entries that have fired this match. */
  firedOnce: ReadonlySet<number>;
  /** Player-turn number on which a curse was last inserted (null if none). */
  lastInsertedTurn: number | null;
};

export function makeSchedulerState(): SchedulerState {
  return { firedOnce: new Set(), lastInsertedTurn: null };
}

/** Match-level events the scheduler reacts to. */
export type SchedulerEvent =
  /** Start of a new player turn — the natural spot for `turn` / `every-n-turns`. */
  | { kind: "turn-start"; turn: number }
  /** Player chess move that put the boss in check. */
  | { kind: "player-check"; turn: number }
  /** Player chess move that captured a boss piece. */
  | { kind: "player-capture"; turn: number };

export type SchedulerResult = {
  /** Curse card ids to insert into the player's hand, in order. */
  curseIds: CardId[];
  next: SchedulerState;
};

/**
 * Decide which curse(s) fire for `event`. Pure: the caller materialises card
 * objects via `getCardById` and inserts them into hand. Returns the next
 * scheduler state with `firedOnce` / `lastInsertedTurn` advanced.
 *
 * Rules:
 *  - At most one curse per player turn — once a curse has fired this turn,
 *    further triggers on the same turn are silently dropped.
 *  - `turn`-trigger entries fire once at the start of their target turn.
 *  - `every-n-turns` fires at the start of turns matching `turn % n === 0`
 *    (so n=4 → turns 4, 8, 12, …).
 *  - `on-player-check` and `on-player-capture` fire on the matching event.
 *  - When multiple entries match the same event, only the first is taken
 *    (to keep the once-per-turn cap simple).
 */
export function fireCurses(
  schedule: ReadonlyArray<CurseScheduleEntry>,
  state: SchedulerState,
  event: SchedulerEvent,
): SchedulerResult {
  if (state.lastInsertedTurn === event.turn) {
    return { curseIds: [], next: state };
  }
  for (let i = 0; i < schedule.length; i++) {
    const entry = schedule[i];
    if (!matchesTrigger(entry.trigger, event, state, i)) continue;
    const firedOnce = new Set(state.firedOnce);
    if (entry.trigger.kind === "turn") firedOnce.add(i);
    return {
      curseIds: [entry.curseId],
      next: { firedOnce, lastInsertedTurn: event.turn },
    };
  }
  return { curseIds: [], next: state };
}

function matchesTrigger(
  trigger: CurseTrigger,
  event: SchedulerEvent,
  state: SchedulerState,
  index: number,
): boolean {
  switch (trigger.kind) {
    case "turn":
      if (event.kind !== "turn-start") return false;
      if (state.firedOnce.has(index)) return false;
      return event.turn === trigger.turn;
    case "every-n-turns":
      if (event.kind !== "turn-start") return false;
      if (trigger.n <= 0) return false;
      return event.turn > 0 && event.turn % trigger.n === 0;
    case "on-player-check":
      return event.kind === "player-check";
    case "on-player-capture":
      return event.kind === "player-capture";
  }
}
