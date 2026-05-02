// Stockfish.wasm wrapper.
//
// Loads stockfish.wasm.js (or stockfish.js fallback) as a Web Worker. Speaks
// the UCI protocol over postMessage. Exposes a small Promise-based API:
//
//   const sf = new StockfishEngine();
//   await sf.ready();
//   sf.setPosition(fen);
//   const uci = await sf.getBestMove({ depth: 6 });   // e.g. "e7e5", "e7e8q"
//   sf.destroy();
//
// Design notes:
// - The worker files live in /public/stockfish/ so Vite serves them as static
//   assets. The wasm binary is loaded by the worker itself (relative to its
//   URL), so the location in /public matters.
// - Only one search may be in flight at a time. getBestMove() rejects a second
//   concurrent call rather than racing.
// - We track a "search generation" so that callers who tear down between
//   sending `go` and receiving `bestmove` can ignore the late result. The
//   wrapper itself just resolves the promise; the *caller* (Match) handles
//   discarding stale answers.

import type { EngineMove } from "../game/chess/engine";
import type { AlgebraicSquare } from "../game/types";

export type GoOptions =
  | { depth: number; movetimeMs?: never }
  | { movetimeMs: number; depth?: never };

export type StockfishOptions = {
  /** URL of the worker script, relative to the site root. Override for tests. */
  workerUrl?: string;
  /** URL of the asm.js fallback (used when WebAssembly is unavailable). */
  fallbackWorkerUrl?: string;
};

export const DEFAULT_WORKER_URL = "/stockfish/stockfish.wasm.js";
export const FALLBACK_WORKER_URL = "/stockfish/stockfish.js";

function wasmSupported(): boolean {
  try {
    return (
      typeof WebAssembly === "object" &&
      typeof WebAssembly.validate === "function" &&
      WebAssembly.validate(Uint8Array.of(0x0, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00))
    );
  } catch {
    return false;
  }
}

/**
 * Parse a UCI bestmove string ("e2e4", "e7e8q", or castling like "e1g1") into
 * the engine's move shape. Castling uses king-from / king-to which chess.js
 * also accepts directly via the from/to API.
 */
export function uciToMove(uci: string): EngineMove {
  if (uci.length < 4) throw new Error(`invalid uci move: ${uci}`);
  const from = uci.slice(0, 2) as AlgebraicSquare;
  const to = uci.slice(2, 4) as AlgebraicSquare;
  const promotion = uci.length >= 5 ? (uci[4] as "q" | "r" | "b" | "n") : undefined;
  return promotion ? { from, to, promotion } : { from, to };
}

export class StockfishEngine {
  private worker: Worker;
  private readyResolve: (() => void) | null = null;
  private readyPromise: Promise<void>;
  private uciOk = false;
  private bestMoveResolve: ((uci: string) => void) | null = null;
  private bestMoveReject: ((err: Error) => void) | null = null;
  private destroyed = false;

  constructor(opts: StockfishOptions = {}) {
    const url =
      opts.workerUrl ??
      (wasmSupported() ? DEFAULT_WORKER_URL : (opts.fallbackWorkerUrl ?? FALLBACK_WORKER_URL));
    this.worker = new Worker(url);
    this.worker.onmessage = (e: MessageEvent<string>) => this.handleLine(e.data);
    this.worker.onerror = (e) => {
      const err = new Error(`stockfish worker error: ${e.message}`);
      this.bestMoveReject?.(err);
      this.bestMoveReject = null;
      this.bestMoveResolve = null;
    };

    this.readyPromise = new Promise((resolve) => {
      this.readyResolve = resolve;
    });

    this.send("uci");
    this.send("isready");
  }

  ready(): Promise<void> {
    return this.readyPromise;
  }

  setPosition(fen: string): void {
    this.send(`position fen ${fen}`);
  }

  /**
   * Ask Stockfish for the best move at the current position.
   * Resolves with a UCI move string. Rejects if a search is already running.
   */
  getBestMove(opts: GoOptions): Promise<string> {
    if (this.destroyed) return Promise.reject(new Error("stockfish destroyed"));
    if (this.bestMoveResolve) {
      return Promise.reject(new Error("search already in progress"));
    }
    return new Promise<string>((resolve, reject) => {
      this.bestMoveResolve = resolve;
      this.bestMoveReject = reject;
      const cmd =
        "movetimeMs" in opts && opts.movetimeMs != null
          ? `go movetime ${opts.movetimeMs}`
          : `go depth ${opts.depth ?? 6}`;
      this.send(cmd);
    });
  }

  /**
   * Stop any ongoing search. Stockfish responds with bestmove based on its
   * current best line; that resolves the in-flight getBestMove() promise.
   */
  stop(): void {
    if (this.bestMoveResolve) this.send("stop");
  }

  destroy(): void {
    if (this.destroyed) return;
    try {
      // Bypass `send`'s destroyed-guard so the engine gets a clean shutdown.
      this.worker.postMessage("quit");
    } catch {
      // worker may already be torn down
    }
    this.worker.terminate();
    this.destroyed = true;
    if (this.bestMoveReject) {
      this.bestMoveReject(new Error("stockfish destroyed"));
      this.bestMoveReject = null;
      this.bestMoveResolve = null;
    }
  }

  private send(cmd: string): void {
    if (this.destroyed) return;
    this.worker.postMessage(cmd);
  }

  private handleLine(line: string): void {
    if (typeof line !== "string") return;

    if (line === "uciok") {
      this.uciOk = true;
      return;
    }
    if (line === "readyok") {
      // First readyok after uciok flips the engine to ready.
      if (this.uciOk && this.readyResolve) {
        this.readyResolve();
        this.readyResolve = null;
      }
      return;
    }
    if (line.startsWith("bestmove")) {
      // "bestmove e2e4" or "bestmove e7e8q ponder ..."
      const parts = line.split(/\s+/);
      const uci = parts[1];
      const resolve = this.bestMoveResolve;
      this.bestMoveResolve = null;
      this.bestMoveReject = null;
      if (resolve) {
        if (!uci || uci === "(none)") {
          // No legal move — caller treats this as "no move available".
          resolve("");
        } else {
          resolve(uci);
        }
      }
    }
  }
}

// ---- Difficulty mapping ------------------------------------------------------

export type Difficulty = "easy" | "normal" | "hard";

/** Maps the user-facing difficulty to a Stockfish search depth. */
export function depthForDifficulty(d: Difficulty): number {
  switch (d) {
    case "easy":
      return 2;
    case "normal":
      return 6;
    case "hard":
      return 10;
  }
}
