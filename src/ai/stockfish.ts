// Fairy-Stockfish.wasm wrapper.
//
// We use Fairy-Stockfish (a Stockfish fork with native chess-variant support)
// instead of vanilla Stockfish so the engine knows about non-8x8 boards
// directly. Standard mode uses 6x6, 7x7, and 8x8 boards across the run;
// without variant support we'd be back to a homegrown toy AI on small
// boards or playing tricks like embedding the small board into an 8x8 with
// searchmoves (which breaks promotion semantics and biases NNUE eval).
//
// Layout: a UCI proxy worker at /fairy-stockfish/uci.worker.js loads the
// engine factory (stockfish.js) inside a Web Worker and pipes UCI lines
// both ways. The variants the engine knows about are declared in
// /fairy-stockfish/variants.ini; we point the engine at that file via the
// `VariantPath` option as part of the init handshake. The Chess Hacker-side
// code then calls `setVariant("chess-hacker6x6")` / `setVariant("chess-hacker7x7")` /
// `setVariant("chess")` (for 8x8) before each match.
//
// Pthreads + SharedArrayBuffer requirement: Fairy-Stockfish.wasm uses
// shared memory, so the document must be cross-origin isolated. Vite is
// configured to emit COEP: require-corp + COOP: same-origin (vite.config.ts).
// Production deployments must set the same headers at the host level —
// see docs/technical/ai.md.
//
// Wrapper API (unchanged from the previous Stockfish wrapper):
//
//   const sf = new StockfishEngine();
//   await sf.ready();
//   sf.setVariant("chess-hacker6x6");
//   sf.setPosition(fen);
//   const uci = await sf.getBestMove({ depth: 6 });   // e.g. "e7e5", "e7e8q"
//   sf.destroy();
//
// Concurrency: only one search may be in flight at a time. getBestMove()
// rejects a second concurrent call rather than racing. The caller (Match)
// uses a "search generation" counter to ignore late results that arrive
// after the component teardown.

import type { EngineMove, LegalMove } from "../game/chess/engine";
import type { AlgebraicSquare, BoardSize } from "../game/types";

export type GoOptions = (
  | { depth: number; movetimeMs?: never }
  | { movetimeMs: number; depth?: never }
) & {
  /**
   * UCI `searchmoves` filter — restrict the engine to only consider these
   * moves at the root. We pass our wall-/freeze-/sanctuary-/etc.-aware
   * legal-move set so the engine never picks a move that violates an
   * overlay (the engine itself only knows about board geometry from the
   * variant config; overlays are Chess Hacker-side).
   */
  searchMoves?: ReadonlyArray<string>;
  /**
   * Optional watchdog (ms). If the engine doesn't reply with `bestmove`
   * within this window, the wrapper sends `stop`, waits a 1s grace period
   * for the engine to respond, then rejects with a timeout error and dumps
   * recent UCI lines to the console. Default: undefined (no watchdog).
   *
   * Defends against a rare freeze where the search never returns a move —
   * the game should not lock up; the caller can fall back to a random
   * legal move and surface an error.
   */
  watchdogMs?: number;
};

export type StockfishOptions = {
  /** URL of the worker script, relative to the site root. Override for tests. */
  workerUrl?: string;
  /**
   * Path inside the engine's virtual filesystem where the proxy worker
   * placed the variants.ini. The engine reads `VariantPath` via its own
   * Emscripten FS, so this is NOT a URL — it must match the path used by
   * the proxy's `FS.writeFile` call. Override for tests.
   */
  variantPath?: string;
  /**
   * Watchdog (ms) for the uci/readyok handshake. If the engine doesn't
   * reach `readyok` within this window, `ready()` rejects so callers
   * surface an error instead of waiting forever. A silent init failure
   * (wasm 404, missing SharedArrayBuffer, variants.ini fetch failing)
   * would otherwise hang `await ai.ready()` indefinitely — this is the
   * only thing protecting that path; `getBestMove`'s `watchdogMs`
   * doesn't apply until after ready resolves. Default: 20s.
   */
  readyTimeoutMs?: number;
};

export const DEFAULT_WORKER_URL = "/fairy-stockfish/uci.worker.js";
export const DEFAULT_VARIANT_PATH = "/variants.ini";
export const DEFAULT_READY_TIMEOUT_MS = 20_000;

/**
 * Parse a UCI bestmove string ("e2e4", "e7e8q", or castling like "e1g1") into
 * the engine's move shape. Castling uses king-from / king-to which our engine
 * also accepts directly via the from/to API.
 */
export function uciToMove(uci: string): EngineMove {
  if (uci.length < 4) throw new Error(`invalid uci move: ${uci}`);
  const from = uci.slice(0, 2) as AlgebraicSquare;
  const to = uci.slice(2, 4) as AlgebraicSquare;
  const promotion = uci.length >= 5 ? (uci[4] as "q" | "r" | "b" | "n") : undefined;
  return promotion ? { from, to, promotion } : { from, to };
}

/** Format a LegalMove for UCI `searchmoves` (e.g. "e2e4", "e7e8q", "e1g1"). */
export function legalMoveToUci(m: LegalMove): string {
  return `${m.from}${m.to}${m.promotion ?? ""}`;
}

/**
 * Pick the Fairy-Stockfish variant name for a board size. 8x8 uses the
 * built-in `chess` variant; smaller sizes map to entries declared in
 * public/fairy-stockfish/variants.ini.
 */
export function variantFor(size: BoardSize): string {
  if (size.files === 8 && size.ranks === 8) return "chess";
  return `chess-hacker${size.files}x${size.ranks}`;
}

/**
 * Recent-UCI-line ring buffer size. Kept on each engine instance and dumped
 * on a watchdog-triggered timeout so a future hang has diagnostic context
 * in the browser console.
 */
const UCI_LINE_BUFFER = 60;

export class StockfishEngine {
  private worker: Worker;
  private variantPath: string;
  private readyResolve: (() => void) | null = null;
  private readyReject: ((err: Error) => void) | null = null;
  private readyPromise: Promise<void>;
  private readyTimer: ReturnType<typeof setTimeout> | null = null;
  private uciOk = false;
  private bestMoveResolve: ((uci: string) => void) | null = null;
  private bestMoveReject: ((err: Error) => void) | null = null;
  private destroyed = false;
  /** Recent UCI lines (engine → main), oldest first. Capped to UCI_LINE_BUFFER. */
  private recentLines: string[] = [];
  /** Active watchdog timer, if any. Cleared by bestmove arrival or destroy. */
  private watchdogTimer: ReturnType<typeof setTimeout> | null = null;
  /** Grace timer between sending `stop` and rejecting on watchdog timeout. */
  private watchdogStopTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(opts: StockfishOptions = {}) {
    const url = opts.workerUrl ?? DEFAULT_WORKER_URL;
    this.variantPath = opts.variantPath ?? DEFAULT_VARIANT_PATH;
    this.worker = new Worker(url);
    this.worker.onmessage = (e: MessageEvent<string>) => this.handleLine(e.data);
    this.worker.onerror = (e) => {
      const err = new Error(`stockfish worker error: ${e.message}`);
      this.bestMoveReject?.(err);
      this.bestMoveReject = null;
      this.bestMoveResolve = null;
    };

    this.readyPromise = new Promise((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;
    });
    // Suppress the unhandled-rejection that fires when ready() is rejected
    // before any caller awaits it (e.g. the constructor's readyTimer fires
    // and no one has called ready() yet). Real callers attach their own
    // handlers and still see the rejection.
    this.readyPromise.catch(() => {});

    // Init handshake watchdog: if `readyok` doesn't arrive in time, reject
    // ready() so callers don't block forever on a silent init failure
    // (worker URL 404, missing COEP/COOP, variants.ini fetch fail, etc.).
    const readyMs = opts.readyTimeoutMs ?? DEFAULT_READY_TIMEOUT_MS;
    if (readyMs > 0) {
      this.readyTimer = setTimeout(() => {
        this.readyTimer = null;
        // eslint-disable-next-line no-console
        console.warn(
          `[stockfish] ready watchdog: no readyok after ${readyMs}ms. Recent UCI lines:\n` +
            this.recentLines.map((l) => `  ${l}`).join("\n"),
        );
        const rej = this.readyReject;
        this.readyResolve = null;
        this.readyReject = null;
        rej?.(new Error(`stockfish ready timed out after ${readyMs}ms`));
      }, readyMs);
    }

    // Init sequence: `uci` first, then on `uciok` we point the engine at
    // our variants.ini and send `isready`. `ready()` resolves on `readyok`.
    this.send("uci");
  }

  ready(): Promise<void> {
    return this.readyPromise;
  }

  /**
   * Select which variant to play. Must be called after `ready()` and
   * before `setPosition()`. 8x8 should use "chess"; smaller boards use the
   * `chess-hackerNxM` names defined in variants.ini (see `variantFor`).
   */
  setVariant(name: string): void {
    this.send(`setoption name UCI_Variant value ${name}`);
  }

  setPosition(fen: string): void {
    this.send(`position fen ${fen}`);
  }

  /**
   * Ask the engine for the best move at the current position.
   * Resolves with a UCI move string. Rejects if a search is already running.
   *
   * If `opts.watchdogMs` is set, arms a timer that — if no bestmove arrives —
   * sends `stop`, gives the engine 1s to respond, then rejects (and dumps
   * the recent UCI line buffer to the console).
   */
  getBestMove(opts: GoOptions): Promise<string> {
    if (this.destroyed) return Promise.reject(new Error("stockfish destroyed"));
    if (this.bestMoveResolve) {
      return Promise.reject(new Error("search already in progress"));
    }
    return new Promise<string>((resolve, reject) => {
      this.bestMoveResolve = resolve;
      this.bestMoveReject = reject;
      const head =
        "movetimeMs" in opts && opts.movetimeMs != null
          ? `go movetime ${opts.movetimeMs}`
          : `go depth ${opts.depth ?? 6}`;
      const restrict =
        opts.searchMoves && opts.searchMoves.length > 0
          ? ` searchmoves ${opts.searchMoves.join(" ")}`
          : "";
      this.send(`${head}${restrict}`);

      const wd = opts.watchdogMs;
      if (typeof wd === "number" && wd > 0) {
        this.watchdogTimer = setTimeout(() => {
          this.watchdogTimer = null;
          // eslint-disable-next-line no-console
          console.warn(
            `[stockfish] watchdog: no bestmove after ${wd}ms — sending stop. Recent UCI lines:\n` +
              this.recentLines.map((l) => `  ${l}`).join("\n"),
          );
          this.send("stop");
          // Grace: give the engine a second to respond to `stop` (it normally
          // emits a bestmove based on its current best line). If it doesn't,
          // null out the in-flight handles and reject so callers can recover.
          this.watchdogStopTimer = setTimeout(() => {
            this.watchdogStopTimer = null;
            const rej = this.bestMoveReject;
            this.bestMoveResolve = null;
            this.bestMoveReject = null;
            rej?.(new Error(`stockfish watchdog timed out after ${wd}ms`));
          }, 1000);
        }, wd);
      }
    });
  }

  /**
   * Stop any ongoing search. The engine responds with bestmove based on its
   * current best line; that resolves the in-flight getBestMove() promise.
   */
  stop(): void {
    if (this.bestMoveResolve) this.send("stop");
  }

  destroy(): void {
    if (this.destroyed) return;
    this.clearWatchdog();
    this.clearReadyTimer();
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
    // If destroy() races the handshake (e.g. StrictMode mount/unmount before
    // readyok arrives), reject ready() so awaiters don't dangle forever.
    if (this.readyReject) {
      const rej = this.readyReject;
      this.readyResolve = null;
      this.readyReject = null;
      rej(new Error("stockfish destroyed"));
    }
  }

  private clearWatchdog(): void {
    if (this.watchdogTimer !== null) {
      clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }
    if (this.watchdogStopTimer !== null) {
      clearTimeout(this.watchdogStopTimer);
      this.watchdogStopTimer = null;
    }
  }

  private clearReadyTimer(): void {
    if (this.readyTimer !== null) {
      clearTimeout(this.readyTimer);
      this.readyTimer = null;
    }
  }

  private send(cmd: string): void {
    if (this.destroyed) return;
    this.worker.postMessage(cmd);
  }

  private handleLine(line: string): void {
    if (typeof line !== "string") return;

    // Buffer the line so a watchdog timeout has diagnostic context to dump.
    this.recentLines.push(line);
    if (this.recentLines.length > UCI_LINE_BUFFER) this.recentLines.shift();

    // Surface the proxy worker's init log lines so a hung handshake is
    // diagnosable from devtools. These stay in `info string` form so they
    // don't interfere with the bestmove parser below.
    if (line.startsWith("info string [proxy]")) {
      // eslint-disable-next-line no-console
      console.log(`[stockfish] ${line.slice("info string [proxy] ".length)}`);
      return;
    }

    if (line === "uciok") {
      this.uciOk = true;
      // Load custom variants now that the engine is alive, then ask it to
      // confirm readiness.
      this.send(`setoption name VariantPath value ${this.variantPath}`);
      this.send("isready");
      return;
    }
    if (line === "readyok") {
      // The first readyok after uciok flips the engine to ready.
      if (this.uciOk && this.readyResolve) {
        this.clearReadyTimer();
        const resolve = this.readyResolve;
        this.readyResolve = null;
        this.readyReject = null;
        resolve();
      }
      return;
    }
    if (line.startsWith("bestmove")) {
      // "bestmove e2e4" or "bestmove e7e8q ponder ..."
      this.clearWatchdog();
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
