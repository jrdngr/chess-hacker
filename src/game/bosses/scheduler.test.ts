import { describe, expect, it } from "vitest";

import { fireCurses, makeSchedulerState } from "./scheduler";
import type { CurseScheduleEntry } from "../types";

describe("curse scheduler", () => {
  it("fires `on-player-check` triggers exactly once per check event", () => {
    const schedule: CurseScheduleEntry[] = [
      { trigger: { kind: "on-player-check" }, curseId: "stalwart" },
    ];
    const a = fireCurses(schedule, makeSchedulerState(), { kind: "player-check", turn: 2 });
    expect(a.curseIds).toEqual(["stalwart"]);

    // Same turn — once-per-turn cap blocks a second insertion.
    const b = fireCurses(schedule, a.next, { kind: "player-check", turn: 2 });
    expect(b.curseIds).toEqual([]);

    // New turn — fires again.
    const c = fireCurses(schedule, b.next, { kind: "player-check", turn: 3 });
    expect(c.curseIds).toEqual(["stalwart"]);
  });

  it("`turn` triggers fire only on their target turn and only once per match", () => {
    const schedule: CurseScheduleEntry[] = [
      { trigger: { kind: "turn", turn: 1 }, curseId: "final-resolve" },
    ];
    let s = makeSchedulerState();

    const t0 = fireCurses(schedule, s, { kind: "turn-start", turn: 1 });
    expect(t0.curseIds).toEqual(["final-resolve"]);
    s = t0.next;

    // Same turn, capped (would be redundant anyway since we already fired).
    const t0b = fireCurses(schedule, s, { kind: "turn-start", turn: 1 });
    expect(t0b.curseIds).toEqual([]);

    // Subsequent turns must not refire — the entry is one-shot.
    s = t0b.next;
    const t1 = fireCurses(schedule, s, { kind: "turn-start", turn: 2 });
    expect(t1.curseIds).toEqual([]);
  });

  it("`every-n-turns` fires on multiples of n only", () => {
    const schedule: CurseScheduleEntry[] = [
      { trigger: { kind: "every-n-turns", n: 4 }, curseId: "greed" },
    ];
    let s = makeSchedulerState();
    for (let turn = 1; turn <= 8; turn++) {
      const r = fireCurses(schedule, s, { kind: "turn-start", turn });
      s = r.next;
      if (turn === 4 || turn === 8) {
        expect(r.curseIds).toEqual(["greed"]);
      } else {
        expect(r.curseIds).toEqual([]);
      }
    }
  });

  it("once-per-turn cap blocks check curse when a turn-start curse already fired", () => {
    const schedule: CurseScheduleEntry[] = [
      { trigger: { kind: "every-n-turns", n: 1 }, curseId: "greed" },
      { trigger: { kind: "on-player-check" }, curseId: "stalwart" },
    ];
    let s = makeSchedulerState();
    const a = fireCurses(schedule, s, { kind: "turn-start", turn: 1 });
    expect(a.curseIds).toEqual(["greed"]);
    s = a.next;
    const b = fireCurses(schedule, s, { kind: "player-check", turn: 1 });
    expect(b.curseIds).toEqual([]);
  });

  it("does not fire on unrelated event kinds", () => {
    const schedule: CurseScheduleEntry[] = [
      { trigger: { kind: "on-player-capture" }, curseId: "x" },
    ];
    const r = fireCurses(schedule, makeSchedulerState(), { kind: "player-check", turn: 1 });
    expect(r.curseIds).toEqual([]);
  });
});
