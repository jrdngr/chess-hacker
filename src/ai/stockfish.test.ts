// Stockfish wrapper unit tests.
//
// We don't load the real Stockfish worker in tests (jsdom can't run it).
// Instead we stub the global Worker with a hand-driven fake that the test
// can poke to simulate UCI replies.

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  StockfishEngine,
  depthForDifficulty,
  legalMoveToUci,
  uciToMove,
  variantFor,
} from "./stockfish";
import type { LegalMove } from "../game/chess/engine";

class FakeWorker {
  static instances: FakeWorker[] = [];

  url: string;
  posted: string[] = [];
  onmessage: ((e: MessageEvent<string>) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  terminated = false;

  constructor(url: string) {
    this.url = url;
    FakeWorker.instances.push(this);
  }

  postMessage(cmd: string) {
    this.posted.push(cmd);
  }

  terminate() {
    this.terminated = true;
  }

  // helper used by tests to inject UCI lines from the "engine"
  emit(line: string) {
    this.onmessage?.({ data: line } as MessageEvent<string>);
  }
}

beforeEach(() => {
  FakeWorker.instances = [];
  // @ts-expect-error overriding in tests
  globalThis.Worker = FakeWorker;
});

afterEach(() => {
  // @ts-expect-error cleanup
  delete globalThis.Worker;
});

describe("uciToMove", () => {
  it("parses a simple move", () => {
    expect(uciToMove("e2e4")).toEqual({ from: "e2", to: "e4" });
  });
  it("parses a promotion", () => {
    expect(uciToMove("e7e8q")).toEqual({ from: "e7", to: "e8", promotion: "q" });
  });
  it("parses castling as king-from / king-to", () => {
    expect(uciToMove("e1g1")).toEqual({ from: "e1", to: "g1" });
  });
  it("throws on garbage", () => {
    expect(() => uciToMove("x")).toThrow();
  });
});

describe("depthForDifficulty", () => {
  it.each([
    ["easy", 2],
    ["normal", 6],
    ["hard", 10],
  ] as const)("%s -> %i", (d, expected) => {
    expect(depthForDifficulty(d)).toBe(expected);
  });
});

describe("StockfishEngine", () => {
  it("sends 'uci' on construction and points at the variants.ini after uciok", () => {
    new StockfishEngine({ workerUrl: "/fake.js", variantPath: "/v/test.ini" });
    expect(FakeWorker.instances).toHaveLength(1);
    const w = FakeWorker.instances[0]!;
    expect(w.posted).toEqual(["uci"]);
    w.emit("uciok");
    expect(w.posted).toEqual(["uci", "setoption name VariantPath value /v/test.ini", "isready"]);
  });

  it("ready() resolves only after uciok + readyok", async () => {
    const sf = new StockfishEngine({ workerUrl: "/fake.js" });
    const w = FakeWorker.instances[0]!;
    let resolved = false;
    sf.ready().then(() => (resolved = true));
    await new Promise((r) => setTimeout(r, 0));
    expect(resolved).toBe(false);
    w.emit("readyok"); // before uciok — should NOT resolve
    await new Promise((r) => setTimeout(r, 0));
    expect(resolved).toBe(false);
    w.emit("uciok");
    w.emit("readyok");
    await new Promise((r) => setTimeout(r, 0));
    expect(resolved).toBe(true);
  });

  it("setVariant forwards a UCI_Variant setoption", () => {
    const sf = new StockfishEngine({ workerUrl: "/fake.js" });
    const w = FakeWorker.instances[0]!;
    sf.setVariant("chess-hacker6x6");
    expect(w.posted.at(-1)).toBe("setoption name UCI_Variant value chess-hacker6x6");
  });

  it("setPosition forwards a position fen command", () => {
    const sf = new StockfishEngine({ workerUrl: "/fake.js" });
    const w = FakeWorker.instances[0]!;
    sf.setPosition("8/8/8/8/8/8/8/8 w - - 0 1");
    expect(w.posted.at(-1)).toBe("position fen 8/8/8/8/8/8/8/8 w - - 0 1");
  });

  it("getBestMove issues `go depth N` and resolves with the bestmove uci", async () => {
    const sf = new StockfishEngine({ workerUrl: "/fake.js" });
    const w = FakeWorker.instances[0]!;
    const p = sf.getBestMove({ depth: 6 });
    expect(w.posted.at(-1)).toBe("go depth 6");
    w.emit("info depth 1 ...");
    w.emit("bestmove e2e4 ponder e7e5");
    await expect(p).resolves.toBe("e2e4");
  });

  it("getBestMove with movetimeMs uses `go movetime`", async () => {
    const sf = new StockfishEngine({ workerUrl: "/fake.js" });
    const w = FakeWorker.instances[0]!;
    const p = sf.getBestMove({ movetimeMs: 250 });
    expect(w.posted.at(-1)).toBe("go movetime 250");
    w.emit("bestmove h7h5");
    await expect(p).resolves.toBe("h7h5");
  });

  it("getBestMove with searchMoves restricts the root via UCI searchmoves", async () => {
    const sf = new StockfishEngine({ workerUrl: "/fake.js" });
    const w = FakeWorker.instances[0]!;
    const p = sf.getBestMove({ depth: 6, searchMoves: ["e7e5", "d7d5"] });
    expect(w.posted.at(-1)).toBe("go depth 6 searchmoves e7e5 d7d5");
    w.emit("bestmove e7e5");
    await expect(p).resolves.toBe("e7e5");
  });

  it("getBestMove omits searchmoves when the list is empty", async () => {
    const sf = new StockfishEngine({ workerUrl: "/fake.js" });
    const w = FakeWorker.instances[0]!;
    sf.getBestMove({ depth: 6, searchMoves: [] });
    expect(w.posted.at(-1)).toBe("go depth 6");
  });

  it("getBestMove rejects when a search is already in progress", async () => {
    const sf = new StockfishEngine({ workerUrl: "/fake.js" });
    sf.getBestMove({ depth: 4 });
    await expect(sf.getBestMove({ depth: 4 })).rejects.toThrow(/already in progress/);
  });

  it("returns empty string when engine reports `bestmove (none)`", async () => {
    const sf = new StockfishEngine({ workerUrl: "/fake.js" });
    const w = FakeWorker.instances[0]!;
    const p = sf.getBestMove({ depth: 4 });
    w.emit("bestmove (none)");
    await expect(p).resolves.toBe("");
  });

  it("destroy() terminates the worker and rejects an in-flight search", async () => {
    const sf = new StockfishEngine({ workerUrl: "/fake.js" });
    const w = FakeWorker.instances[0]!;
    const search = sf.getBestMove({ depth: 4 });
    // Attach the rejection handler before destroy() to avoid a transient
    // unhandled-rejection report from the runner.
    const settled = search.then(
      () => "resolved",
      (e: Error) => `rejected:${e.message}`,
    );
    sf.destroy();
    expect(w.terminated).toBe(true);
    expect(w.posted.at(-1)).toBe("quit");
    expect(await settled).toMatch(/^rejected:.*destroyed/);
  });

  it("stop() forwards a stop command only when a search is running", () => {
    const sf = new StockfishEngine({ workerUrl: "/fake.js" });
    const w = FakeWorker.instances[0]!;
    sf.stop();
    expect(w.posted).not.toContain("stop");
    sf.getBestMove({ depth: 4 });
    sf.stop();
    expect(w.posted.at(-1)).toBe("stop");
  });

  it("worker errors reject the in-flight search", async () => {
    const sf = new StockfishEngine({ workerUrl: "/fake.js" });
    const w = FakeWorker.instances[0]!;
    const p = sf.getBestMove({ depth: 4 });
    w.onerror?.(new ErrorEvent("error", { message: "boom" }));
    await expect(p).rejects.toThrow(/boom/);
  });

  it("ignores Worker quirks: does not crash on non-string messages", () => {
    const sf = new StockfishEngine({ workerUrl: "/fake.js" });
    const w = FakeWorker.instances[0]!;
    expect(() =>
      w.onmessage?.({ data: 42 as unknown as string } as MessageEvent<string>),
    ).not.toThrow();
    sf.destroy();
  });

  describe("watchdog", () => {
    it("sends `stop` when no bestmove arrives within watchdogMs", async () => {
      vi.useFakeTimers();
      try {
        const sf = new StockfishEngine({ workerUrl: "/fake.js" });
        const w = FakeWorker.instances[0]!;
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        const search = sf.getBestMove({ depth: 4, watchdogMs: 50 }).catch(() => {});
        expect(w.posted.at(-1)).toBe("go depth 4");

        // Watchdog fires → wrapper sends `stop`.
        await vi.advanceTimersByTimeAsync(50);
        expect(w.posted.at(-1)).toBe("stop");

        // Engine responds late with a bestmove during the 1s grace period —
        // wrapper resolves the in-flight search rather than rejecting.
        w.emit("bestmove e7e5");
        await search;
      } finally {
        vi.useRealTimers();
      }
    });

    it("rejects after the 1s grace period if engine doesn't respond to stop", async () => {
      vi.useFakeTimers();
      try {
        const sf = new StockfishEngine({ workerUrl: "/fake.js" });
        const w = FakeWorker.instances[0]!;
        const settled = sf.getBestMove({ depth: 4, watchdogMs: 50 }).then(
          () => "resolved",
          (e: Error) => `rejected:${e.message}`,
        );

        await vi.advanceTimersByTimeAsync(50);
        expect(w.posted.at(-1)).toBe("stop");

        // Engine never responds — grace timer fires after 1s.
        await vi.advanceTimersByTimeAsync(1000);
        expect(await settled).toMatch(/^rejected:.*watchdog/);
      } finally {
        vi.useRealTimers();
      }
    });

    it("does not fire when bestmove arrives before the watchdog", async () => {
      vi.useFakeTimers();
      try {
        const sf = new StockfishEngine({ workerUrl: "/fake.js" });
        const w = FakeWorker.instances[0]!;
        const p = sf.getBestMove({ depth: 4, watchdogMs: 100 });

        await vi.advanceTimersByTimeAsync(20);
        w.emit("bestmove e7e5");
        await expect(p).resolves.toBe("e7e5");

        // Even after the would-be watchdog window, no `stop` was sent.
        await vi.advanceTimersByTimeAsync(200);
        expect(w.posted).not.toContain("stop");
      } finally {
        vi.useRealTimers();
      }
    });

    it("destroy() clears a pending watchdog", async () => {
      vi.useFakeTimers();
      try {
        const sf = new StockfishEngine({ workerUrl: "/fake.js" });
        const w = FakeWorker.instances[0]!;
        const settled = sf.getBestMove({ depth: 4, watchdogMs: 50 }).then(
          () => "resolved",
          (e: Error) => `rejected:${e.message}`,
        );
        sf.destroy();
        // Advance past the watchdog window — `stop` must NOT be sent on a
        // destroyed engine, and the only rejection should be from destroy.
        await vi.advanceTimersByTimeAsync(2000);
        expect(w.posted).not.toContain("stop");
        expect(await settled).toMatch(/^rejected:.*destroyed/);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("ready watchdog", () => {
    it("rejects ready() if readyok never arrives within readyTimeoutMs", async () => {
      vi.useFakeTimers();
      try {
        const sf = new StockfishEngine({ workerUrl: "/fake.js", readyTimeoutMs: 100 });
        const settled = sf.ready().then(
          () => "resolved",
          (e: Error) => `rejected:${e.message}`,
        );
        await vi.advanceTimersByTimeAsync(100);
        expect(await settled).toMatch(/^rejected:.*ready timed out/);
      } finally {
        vi.useRealTimers();
      }
    });

    it("does not fire if uciok+readyok arrive before readyTimeoutMs", async () => {
      vi.useFakeTimers();
      try {
        const sf = new StockfishEngine({ workerUrl: "/fake.js", readyTimeoutMs: 200 });
        const w = FakeWorker.instances[0]!;
        const p = sf.ready();
        await vi.advanceTimersByTimeAsync(50);
        w.emit("uciok");
        w.emit("readyok");
        await expect(p).resolves.toBeUndefined();

        // Advance past the would-be ready watchdog — must NOT have fired.
        await vi.advanceTimersByTimeAsync(500);
        // No reject path can have run; a second await should still resolve.
        await expect(sf.ready()).resolves.toBeUndefined();
      } finally {
        vi.useRealTimers();
      }
    });

    it("destroy() rejects a pending ready() so awaiters don't dangle", async () => {
      const sf = new StockfishEngine({ workerUrl: "/fake.js" });
      const settled = sf.ready().then(
        () => "resolved",
        (e: Error) => `rejected:${e.message}`,
      );
      sf.destroy();
      expect(await settled).toMatch(/^rejected:.*destroyed/);
    });

    it("readyTimeoutMs=0 disables the watchdog", async () => {
      vi.useFakeTimers();
      try {
        const sf = new StockfishEngine({ workerUrl: "/fake.js", readyTimeoutMs: 0 });
        const w = FakeWorker.instances[0]!;
        let settled = false;
        sf.ready().then(
          () => (settled = true),
          () => (settled = true),
        );
        await vi.advanceTimersByTimeAsync(60_000);
        expect(settled).toBe(false);
        // Engine eventually completes the handshake.
        w.emit("uciok");
        w.emit("readyok");
        await vi.advanceTimersByTimeAsync(0);
        expect(settled).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});

describe("variantFor", () => {
  it("returns 'chess' for 8x8", () => {
    expect(variantFor({ files: 8, ranks: 8 })).toBe("chess");
  });

  it("returns chess-hackerNxM for non-standard sizes", () => {
    expect(variantFor({ files: 6, ranks: 6 })).toBe("chess-hacker6x6");
    expect(variantFor({ files: 7, ranks: 7 })).toBe("chess-hacker7x7");
  });
});

describe("legalMoveToUci", () => {
  it("formats a normal move as from+to", () => {
    const m: LegalMove = {
      from: "e2",
      to: "e4",
      san: "e4",
      isCapture: false,
      isPromotion: false,
      isCastle: false,
    };
    expect(legalMoveToUci(m)).toBe("e2e4");
  });

  it("appends the promotion letter for promotions", () => {
    const m: LegalMove = {
      from: "e7",
      to: "e8",
      promotion: "q",
      san: "e8=Q",
      isCapture: false,
      isPromotion: true,
      isCastle: false,
    };
    expect(legalMoveToUci(m)).toBe("e7e8q");
  });
});
