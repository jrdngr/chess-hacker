// AI loop: Stockfish worker spawn/teardown, the player→AI turn handoff effect,
// and the imperative single-shot AI move. Extracted from Match.tsx to keep
// that file's render tree readable. All chess + card-system state still lives
// in Match; this hook only owns the AI worker handle and the in-flight move
// generation counter.

import { useCallback, useEffect, useRef, useState } from "react";

import {
  StockfishEngine,
  type Difficulty,
  type StockfishOptions,
  depthForDifficulty,
  legalMoveToUci,
  uciToMove,
  variantFor,
} from "../../ai/stockfish";
import type { ChoseEngine } from "../../game/chess/engine";
import type { BossDef, MatchCardState, Piece, Side } from "../../game/types";
import { clearStatusesOn } from "../../game/cards/match";
import { resolveTrapForMove } from "./sideEffects";
import type { HistoryEvent } from "./history";

const AI_SIDE: Side = "opponent";
/**
 * Watchdog for `getBestMove`. Depth 6 on the boards we use should finish in
 * well under a second; 15s is generous and only fires when something has
 * genuinely gone wrong with the engine. On timeout we fall back to a random
 * legal move (see `doAiMove`) so the game doesn't lock up.
 */
const AI_WATCHDOG_MS = 15_000;

type Params = {
  engine: ChoseEngine;
  /** Match's per-mode flag — drives the spawn-effect mount/unmount. */
  mode: "vs-ai" | "local-pvp";
  cardsEnabled: boolean;
  difficulty: Difficulty;
  aiMinThinkMs: number;
  /** True when the match shouldn't run the AI (history scrub / final replay). */
  displayOnly: boolean;
  /** Optional dependency-injected AI factory (used by tests). */
  createAi?: (opts?: StockfishOptions) => StockfishEngine;
  /** Mirror of Match's "is it the AI's turn right now" derived flag. */
  isAiTurn: boolean;
  /** Mirror of Match's "the match is over" flag (gates triggerAiSingleMove). */
  matchOver: boolean;
  /** Whose turn the engine reports right now (gates triggerAiSingleMove). */
  turn: Side;
  /** Active boss (if any) — drives the void-square + capture-energy hooks. */
  activeBoss: BossDef | null | undefined;
  /** Latest cardState; needed by the trap resolver and history events. */
  cardState: MatchCardState;
  setCardState: (next: MatchCardState) => void;
  /** Bump after every chess move so derived render values recompute. */
  bumpVersion: () => void;
  pushHistory: (event: HistoryEvent) => HistoryEvent[];
  /** Match's start-of-player-turn rollover (refill hand, tick overlays, snapshot). */
  applyTurnRollover: (state: MatchCardState) => void;
  /** Match's status-effect dispatcher; fired after AI captures so opponent-side triggers land. */
  applyStatusEffects: (
    state: MatchCardState,
    event: import("../../game/status/dispatch").StatusEvent,
  ) => MatchCardState;
};

type Result = {
  aiThinking: boolean;
  aiError: string | null;
  /** Imperative single-move trigger used by the dev "AI Move" button. */
  triggerAiSingleMove: () => Promise<void>;
  /** Cancel any in-flight AI move and clear thinking/error UI. */
  cancelInFlightAi: () => void;
};

export function useAiLoop({
  engine,
  mode,
  cardsEnabled,
  difficulty,
  aiMinThinkMs,
  displayOnly,
  createAi,
  isAiTurn,
  matchOver,
  turn,
  activeBoss,
  cardState,
  setCardState,
  bumpVersion,
  pushHistory,
  applyTurnRollover,
  applyStatusEffects,
}: Params): Result {
  const [aiThinking, setAiThinking] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Increments on new game / mode change so stale AI replies are ignored.
  const generationRef = useRef(0);
  const aiRef = useRef<StockfishEngine | null>(null);

  // Spin up the Fairy-Stockfish worker for every vs-ai match. The engine
  // supports custom board sizes via the variant config (variantFor maps our
  // BoardSize to the matching `chossNxM` variant declared in
  // public/fairy-stockfish/variants.ini, falling back to standard `chess`
  // for 8x8). Walls, freezes, etc. still ride the searchmoves filter in
  // doAiMove since they're not part of the engine's variant geometry.
  const variant = variantFor(engine.size());
  useEffect(() => {
    if (mode !== "vs-ai") return;
    if (displayOnly) return;
    let ai: StockfishEngine | null = null;
    try {
      ai = createAi ? createAi() : new StockfishEngine();
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "failed to start AI");
      return;
    }
    aiRef.current = ai;
    ai.ready()
      .then(() => {
        ai?.setVariant(variant);
      })
      .catch((e) => {
        setAiError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      ai?.destroy();
      aiRef.current = null;
    };
  }, [mode, createAi, variant, displayOnly]);

  /**
   * Run a single AI move against the current position. Returns once the move
   * has been applied (or the call was cancelled / the AI returned nothing).
   * Both the auto AI loop and the dev "AI: play one move" button funnel
   * through here.
   *
   * Fairy-Stockfish handles every board size we use; the variant was set in
   * the spawn effect. We restrict the root choice to our overlay-aware legal
   * moves via UCI `searchmoves` so the engine can't pick a move that walks
   * through a wall, moves a frozen piece, captures a shielded piece, etc.
   */
  const doAiMove = useCallback(
    async (myGen: number, isCancelled: () => boolean, minThinkMs?: number): Promise<void> => {
      const wait = minThinkMs ?? aiMinThinkMs;

      const ai = aiRef.current;
      if (!ai) return;
      await ai.ready();
      if (isCancelled() || generationRef.current !== myGen) return;
      ai.setPosition(engine.fen());
      const candidates = engine.legalMoves().map(legalMoveToUci);
      // Engine reply, watchdog'd so a freak hang falls back to a random move
      // instead of locking the game on "thinking…" forever. On rejection we
      // surface the error and let the existing `if (!applied)` fallback
      // below pick a legal move so the game keeps progressing.
      let uci = "";
      let engineFailed = false;
      try {
        [uci] = await Promise.all([
          ai.getBestMove({
            depth: depthForDifficulty(difficulty),
            searchMoves: candidates,
            watchdogMs: AI_WATCHDOG_MS,
          }),
          new Promise<void>((resolve) => setTimeout(resolve, wait)),
        ]);
      } catch (e) {
        engineFailed = true;
        const msg = e instanceof Error ? e.message : String(e);
        // eslint-disable-next-line no-console
        console.warn(`[ai] getBestMove failed; falling back to random legal move: ${msg}`);
        setAiError(`AI engine error: ${msg} — playing a random legal move`);
      }
      if (isCancelled() || generationRef.current !== myGen) return;
      // Empty uci with no failure = engine genuinely reports no legal move
      // (stalemate/checkmate); skip without a fallback. On engineFailed we
      // proceed so the random-move fallback below fires.
      if (!uci && !engineFailed) return;

      // Snapshot the moving piece BEFORE the engine applies the move; its
      // type drives the move-path computation used by trap resolution.
      // A malformed UCI string is treated as "no move"; the fallback below
      // picks a legal one so the game progresses.
      let move: ReturnType<typeof uciToMove> | null = null;
      if (uci) {
        try {
          move = uciToMove(uci);
        } catch {
          move = null;
        }
      }
      let mover: Piece | null = move ? engine.pieceAt(move.from) : null;
      // Capture victim must be read BEFORE applying the move — once the engine
      // resolves, the target square is gone or repopulated.
      let captured: Piece | null = move ? engine.pieceAt(move.to) : null;
      let applied = move ? engine.move(move) : null;
      if (!applied) {
        const fallback = engine.legalMoves()[0];
        if (fallback) {
          mover = engine.pieceAt(fallback.from);
          captured = engine.pieceAt(fallback.to);
          applied = engine.move(fallback);
        }
      }
      bumpVersion();
      if (applied && mover) {
        pushHistory({
          kind: "move",
          turn: cardState.turn,
          by: mover.side,
          from: applied.from,
          to: applied.to,
          san: applied.san,
          isCapture: applied.isCapture,
          isPromotion: applied.isPromotion,
          isCastle: applied.isCastle,
          promotion: applied.promotion,
          capturedType: captured?.type,
          capturedSide: captured?.side,
          fenAfter: engine.fen(),
        });
      }
      if (applied && cardsEnabled && mover) {
        let trapped = resolveTrapForMove(
          engine,
          cardState,
          mover,
          applied.from,
          applied.to,
          captured,
        );
        // Boss C void: any piece ending its turn on a void square is
        // destroyed. The AI just moved there — that's its end-of-turn — so
        // remove it now. We also clear per-piece statuses on the dead square.
        if (
          activeBoss?.voidSquares &&
          activeBoss.voidSquares.includes(applied.to) &&
          engine.pieceAt(applied.to)
        ) {
          engine.removePiece(applied.to);
          trapped = clearStatusesOn(trapped, applied.to);
        }
        // Boss B modifier: when the AI captures a player piece, queue +1
        // energy for the player's next turn.
        if (
          applied.isCapture &&
          captured?.side === "player" &&
          activeBoss?.modifier.kind === "captures-grant-captured-energy"
        ) {
          trapped = {
            ...trapped,
            pendingPlayerEnergyOnTurnStart: (trapped.pendingPlayerEnergyOnTurnStart ?? 0) + 1,
          };
        }
        // Status effect triggers — fire on AI captures so player-targeting
        // statuses with "on-opponent-capture" triggers (currently none, but
        // wired in for future player-applied curses on the enemy) take effect.
        if (applied.isCapture) {
          trapped = applyStatusEffects(trapped, {
            kind: "capture",
            by: "opponent",
            turn: trapped.turn,
          });
        }
        if (mover.type === "pawn") {
          trapped = applyStatusEffects(trapped, {
            kind: "pawn-move",
            by: "opponent",
            turn: trapped.turn,
          });
        }
        bumpVersion();
        // Echo (Boss C): if the boss owes the player one or more extra moves,
        // decrement the counter and flip the turn back to opponent so the AI
        // effect fires again. Skip the player-turn rollover until the queue
        // drains.
        const extras = trapped.bossExtraMoves ?? 0;
        if (extras > 0) {
          const next = { ...trapped, bossExtraMoves: extras - 1 };
          setCardState(next);
          engine.forceTurn("opponent");
          bumpVersion();
          return;
        }
        applyTurnRollover(trapped);
      }
    },
    [
      engine,
      difficulty,
      aiMinThinkMs,
      cardsEnabled,
      cardState,
      applyTurnRollover,
      applyStatusEffects,
      pushHistory,
      activeBoss,
      bumpVersion,
      setCardState,
    ],
  );

  // The auto AI loop: whenever it becomes the AI's turn, kick off a move.
  useEffect(() => {
    if (!isAiTurn) return;
    const myGen = ++generationRef.current;
    setAiThinking(true);
    let cancelled = false;
    (async () => {
      try {
        await doAiMove(myGen, () => cancelled);
      } catch (e) {
        if (cancelled) return;
        setAiError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setAiThinking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // engine is mutable but stable; isAiTurn drives the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAiTurn]);

  /**
   * Imperative single-shot AI move. Used by the dev "AI: play one move"
   * button. The button is gated by `aiThinking`, so no concurrent run is
   * possible. Bumps generation to invalidate any in-flight effect work.
   */
  const triggerAiSingleMove = useCallback(async () => {
    if (matchOver || aiThinking) return;
    if (turn !== AI_SIDE) return;
    const myGen = ++generationRef.current;
    setAiThinking(true);
    try {
      // Manual single-move skips the cosmetic think delay — the player asked
      // for the move, so don't make them wait. The auto AI loop still uses
      // aiMinThinkMs so its moves don't snap-resolve.
      await doAiMove(myGen, () => false, 0);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : String(e));
    } finally {
      setAiThinking(false);
    }
  }, [matchOver, aiThinking, turn, doAiMove]);

  const cancelInFlightAi = useCallback(() => {
    generationRef.current++;
    aiRef.current?.stop();
    setAiThinking(false);
    setAiError(null);
  }, []);

  return { aiThinking, aiError, triggerAiSingleMove, cancelInFlightAi };
}
