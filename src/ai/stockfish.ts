// Fairy-Stockfish.wasm wrapper.
//
// We use Fairy-Stockfish (a Stockfish fork with native chess-variant support)
// instead of vanilla Stockfish so the engine knows about non-8x8 boards
// directly. Standard mode uses 4x6 → 7x8 boards across the run; without
// variant support we'd be back to a homegrown toy AI on small boards or
// playing tricks like embedding the small board into an 8x8 with searchmoves
// (which breaks promotion semantics and biases NNUE eval).
//
// Layout: a UCI proxy worker at /fairy-stockfish/uci.worker.js loads the
// engine factory (stockfish.js) inside a Web Worker and pipes UCI lines
// both ways. The variants the engine knows about are declared in
// /fairy-stockfish/variants.ini; we point the engine at that file via the
// `VariantPath` option as part of the init handshake. The choss-side code
// then calls `setVariant("choss4x6")` etc. before each match.
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
//   sf.setVariant("choss5x7");
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
   * variant config; overlays are choss-side).
   */
  searchMoves?: ReadonlyArray<string>;
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
};

export const DEFAULT_WORKER_URL = "/fairy-stockfish/uci.worker.js";
export const DEFAULT_VARIANT_PATH = "/variants.ini";

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
  return `choss${size.files}x${size.ranks}`;
}

export class StockfishEngine {
  private worker: Worker;
  private variantPath: string;
  private readyResolve: (() => void) | null = null;
  private readyPromise: Promise<void>;
  private uciOk = false;
  private bestMoveResolve: ((uci: string) => void) | null = null;
  private bestMoveReject: ((err: Error) => void) | null = null;
  private destroyed = false;

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

    this.readyPromise = new Promise((resolve) => {
      this.readyResolve = resolve;
    });

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
   * `chossNxM` names defined in variants.ini (see `variantFor`).
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
