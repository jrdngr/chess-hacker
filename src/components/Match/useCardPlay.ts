// Card-play machinery — targeting state, the chess-move resolver (`tryPlay`),
// the card-effect resolver (`tryResolveCard`), the click/drag entry points,
// and the dev-panel "free play from library" synth flow.
//
// Pulled out of Match.tsx as part of the cleanup pass so Match owns top-level
// composition while this hook owns the player-turn input pipeline. Logic is
// preserved verbatim from the inline version; only the wrapper changes.

import { useCallback, useRef, useState } from "react";

import type { ChoseEngine, LegalMove } from "../../game/chess/engine";
import type { PromotionChoice } from "../Board/PieceChoiceModal";
import {
  applyCardSideEffects as applyCardSideEffectsPure,
  resolveTrapForMove,
} from "./sideEffects";
import type { HistoryEvent } from "./history";
import {
  clampEnergy,
  clearStatusesOn,
  consumeHaste,
  consumeLightningAction,
  discardHandAtTurnEnd,
  dropOtherSingleUseEmpowers,
  drawCards,
  grantPatchOnCapture,
  hasteAt,
  isCardEffectForbidden,
  lightningAt,
  playCard,
  relocateStatuses,
  type BoardContext,
  type CardSideEffect,
  type MatchRules,
  type PlayTarget,
  type Rng,
} from "../../game/cards/match";
import { drawOnCapture, drawOnCheck, energyOnCapture } from "../../game/artifacts/effects";
import type {
  AlgebraicSquare,
  Artifact,
  BossDef,
  Card,
  MatchCardState,
  PieceType,
  Side,
} from "../../game/types";
import type { StatusEvent } from "../../game/status/dispatch";

const HUMAN_SIDE: Side = "player";
const AI_SIDE: Side = "opponent";

type RunMode = "prototype" | "dev" | "run";
type MatchMode = "vs-ai" | "local-pvp";

type Params = {
  engine: ChoseEngine;
  cardState: MatchCardState;
  setCardState: (next: MatchCardState | ((prev: MatchCardState) => MatchCardState)) => void;
  bumpVersion: () => void;
  rng?: Rng;
  boardContext: BoardContext;
  matchRules: MatchRules;
  mode: MatchMode;
  runMode: RunMode;
  devPanelEnabled: boolean;
  devAiOn: boolean;
  aiThinking: boolean;
  matchOver: boolean;
  turn: Side;
  applyTurnRollover: (state: MatchCardState) => void;
  applyStatusEffects: (state: MatchCardState, event: StatusEvent) => MatchCardState;
  pushHistory: (event: HistoryEvent) => HistoryEvent[];
  pushSnapshot: (state: MatchCardState) => void;
  /** Provided by Match (eventually by useBoardInteraction); clears the chess-move selection. */
  setSelected: (sq: AlgebraicSquare | null) => void;
  artifacts: ReadonlyArray<Artifact>;
  activeBoss: BossDef | null | undefined;
  /**
   * Fire the move-slide animation. Called from `tryPlay` whenever a move is
   * applied through a click (drag-drops bypass the animation since the user
   * already moved the piece visually with their cursor).
   */
  triggerAnimation: (from: AlgebraicSquare, to: AlgebraicSquare) => void;
};

type Result = {
  // Targeting state
  targetingIndex: number | null;
  setTargetingIndex: (i: number | null) => void;
  partialTarget: AlgebraicSquare | null;
  setPartialTarget: (sq: AlgebraicSquare | null) => void;
  marionetteMoves: LegalMove[];
  setMarionetteMoves: (moves: LegalMove[]) => void;
  scryPending: { cards: Card[] } | null;
  setScryPending: (next: { cards: Card[] } | null) => void;
  revivePending: boolean;
  setRevivePending: (next: boolean) => void;
  promotionPending: { from: AlgebraicSquare; to: AlgebraicSquare; side: Side } | null;
  setPromotionPending: (
    next: { from: AlgebraicSquare; to: AlgebraicSquare; side: Side } | null,
  ) => void;
  transformPending: { square: AlgebraicSquare; options: PieceType[] } | null;
  setTransformPending: (next: { square: AlgebraicSquare; options: PieceType[] } | null) => void;
  resurrectPending: boolean;
  setResurrectPending: (next: boolean) => void;
  libraryFreePlayActive: boolean;
  // Callbacks
  tryPlay: (
    from: AlgebraicSquare,
    to: AlgebraicSquare,
    promotion?: PromotionChoice,
    source?: "click" | "drag",
  ) => boolean;
  tryResolveCard: (index: number, target: PlayTarget) => boolean;
  cancelTargeting: () => void;
  onCardClick: (index: number) => void;
  onCardDragStart: (index: number) => void;
  onCardDragEnd: () => void;
  applyCardSideEffects: (result: {
    state: MatchCardState;
    sideEffects: ReadonlyArray<CardSideEffect>;
  }) => MatchCardState;
  /**
   * Synthesize a library card into hand[0] for dev-panel free play. Sets up
   * the in-flight refs so `tryResolveCard` and `cancelTargeting` know to
   * revert energy and pop the synth from whichever pile it lands in.
   *
   * For "click-no-target" the card is resolved immediately. For all other
   * shapes (including click-with-target and drag) the synth lands in hand[0]
   * and targeting state opens; the resolver finishes the play.
   */
  synthesizeLibraryCard: (card: Card, mode: "click" | "drag") => void;
  /** Reset all targeting state and any in-flight library synth. */
  resetCardPlay: () => void;
};

export function useCardPlay({
  engine,
  cardState,
  setCardState,
  bumpVersion,
  rng,
  boardContext,
  matchRules,
  mode,
  runMode,
  devPanelEnabled,
  devAiOn,
  aiThinking,
  matchOver,
  turn,
  applyTurnRollover,
  applyStatusEffects,
  pushHistory,
  pushSnapshot,
  setSelected,
  artifacts,
  activeBoss,
  triggerAnimation,
}: Params): Result {
  const [targetingIndex, setTargetingIndex] = useState<number | null>(null);
  const [partialTarget, setPartialTarget] = useState<AlgebraicSquare | null>(null);
  const [marionetteMoves, setMarionetteMoves] = useState<LegalMove[]>([]);
  const [scryPending, setScryPending] = useState<{ cards: Card[] } | null>(null);
  const [revivePending, setRevivePending] = useState<boolean>(false);
  const [promotionPending, setPromotionPending] = useState<{
    from: AlgebraicSquare;
    to: AlgebraicSquare;
    side: Side;
  } | null>(null);
  const [transformPending, setTransformPending] = useState<{
    square: AlgebraicSquare;
    options: PieceType[];
  } | null>(null);
  const [resurrectPending, setResurrectPending] = useState<boolean>(false);
  /**
   * When non-null, a library-card play is in flight: the dev panel injected a
   * card at hand[0], paid no energy, and we're waiting for targeting (or the
   * card already resolved). The number stored is the pre-synth energy to
   * restore once `tryResolveCard` finishes the play. The state mirror drives
   * UI gating; the ref is for synchronous reads inside callbacks.
   */
  const libraryFreePlayRef = useRef<number | null>(null);
  const [libraryFreePlayActive, setLibraryFreePlayActive] = useState(false);

  /**
   * Try to play `target` from `selected`. Returns true if a move was made.
   * Making a move usually ends the player's turn — the AI loop kicks in via
   * the next render. Haste / Lightning / playerExtraMovesRemaining can flip
   * the turn back, in which case the function returns true but the engine
   * still reports the player as on-move.
   */
  const tryPlay = useCallback(
    (
      from: AlgebraicSquare,
      to: AlgebraicSquare,
      promotion?: PromotionChoice,
      source: "click" | "drag" = "click",
    ): boolean => {
      if (cardState.continuationSquare && from !== cardState.continuationSquare) {
        return false;
      }
      let candidates = engine.legalMoves(from).filter((m) => m.to === to);
      if (cardState.mustNotCheckNextMove) {
        candidates = candidates.filter((m) => !engine.wouldDeliverCheck(m));
      }
      if (matchRules.noPromotion) {
        candidates = candidates.filter((m) => !m.isPromotion);
      }
      if (candidates.length === 0) return false;
      // Promotion: defer the move until the player picks via the modal.
      // Multiple candidates with the same from/to differ only by promotion piece.
      if (candidates[0].isPromotion && !promotion) {
        setPromotionPending({ from, to, side: engine.turn() });
        return true;
      }
      const legal = promotion ? candidates.find((m) => m.promotion === promotion) : candidates[0];
      if (!legal) return false;
      const haste = hasteAt(cardState, from);
      const lightning = lightningAt(cardState, from);
      const mover = engine.pieceAt(from);
      // Snapshot the captured piece BEFORE applying the move — once the
      // engine resolves, the target square is gone or repopulated.
      const captured = engine.pieceAt(to);
      const applied = engine.move({ from, to, promotion: legal.promotion });
      if (!applied) return false;
      // Drag-drops have already visually moved the piece; only animate clicks.
      if (source !== "drag") triggerAnimation(applied.from, applied.to);

      // Single-use empowers (Patch cards) on any *other* piece die the moment
      // the player commits a chess move with someone else.
      let next = dropOtherSingleUseEmpowers(cardState, from);
      // On a capture, drop the captured piece's per-square statuses BEFORE
      // we relocate the mover's statuses onto `to`. Doing this in the wrong
      // order would clobber the mover's freshly-relocated shield/haste/etc.
      // and let opponents capture a shielded piece next turn.
      if (applied.isCapture) {
        next = clearStatusesOn(next, to);
      }
      // Statuses follow the piece.
      next = relocateStatuses(next, from, to);
      if (applied.isCapture) {
        // Capture-grants-Energy: add piece value to the player's energy pool.
        // The helper filters by side itself (only player captures grant
        // energy). In dev mode the human can drive Black, so we pass the
        // actual mover side rather than hardcoding "player".
        next = grantPatchOnCapture(next, captured, mover?.side ?? "player");
      }

      // Resolve any trap triggered by this move (player pieces are not exempt).
      if (mover) {
        next = resolveTrapForMove(engine, next, mover, applied.from, applied.to, captured);
      }

      // Boss C void: any piece ending its turn on a void square is destroyed.
      // The player's chess move just landed on `applied.to`, so destroy here.
      if (
        activeBoss?.voidSquares &&
        activeBoss.voidSquares.includes(applied.to) &&
        engine.pieceAt(applied.to)
      ) {
        engine.removePiece(applied.to);
        next = clearStatusesOn(next, applied.to);
      }

      // Boss B / Memory Leak: track player captures this turn so the start-of-turn
      // penalty knows whether to fire. Boss B modifier doesn't grant the
      // player anything on their own captures (the captured side — opponent —
      // has no energy), so no queued bonus here.
      if (mover?.side === "player" && applied.isCapture) {
        next = { ...next, capturedThisTurn: true };
      }

      // Heartbleed: track total enemy pieces captured by the player for energy scaling.
      if (mover?.side === "player" && applied.isCapture) {
        next = { ...next, playerCaptureCount: (next.playerCaptureCount ?? 0) + 1 };
      }

      // Sudo: clear after the pawn moves. If it reached the back rank, promote permanently.
      if (next.sudoSquare && from === next.sudoSquare && mover?.side === "player") {
        const destRank = Number(to.slice(1));
        const backRank = engine.size().ranks;
        if (destRank === backRank) {
          engine.removePiece(to);
          engine.placePiece(to, { type: "queen", side: "player" });
        }
        next = { ...next, sudoSquare: undefined };
      }

      // Artifact triggers — only fire on player-side moves. Capture / check
      // grants apply to the active turn so the player can spend the granted
      // energy or freshly-drawn cards before turn rollover.
      if (mover?.side === "player") {
        if (applied.isCapture) {
          const drawN = drawOnCapture(artifacts);
          if (drawN > 0) next = drawCards(next, drawN, rng);
          const energyN = energyOnCapture(artifacts);
          if (energyN > 0) next = { ...next, energy: clampEnergy(next.energy + energyN) };
        }
        // Engine flips turn after `move`, so `inCheck()` now reports whether
        // the opponent (the new side-to-move) is in check — exactly the
        // "you put them in check" trigger.
        if (engine.inCheck()) {
          const drawC = drawOnCheck(artifacts);
          if (drawC > 0) next = drawCards(next, drawC, rng);
        }
      }

      // Throttled constraint is consumed by the player's chess move that just
      // resolved. We clear the flag BEFORE firing the status-effect dispatcher
      // so an on-self-check status (Throttled) can re-set it to constrain the
      // player's NEXT chess move, not this one.
      if (mover?.side === "player" && next.mustNotCheckNextMove) {
        next = { ...next, mustNotCheckNextMove: false };
      }

      // Status effect triggers — fire AFTER the move resolves and after we've
      // consumed any single-move flag from a previous trigger. on-self-check /
      // on-self-capture / on-self-pawn-move statuses (e.g. Boss A's Throttled,
      // Boss C's Echo) take effect immediately on the new state.
      if (mover?.side === "player") {
        if (applied.isCapture) {
          next = applyStatusEffects(next, {
            kind: "capture",
            by: "player",
            turn: next.turn,
          });
        }
        if (engine.inCheck()) {
          next = applyStatusEffects(next, {
            kind: "check",
            by: "player",
            turn: next.turn,
          });
        }
        if (mover.type === "pawn") {
          next = applyStatusEffects(next, {
            kind: "pawn-move",
            by: "player",
            turn: next.turn,
          });
        }
      }

      // Haste / Lightning: grant another action by flipping the turn back.
      // Haste: the first move cannot be a capture (rule engine prevents it via
      // the disarm-overlay union). consumeHaste below removes the status, so
      // the second move has no capture restriction.
      // Both: only the FIRST move uses the second-action grant; after that we
      // flip turn normally. If the trap removed our piece, the buff is moot.
      const stillOurs = engine.pieceAt(applied.to)?.side === "player";
      let consumeAndContinue = false;
      if (stillOurs && lightning && lightning.remaining > 1) {
        next = consumeLightningAction(next, to);
        next = { ...next, continuationSquare: to };
        consumeAndContinue = true;
      } else if (stillOurs && haste) {
        next = consumeHaste(next, to);
        next = { ...next, continuationSquare: to };
        consumeAndContinue = true;
      }
      // Fork Process Power: every extra move on the budget keeps the turn
      // open after a normal player move. Decrement once per move; when the
      // budget reaches 0 the turn flips normally next time around.
      if (
        !consumeAndContinue &&
        mover?.side === "player" &&
        (next.playerExtraMovesRemaining ?? 0) > 0
      ) {
        next = {
          ...next,
          playerExtraMovesRemaining: (next.playerExtraMovesRemaining ?? 0) - 1,
        };
        consumeAndContinue = true;
      }
      // Hot Swap: after a normal player move, grant a bonus move with a
      // different piece. The hot-swap flag is consumed and the turn stays open.
      // Unlike Haste/Lightning, the bonus move is NOT locked to the same piece —
      // any non-king piece (except the one that just moved) may take the bonus.
      if (!consumeAndContinue && mover?.side === "player" && next.pendingHotSwap) {
        const swap = next.pendingHotSwap;
        if (!swap.canCapture) {
          // Disarm the player for the bonus move — it cannot capture.
          // We'll clear the disarm overlay after the bonus move resolves.
          next = {
            ...next,
            pendingHotSwap: undefined,
            // Use a special flag so we know we're in hot-swap continuation
            continuationSquare: undefined,
          };
        } else {
          next = { ...next, pendingHotSwap: undefined };
        }
        consumeAndContinue = true;
      }

      if (consumeAndContinue) {
        engine.forceTurn("player");
      } else if (cardState.continuationSquare) {
        next = { ...next, continuationSquare: undefined };
      }

      // Player's chess move ended their turn (no Haste/Lightning/extra-move
      // continuation): clear non-retained, non-curse cards from hand into the
      // discard pile *now* so the discard animation runs while the AI thinks.
      // The next `startPlayerTurn` calls discardHandAtTurnEnd again, but it's
      // a no-op once the hand has already been cleared.
      if (mover?.side === "player" && !consumeAndContinue) {
        next = discardHandAtTurnEnd(next);
      }

      setSelected(consumeAndContinue ? to : null);
      setTargetingIndex(null);
      setPartialTarget(null);
      setMarionetteMoves([]);
      bumpVersion();

      // Log the move into the history before any snapshot fires so the
      // snapshot picks up the new event and undo rewinds the log too.
      pushHistory({
        kind: "move",
        turn: next.turn,
        by: mover?.side ?? "player",
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

      // Dev panel active + AI off: the human drives Black, so the AI loop
      // never fires and we have to roll over to a fresh player turn here.
      // Otherwise just commit; sandbox additionally pushes an action-granular
      // snapshot so undo can rewind individual half-moves — but skip that push
      // when the AI is about to respond, so the rollover snapshot lands on
      // the player's next turn start (one undo == one player turn).
      if (devPanelEnabled && !devAiOn && mover?.side === "opponent" && !consumeAndContinue) {
        applyTurnRollover(next);
      } else {
        setCardState(next);
        const aiAboutToRespond = devAiOn && !consumeAndContinue && engine.turn() === AI_SIDE;
        if (runMode === "dev" && !aiAboutToRespond) pushSnapshot(next);
      }
      return true;
    },
    [
      engine,
      cardState,
      rng,
      runMode,
      devPanelEnabled,
      devAiOn,
      applyTurnRollover,
      pushSnapshot,
      pushHistory,
      artifacts,
      applyStatusEffects,
      matchRules.noPromotion,
      activeBoss,
      bumpVersion,
      setCardState,
      setSelected,
      triggerAnimation,
    ],
  );

  const cancelTargeting = useCallback(() => {
    setTargetingIndex(null);
    setPartialTarget(null);
    setMarionetteMoves([]);
    // Library free-play in flight: pop the synthesized hand[0] and restore
    // the pre-synth energy so the player isn't left with a phantom card.
    if (libraryFreePlayRef.current !== null) {
      const restoreEnergy = libraryFreePlayRef.current;
      libraryFreePlayRef.current = null;
      setLibraryFreePlayActive(false);
      setCardState((prev) => ({
        ...prev,
        hand: prev.hand.slice(1),
        energy: restoreEnergy,
      }));
    }
  }, [setCardState]);

  /**
   * Apply the side effects produced by `playCard`. Returns the (possibly
   * further-mutated) match state. Mutates the engine in place. Thin wrapper
   * over the pure `applyCardSideEffectsPure` so we can hook the revive prompt
   * into React state.
   */
  const applyCardSideEffects = useCallback(
    (result: {
      state: MatchCardState;
      sideEffects: ReadonlyArray<CardSideEffect>;
    }): MatchCardState =>
      applyCardSideEffectsPure(
        engine,
        result.state,
        result.sideEffects,
        rng,
        () => setRevivePending(true),
        (square, options) => setTransformPending({ square, options }),
      ),
    [engine, rng],
  );

  const tryResolveCard = useCallback(
    (index: number, target: PlayTarget): boolean => {
      const slot = cardState.hand[index];
      if (!slot) return false;
      const card = slot.card;
      const result = playCard(cardState, index, target, boardContext, rng, matchRules);
      if (!result.ok) return false;
      let next = applyCardSideEffects(result);

      // Library free-play: undo the energy deduction and pop the synth card
      // out of whichever pile it just landed in (consumed or discard) — it
      // was never in the player's deck. Effect-driven additions to hand /
      // draw / statuses persist — that's the whole point of testing those
      // effects via the library.
      const freePlay = libraryFreePlayRef.current;
      if (freePlay !== null) {
        next = { ...next, energy: freePlay };
        const cp = next.consumedPile;
        if (cp.length > 0 && cp[cp.length - 1].id === card.id) {
          next = { ...next, consumedPile: cp.slice(0, -1) };
        } else {
          const dp = next.discardPile;
          if (dp.length > 0 && dp[dp.length - 1].id === card.id) {
            next = { ...next, discardPile: dp.slice(0, -1) };
          }
        }
        libraryFreePlayRef.current = null;
        setLibraryFreePlayActive(false);
      }

      setCardState(next);
      setTargetingIndex(null);
      setPartialTarget(null);
      setMarionetteMoves([]);
      pushHistory({
        kind: "card-played",
        turn: next.turn,
        cardId: card.id,
        cardName: card.name,
        cost: card.cost,
        energyAfter: next.energy,
        target,
      });
      // Stack Trace: open scry modal showing the new top of deck.
      if (card.effect.kind === "scry") {
        const top = next.drawPile.slice(0, card.effect.count);
        if (top.length > 0) setScryPending({ cards: top });
      }
      // Card play may have changed the board (capture / move / new piece) —
      // make sure derived rendering re-runs.
      bumpVersion();
      // Rollback alters the chess board (an enemy piece walks back, a captured
      // piece re-spawns) and then the player still gets their chess move. We
      // push a snapshot here so Undo from the next state lands on the
      // post-Rollback board rather than rewinding all the way to the start of
      // the player's turn — the player's chess move after Rollback should be
      // independently undoable.
      const playedRollback = result.sideEffects.some((fx) => fx.kind === "undo-last-enemy-move");
      // Sandbox card-play snapshot — but skip when AI is on, since the card is
      // part of a turn cycle the AI will close out and one undo should rewind
      // the whole player turn.
      if ((runMode === "dev" && !devAiOn) || playedRollback) pushSnapshot(next);
      return true;
    },
    [
      cardState,
      boardContext,
      rng,
      applyCardSideEffects,
      runMode,
      devAiOn,
      pushSnapshot,
      pushHistory,
      matchRules,
      bumpVersion,
      setCardState,
    ],
  );

  const onCardClick = useCallback(
    (index: number) => {
      if (matchOver || aiThinking) return;
      if (mode !== "vs-ai") return;
      // Cards can only be played before the chess move — i.e. while it's the
      // player's chess turn.
      if (turn !== HUMAN_SIDE) return;
      // While a library free-play is in flight the hand indices have shifted
      // (the synth card sits at hand[0]); ignore hand clicks until it resolves
      // or is cancelled.
      if (libraryFreePlayRef.current !== null) return;
      // Bookmark targeting: when the active card asks for a hand-card target,
      // the next click on a different hand slot resolves the play.
      if (targetingIndex !== null && targetingIndex !== index) {
        const targetingSlot = cardState.hand[targetingIndex];
        if (targetingSlot && targetingSlot.card.target.kind === "hand-card") {
          tryResolveCard(targetingIndex, { kind: "hand-card", index });
          return;
        }
      }
      const slot = cardState.hand[index];
      if (!slot) return;
      const card = slot.card;
      // Toggle off if user clicks the same card they were targeting.
      if (targetingIndex === index) {
        cancelTargeting();
        return;
      }
      if (cardState.energy < card.cost) return;
      if (isCardEffectForbidden(card.effect, matchRules)) return;
      if (card.target.kind === "none") {
        tryResolveCard(index, { kind: "none" });
        return;
      }
      // Targeted card — switch into targeting mode and clear any selection.
      setSelected(null);
      setPartialTarget(null);
      setMarionetteMoves([]);
      setTargetingIndex(index);
      if (card.target.kind === "captured-friendly-piece-then-empty-square-own-half") {
        const playerCaptured = (cardState.capturedPieces ?? []).filter((p) => p.side === "player");
        if (playerCaptured.length > 0) {
          setResurrectPending(true);
        }
      }
    },
    [
      matchOver,
      aiThinking,
      mode,
      turn,
      cardState,
      targetingIndex,
      tryResolveCard,
      cancelTargeting,
      matchRules,
      setSelected,
    ],
  );

  const onCardDragStart = useCallback(
    (index: number) => {
      if (matchOver || aiThinking) return;
      if (mode !== "vs-ai") return;
      if (turn !== HUMAN_SIDE) return;
      // Library free-play in flight: the synth is at hand[0] and indices have
      // shifted; ignore drags on the regular hand until the play resolves.
      if (libraryFreePlayRef.current !== null) return;
      const slot = cardState.hand[index];
      if (!slot) return;
      const card = slot.card;
      if (cardState.energy < card.cost) return;
      if (isCardEffectForbidden(card.effect, matchRules)) return;
      // Enter targeting mode so the board highlights drop targets — this is
      // the same setup as clicking the card. For no-target cards it triggers
      // the "drop anywhere" board overlay; the drop will resolve immediately.
      setSelected(null);
      setPartialTarget(null);
      setMarionetteMoves([]);
      setTargetingIndex(index);
    },
    [matchOver, aiThinking, mode, turn, cardState, matchRules, setSelected],
  );

  const onCardDragEnd = useCallback(() => {
    // If the drop landed on a valid target, the resolver already cleared
    // targeting state. If it didn't (drop outside the board, drop on an
    // invalid square), back out of targeting so the player isn't stuck.
    setTargetingIndex(null);
    setPartialTarget(null);
    setMarionetteMoves([]);
  }, []);

  /**
   * Synthesize a library card into hand[0] for free-play. Used by dev panel.
   * - "click" + no-target card: resolves immediately via the same playCard
   *   path used by tryResolveCard, but we don't share state with React's
   *   setCardState scheduling so we duplicate the resolver inline.
   * - Otherwise: stash the synth at hand[0] and enter targeting mode.
   *   `tryResolveCard` finishes the play and reverts the synth via
   *   `libraryFreePlayRef`.
   */
  const synthesizeLibraryCard = useCallback(
    (card: Card, callMode: "click" | "drag") => {
      if (matchOver || aiThinking) return;
      if (turn !== HUMAN_SIDE) return;
      if (libraryFreePlayRef.current !== null) return;
      if (callMode === "click" && card.target.kind === "none") {
        // Resolve immediately. We don't go through tryResolveCard because its
        // closure has a stale cardState — the synth must be visible to playCard.
        const restoreEnergy = cardState.energy;
        const synth: MatchCardState = {
          ...cardState,
          hand: [{ card, retained: false }, ...cardState.hand],
          energy: Math.max(restoreEnergy, card.cost),
        };
        const result = playCard(synth, 0, { kind: "none" }, boardContext, rng);
        if (!result.ok) return;
        let next = applyCardSideEffects(result);
        next = { ...next, energy: restoreEnergy };
        const cp = next.consumedPile;
        if (cp.length > 0 && cp[cp.length - 1].id === card.id) {
          next = { ...next, consumedPile: cp.slice(0, -1) };
        } else {
          const dp = next.discardPile;
          if (dp.length > 0 && dp[dp.length - 1].id === card.id) {
            next = { ...next, discardPile: dp.slice(0, -1) };
          }
        }
        setCardState(next);
        if (card.effect.kind === "scry") {
          const top = next.drawPile.slice(0, card.effect.count);
          if (top.length > 0) setScryPending({ cards: top });
        }
        bumpVersion();
        pushSnapshot(next);
        return;
      }
      // Targeted card OR drag-of-anything — synthesize at hand[0] and enter
      // targeting mode. tryResolveCard will see libraryFreePlayRef and apply
      // the free-play patch when the resolver returns.
      libraryFreePlayRef.current = cardState.energy;
      setLibraryFreePlayActive(true);
      const synth: MatchCardState = {
        ...cardState,
        hand: [{ card, retained: false }, ...cardState.hand],
        energy: Math.max(cardState.energy, card.cost),
      };
      setCardState(synth);
      setSelected(null);
      setPartialTarget(null);
      setMarionetteMoves([]);
      setTargetingIndex(0);
    },
    [
      matchOver,
      aiThinking,
      turn,
      cardState,
      boardContext,
      rng,
      applyCardSideEffects,
      pushSnapshot,
      bumpVersion,
      setCardState,
      setSelected,
    ],
  );

  const resetCardPlay = useCallback(() => {
    setTargetingIndex(null);
    setPartialTarget(null);
    setMarionetteMoves([]);
    setScryPending(null);
    setRevivePending(false);
    setPromotionPending(null);
    libraryFreePlayRef.current = null;
    setLibraryFreePlayActive(false);
  }, []);

  return {
    targetingIndex,
    setTargetingIndex,
    partialTarget,
    setPartialTarget,
    marionetteMoves,
    setMarionetteMoves,
    scryPending,
    setScryPending,
    revivePending,
    setRevivePending,
    promotionPending,
    setPromotionPending,
    transformPending,
    setTransformPending,
    resurrectPending,
    setResurrectPending,
    libraryFreePlayActive,
    tryPlay,
    tryResolveCard,
    cancelTargeting,
    onCardClick,
    onCardDragStart,
    onCardDragEnd,
    applyCardSideEffects,
    synthesizeLibraryCard,
    resetCardPlay,
  };
}
