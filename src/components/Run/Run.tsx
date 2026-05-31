// Run shell — owns the run state machine and routes between match, reward,
// and shop phases.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Match } from "../Match";
import { MatchWonPanel } from "./MatchWonPanel";
import { Reward } from "./Reward";
import { RunHistoryModal } from "./RunHistoryModal";
import { Shop, type ShopAction } from "./Shop";
import { artifactIds, deckIds, summarizeOffer, type RunHistoryEvent } from "./runHistory";
import type { HistoryEvent } from "../Match/history";
import { RunSummary } from "./RunSummary";
import {
  activeBossFor,
  applyMatchOutcome,
  consumeBossDeleteCharge,
  createRun,
  enterShop,
  generateBossArtifactOffer,
  generateBossPickOffer,
  isBossMatch,
  leaveShop,
  nextMatchSetup,
  pickBossArtifact,
  pickBossOption,
  skipBossArtifact,
} from "../../game/progression/run";
import {
  draftPiece,
  generatePieceDraftOffer,
  skipPieceDraft,
  skirmishBoardSize,
  PIECE_SKIP_GOLD,
} from "../../game/progression/skirmish";
import { buildSkirmishFen, emptyBoardFen } from "../../game/progression/placement";
import { resolvePieceSet, standardMatchConfig } from "../../game/progression/standard";
import { aiStrengthForMatch } from "../../game/progression/aiStrength";
import { makeRng } from "../../game/cards/match";
import { applyInterest, generateShop } from "../../game/shop/shop";
import { goldOnMatchStart } from "../../game/artifacts/effects";
import type { EngineSnapshot } from "../../game/chess/engine";
import type {
  Artifact,
  BoardSize,
  BossArtifactOffer,
  BossPickOffer,
  BossPickOption,
  Card,
  MatchCardState,
  PieceDraftOffer,
  PieceType,
  RunMatchOutcome,
  RunMode,
  RunState,
  Shop as ShopState,
} from "../../game/types";

import styles from "./Run.module.css";

type Props = {
  mode: RunMode;
  /** Called when the user wants to leave the run (back to menu). */
  onExit: () => void;
  /** Optional seed for deterministic runs (tests). */
  rngSeed?: number;
  /**
   * Override the run's starting deck. Used by the pre-game draft flow to
   * hand a pre-made or freshly-drafted deck to the run shell. When omitted,
   * `createRun` falls back to `makeStarterDeck()`.
   */
  startingDeck?: Card[];
  /**
   * Override the run's starting artifact ids. Used by the pre-game draft
   * flow to bundle a themed artifact with a pre-made deck or hand a drafted
   * artifact to the run shell. When omitted, `createRun` uses the per-mode
   * default (Polished Bishop in standard mode).
   */
  startingArtifactIds?: string[];
  /** App-level palette state — surfaced inside Match's ticker. */
  palette?: import("../../state/palette").PaletteId;
  onPaletteChange?: (p: import("../../state/palette").PaletteId) => void;
  /** App-level vision state — drives the board-vision overlay. */
  vision?: boolean;
  onToggleVision?: () => void;
  /** App-level threat-highlight state — drives the piece-threat overlay. */
  threats?: boolean;
  onToggleThreats?: () => void;
};

/**
 * Phase-local state held alongside the run. Generated when entering the
 * phase so reroll / re-show transitions don't accidentally reuse a stale
 * offer that was meant for the previous match.
 */
type PhaseExtras = {
  shop: ShopState | null;
  /** Last-tally interest amount, shown briefly on the next match's banner. */
  lastInterest: number;
  /**
   * Per-match setup: starting FEN and board size. Re-derived when the run
   * enters a "match" phase so Standard's variable board / Chess960 setup
   * actually lands in <Match>. Royal / mini-run keep this null and let
   * <Match> default to the standard 8x8 chess opening.
   */
  matchSetup: { fen?: string; size: BoardSize } | null;
  /**
   * Boss artifact offer for the current reward step. Populated when the
   * just-finished match was a boss; null after the player picks or skips.
   */
  bossArtifactOffer: BossArtifactOffer | null;
  /**
   * True once the boss artifact offer has been generated for this reward
   * step (so the effect doesn't keep regenerating after the player resolves
   * it). Reset when the run leaves the reward phase.
   */
  bossArtifactGenerated: boolean;
  /**
   * Boss-pick (Monster-Train-style 3 options) for the current reward step.
   * Populated on a boss win; null once the player resolves it. Resolution
   * order: bossPick → bossArtifact → shop.
   */
  bossPickOffer: BossPickOffer | null;
  /**
   * True once the boss-pick has been resolved for this reward step. Energy /
   * draw boons resolve immediately; the delete-cards boon stays in-progress
   * until `run.bossDeleteCharges` is exhausted.
   */
  bossPickResolved: boolean;
  /**
  /**
   * Skirmish piece-draft offer for the current reward step. Generated on
   * reward-phase entry; null once the player picks or skips.
   */
  pieceDraftOffer: PieceDraftOffer | null;
  pieceDraftGenerated: boolean;
  /**
   * Held while the player reviews the just-finished match's final position
   * after a win. The phase stays at `"match"` so `<Match>` keeps its engine
   * state mounted; the win panel replaces the side panel and the player
   * advances to reward via the Continue button (`applyMatchOutcome`).
   */
  pendingWin: RunMatchOutcome | null;
  /**
   * Outcome of the most recent match — kept around past `onMatchEnd` so the
   * end-of-run screen can show *why* the run ended (checkmate / stalemate /
   * draw). Cleared when the run advances into a new match.
   */
  finalOutcome: RunMatchOutcome | null;
  /**
   * Full engine + card-system snapshot of the just-finished match's final
   * state. Captured via `onCaptureFinalSnapshot` so that even after reward /
   * shop unmount the live `<Match>`, the run-complete screen can re-mount a
   * faithful display-only board (board, walls, freezes, traps, sanctuaries,
   * zone buffs, capture trays — everything the live match was rendering).
   */
  finalSnapshot: {
    engineSnapshot: EngineSnapshot;
    cardState: MatchCardState;
    size: BoardSize;
  } | null;
};

export function Run({
  mode,
  onExit,
  rngSeed,
  startingDeck,
  startingArtifactIds,
  palette,
  onPaletteChange,
  vision,
  onToggleVision,
  threats,
  onToggleThreats,
}: Props) {
  const [run, setRun] = useState<RunState>(() =>
    createRun({ mode, rngSeed, startingDeck, startingArtifacts: startingArtifactIds }),
  );
  const [extras, setExtras] = useState<PhaseExtras>({
    shop: null,
    lastInterest: 0,
    matchSetup: null,
    bossArtifactOffer: null,
    bossArtifactGenerated: false,
    bossPickOffer: null,
    bossPickResolved: false,
    pieceDraftOffer: null,
    pieceDraftGenerated: false,
    pendingWin: null,
    finalSnapshot: null,
    finalOutcome: null,
  });

  // Run-level event log — covers every shell transition (match-start,
  // match-end, shop transactions, reward picks) plus all per-match events
  // forwarded from <Match> via `onAppendHistory`. The ref is the canonical
  // source so callbacks can append synchronously without reading stale state;
  // a parallel useState mirror drives modal re-renders.
  const runHistoryRef = useRef<RunHistoryEvent[]>([]);
  const [runHistory, setRunHistory] = useState<RunHistoryEvent[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  const pushRunEvent = useCallback((event: RunHistoryEvent) => {
    const next = [...runHistoryRef.current, event];
    runHistoryRef.current = next;
    setRunHistory(next);
  }, []);

  // Seed the run-start event once. We capture the run's seed + starting deck
  // + starting artifacts so a replayer has everything it needs to reconstruct
  // the run from scratch.
  const runStartLoggedRef = useRef(false);
  useEffect(() => {
    if (runStartLoggedRef.current) return;
    runStartLoggedRef.current = true;
    pushRunEvent({
      kind: "run-start",
      mode: run.mode,
      rngSeed: run.rngSeed,
      startingDeckIds: deckIds(run.deck),
      startingArtifactIds: artifactIds(run.artifacts),
    });
    // Run is captured by the closure; we only ever fire this once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // De-dup match-start logging — the matchSetup useEffect can run twice in
  // strict mode and we don't want a duplicate event per match.
  const lastMatchStartLoggedRef = useRef<number>(-1);
  // De-dup shop-enter logging similarly: the shop-generation useEffect can
  // re-fire once after entering the shop phase.
  const lastShopEnterLoggedRef = useRef<number>(-1);

  // Forwarded by <Match>; tag each per-match event with the current match
  // number so a single export can reconstruct what happened across the run.
  // We read matchNumber off the live run state — pushHistory inside Match
  // fires from React event handlers, so by the time the callback runs the
  // current match is whichever the run shell is showing.
  const matchNumberRef = useRef(run.matchNumber);
  useEffect(() => {
    matchNumberRef.current = run.matchNumber;
  }, [run.matchNumber]);

  const onAppendHistory = useCallback(
    (event: HistoryEvent) => {
      pushRunEvent({
        kind: "match-event",
        matchNumber: matchNumberRef.current,
        event,
      });
    },
    [pushRunEvent],
  );

  // Lazy-generate the draft / shop on phase entry. The phase transitions
  // happen via setRun(...) and the new state lands here as a fresh `run`;
  // we mirror that into `extras` so the phase UI has its prepared content.
  useEffect(() => {
    // Drop the previous match's setup once we've left the match — the next
    // "match" entry will regenerate a fresh starting position. We keep it
    // alive through "lost"/"won" so Match can stay mounted there.
    if (
      (run.phase === "reward" || run.phase === "shop" || run.phase === "placement") &&
      extras.matchSetup !== null
    ) {
      setExtras((e) => ({ ...e, matchSetup: null }));
      return;
    }
    if (run.phase === "reward") {
      // Skirmish: piece draft comes first — generate offer, wait for resolution.
      if (run.mode === "skirmish" && !extras.pieceDraftGenerated) {
        const { offer, next } = generatePieceDraftOffer(run);
        setExtras((e) => ({ ...e, pieceDraftOffer: offer, pieceDraftGenerated: true }));
        setRun(next);
        return;
      }
      if (extras.pieceDraftOffer !== null) return;
      // Non-boss Skirmish wins: piece draft was the only reward → shop.
      if (!isBossMatch(run)) {
        setRun((r) => enterShop(r));
        return;
      }
      // Boss reward flow: bossPick → bossArtifact → shop.
      if (!extras.bossPickResolved) {
        if (extras.bossPickOffer === null) {
          setExtras((e) => ({ ...e, bossPickOffer: generateBossPickOffer() }));
          return;
        }
        return;
      }
      if ((run.bossDeleteCharges ?? 0) > 0) return;
      if (!extras.bossArtifactGenerated) {
        const { offer, next } = generateBossArtifactOffer(run);
        setExtras((e) => ({
          ...e,
          bossArtifactOffer: offer.artifacts.length > 0 ? offer : null,
          bossArtifactGenerated: true,
        }));
        setRun(next);
        return;
      }
      if (extras.bossArtifactOffer !== null) return;
      setRun((r) => enterShop(r));
      return;
    }
    if (run.phase === "shop" && extras.shop === null) {
      const { shop, next } = generateShop(run);
      setExtras((e) => ({ ...e, shop }));
      setRun(next);
      if (lastShopEnterLoggedRef.current !== next.matchNumber) {
        lastShopEnterLoggedRef.current = next.matchNumber;
        pushRunEvent({
          kind: "shop-enter",
          matchNumber: next.matchNumber,
          gold: next.gold,
          offers: shop.offers.map(summarizeOffer),
          rerollCost: shop.rerollCost,
          removalCost: shop.removalCost,
          smithCost: shop.smithCost,
        });
      }
      return;
    }
    if (run.phase === "placement") {
      // Skirmish placement phase — stale state cleanup, same as match entry.
      if (
        extras.shop !== null ||
        extras.bossArtifactGenerated ||
        extras.pieceDraftGenerated ||
        extras.finalSnapshot !== null ||
        extras.finalOutcome !== null
      ) {
        setExtras((e) => ({
          ...e,
          shop: null,
          bossArtifactOffer: null,
          bossArtifactGenerated: false,
          bossPickOffer: null,
          bossPickResolved: false,
          pieceDraftOffer: null,
          pieceDraftGenerated: false,
          finalSnapshot: null,
          finalOutcome: null,
        }));
      }
      return;
    }
    if (run.phase === "match") {
      // Stale shop / boss-reward state from previous round must not leak into
      // the next entry to that phase — drop them as we leave them behind.
      if (
        extras.shop !== null ||
        extras.bossArtifactGenerated ||
        extras.bossArtifactOffer !== null ||
        extras.bossPickOffer !== null ||
        extras.bossPickResolved ||
        extras.pieceDraftGenerated ||
        extras.finalSnapshot !== null ||
        extras.finalOutcome !== null
      ) {
        setExtras((e) => ({
          ...e,
          shop: null,
          bossArtifactOffer: null,
          bossArtifactGenerated: false,
          bossPickOffer: null,
          bossPickResolved: false,
          pieceDraftOffer: null,
          pieceDraftGenerated: false,
          finalSnapshot: null,
          finalOutcome: null,
        }));
      }
      // Generate a per-match starting position the first time we land on
      // this match. Standard mode produces a Chess960-style position sized
      // for the current match; Royal / mini-run leave fen undefined so
      // <Match> uses the standard chess opening. We also tally the
      // gold-on-match-start artifact effect on this same entry — once per
      // match, before the player can spend in the shop.
      if (extras.matchSetup === null) {
        const { fen, size, next } = nextMatchSetup(run);
        const matchStartGold = goldOnMatchStart(next.artifacts);
        const finalRun = matchStartGold > 0 ? { ...next, gold: next.gold + matchStartGold } : next;
        setRun(finalRun);
        setExtras((e) => ({ ...e, matchSetup: { fen, size } }));
        if (lastMatchStartLoggedRef.current !== finalRun.matchNumber) {
          lastMatchStartLoggedRef.current = finalRun.matchNumber;
          const boss = activeBossFor(finalRun);
          pushRunEvent({
            kind: "match-start",
            matchNumber: finalRun.matchNumber,
            act: finalRun.act,
            matchInAct: finalRun.matchInAct,
            fen,
            size,
            deckIds: deckIds(finalRun.deck),
            artifactIds: artifactIds(finalRun.artifacts),
            bossId: boss?.id ?? null,
            goldAtStart: finalRun.gold,
          });
        }
      }
    }
  }, [
    run,
    extras.shop,
    extras.matchSetup,
    extras.bossArtifactOffer,
    extras.bossArtifactGenerated,
    extras.bossPickOffer,
    extras.bossPickResolved,
    extras.pieceDraftOffer,
    extras.pieceDraftGenerated,
    extras.finalSnapshot,
    extras.finalOutcome,
    pushRunEvent,
  ]);

  // ---- Match phase --------------------------------------------------------

  const onMatchEnd = (outcome: RunMatchOutcome) => {
    pushRunEvent({
      kind: "match-end",
      matchNumber: matchNumberRef.current,
      won: outcome.won,
      outcome: outcome.outcome,
      turnsPlayed: outcome.turnsPlayed,
    });
    if (outcome.won) {
      // Pause on the final position so the player can review the win and
      // confirm before the reward step takes over the screen. The phase
      // stays "match" until they hit Continue in the win panel.
      setExtras((e) => ({ ...e, pendingWin: outcome, finalOutcome: outcome }));
      return;
    }
    setRun((r) => applyMatchOutcome(r, outcome));
    setExtras((e) => ({ ...e, finalOutcome: outcome }));
    // Keep matchSetup populated here so Match stays mounted through "lost" —
    // the player sees the final board with the run summary alongside. The
    // setup is cleared when the run advances into reward/shop.
  };

  const onCaptureFinalSnapshot = (snap: {
    engineSnapshot: EngineSnapshot;
    cardState: MatchCardState;
    size: BoardSize;
  }) => {
    setExtras((e) => ({ ...e, finalSnapshot: snap }));
  };

  // Dev-panel rewind past match-end: undo the run-side mirror of `onMatchEnd`
  // so the player can retry the losing line. `lost` reverts to `match`;
  // pendingWin (a yet-to-be-confirmed win) and the captured final snapshot
  // both clear so a redo can re-fire them cleanly.
  const onRevertMatchEnd = () => {
    pushRunEvent({ kind: "revert-match-end", matchNumber: matchNumberRef.current });
    setExtras((e) => ({ ...e, pendingWin: null, finalSnapshot: null, finalOutcome: null }));
    setRun((r) => (r.phase === "lost" ? { ...r, phase: "match" } : r));
  };

  const onConfirmWin = () => {
    if (!extras.pendingWin) return;
    pushRunEvent({ kind: "match-win-confirmed", matchNumber: matchNumberRef.current });
    const outcome = extras.pendingWin;
    setRun((r) => applyMatchOutcome(r, outcome));
    setExtras((e) => ({ ...e, pendingWin: null }));
  };

  // ---- Piece draft handlers (Skirmish) ------------------------------------

  const onPickPiece = (pieceType: PieceType) => {
    setRun((r) => draftPiece(r, pieceType));
    setExtras((e) => ({ ...e, pieceDraftOffer: null }));
  };

  const onSkipPieceDraft = () => {
    setRun((r) => skipPieceDraft(r, PIECE_SKIP_GOLD));
    setExtras((e) => ({ ...e, pieceDraftOffer: null }));
  };

  // ---- Placement skip (Skirmish dev panel) -----------------------------------

  const onPlacementMatchEnd = useCallback(
    (outcome: RunMatchOutcome) => {
      pushRunEvent({
        kind: "match-end",
        matchNumber: matchNumberRef.current,
        won: outcome.won,
        outcome: outcome.outcome,
        turnsPlayed: outcome.turnsPlayed,
      });
      setRun((r) => applyMatchOutcome(r, outcome));
      setExtras((e) => ({ ...e, finalOutcome: outcome }));
    },
    [pushRunEvent],
  );

  // ---- Placement handler (Skirmish) -----------------------------------------

  const onPlacementConfirm = (backRank: (PieceType | null)[], pawnFiles: boolean[]) => {
    const size = skirmishBoardSize(run.matchNumber);
    const boss = activeBossFor(run);
    const rng = makeRng(run.rngSeed + run.rngCursor + run.matchNumber);
    let aiPieceSet = undefined;
    if (boss) {
      const cfg = standardMatchConfig(run.matchNumber);
      aiPieceSet = resolvePieceSet(cfg, rng);
    }
    const fen = buildSkirmishFen(backRank, pawnFiles, size, rng, aiPieceSet);
    const matchStartGold = goldOnMatchStart(run.artifacts);
    if (matchStartGold > 0) {
      setRun((r) => ({ ...r, gold: r.gold + matchStartGold }));
    }
    setExtras((e) => ({ ...e, matchSetup: { fen, size } }));
    setRun((r) => ({ ...r, phase: "match" }));
  };

  // ---- Boss reward handlers ----------------------------------------------

  const onPickBossArtifact = (artifact: Artifact) => {
    pushRunEvent({
      kind: "boss-artifact-pick",
      matchNumber: matchNumberRef.current,
      artifactId: artifact.id,
    });
    setRun((r) => pickBossArtifact(r, artifact));
    setExtras((e) => ({ ...e, bossArtifactOffer: null }));
  };

  const onSkipBossArtifact = () => {
    if (!extras.bossArtifactOffer) return;
    const skipGold = extras.bossArtifactOffer.skipGold;
    pushRunEvent({
      kind: "boss-artifact-skip",
      matchNumber: matchNumberRef.current,
      skipGold,
    });
    setRun((r) => skipBossArtifact(r, skipGold));
    setExtras((e) => ({ ...e, bossArtifactOffer: null }));
  };

  const onPickBossOption = (option: BossPickOption) => {
    pushRunEvent({
      kind: "boss-pick",
      matchNumber: matchNumberRef.current,
      option,
    });
    setRun((r) => pickBossOption(r, option));
    setExtras((e) => ({ ...e, bossPickOffer: null, bossPickResolved: true }));
  };

  const onDeleteDeckCard = (deckIndex: number) => {
    const card = run.deck[deckIndex];
    setRun((r) => {
      const next = consumeBossDeleteCharge(r, deckIndex);
      if (next && card) {
        pushRunEvent({
          kind: "boss-delete-card",
          matchNumber: matchNumberRef.current,
          deckIndex,
          cardId: card.id,
          chargesRemaining: next.bossDeleteCharges ?? 0,
        });
      }
      return next ?? r;
    });
  };

  // ---- Shop phase ---------------------------------------------------------

  const onShopUpdate = (next: { state: RunState; shop: ShopState }) => {
    setRun(next.state);
    setExtras((e) => ({ ...e, shop: next.shop }));
  };

  const onShopAction = (action: ShopAction) => {
    // We log against the freshly-updated state — `setRun` from `onShopUpdate`
    // already fired by the time React calls us. Read from the run ref via
    // the latest render-time `run` (closure-captured); this is fine because
    // every onShopUpdate triggers a re-render before the next user action.
    switch (action.kind) {
      case "buy-card":
        pushRunEvent({
          kind: "shop-buy-card",
          matchNumber: matchNumberRef.current,
          offerIndex: action.offerIndex,
          cardId: action.card.id,
          pricePaid: action.pricePaid,
          goldAfter: run.gold - action.pricePaid,
        });
        return;
      case "buy-artifact":
        pushRunEvent({
          kind: "shop-buy-artifact",
          matchNumber: matchNumberRef.current,
          offerIndex: action.offerIndex,
          artifactId: action.artifact.id,
          pricePaid: action.pricePaid,
          goldAfter: run.gold - action.pricePaid,
        });
        return;
      case "open-pack":
        pushRunEvent({
          kind: "shop-open-pack",
          matchNumber: matchNumberRef.current,
          offerIndex: action.offerIndex,
          packId: action.pack.id,
          contentIds: action.pack.contents.map((c) => c.id),
          pricePaid: action.pricePaid,
          goldAfter: run.gold - action.pricePaid,
        });
        return;
      case "pick-pack-card":
        pushRunEvent({
          kind: "shop-pick-pack-card",
          matchNumber: matchNumberRef.current,
          cardId: action.card.id,
        });
        return;
      case "reroll":
        pushRunEvent({
          kind: "shop-reroll",
          matchNumber: matchNumberRef.current,
          cost: action.cost,
          goldAfter: run.gold - action.cost,
          offers: action.newOffers.map(summarizeOffer),
        });
        return;
      case "remove-card":
        pushRunEvent({
          kind: "shop-remove-card",
          matchNumber: matchNumberRef.current,
          deckIndex: action.deckIndex,
          cardId: action.card.id,
          pricePaid: action.pricePaid,
          goldAfter: run.gold - action.pricePaid,
        });
        return;
      case "smith-card":
        pushRunEvent({
          kind: "shop-smith-card",
          matchNumber: matchNumberRef.current,
          deckIndex: action.deckIndex,
          fromCardId: action.fromCard.id,
          toCardId: action.toCard.id,
          pricePaid: action.pricePaid,
          goldAfter: run.gold - action.pricePaid,
        });
        return;
    }
  };

  const onLeaveShop = () => {
    setRun((r) => {
      const { state, interest } = applyInterest(r);
      setExtras((e) => ({ ...e, shop: null, lastInterest: interest }));
      pushRunEvent({
        kind: "shop-leave",
        matchNumber: r.matchNumber,
        interest,
        goldAfter: state.gold,
      });
      return leaveShop(state);
    });
  };

  // Per-match engine strength (CH-031): scaled by match number so the AI ramps
  // across the run instead of sitting at a flat depth 6.
  const aiStrength = useMemo(() => aiStrengthForMatch(run.matchNumber), [run.matchNumber]);

  // ---- Render -------------------------------------------------------------

  return (
    <div className={styles.run}>
      {(run.phase === "match" || run.phase === "lost" || run.phase === "won") &&
        extras.matchSetup && (
          <Match
            // Re-mount each match so the engine + card state both reset cleanly.
            key={`m-${run.matchNumber}`}
            runMode="run"
            initialDeck={run.deck.slice()}
            initialArtifacts={run.artifacts}
            onSaveArtifacts={(artifacts) => setRun((r) => ({ ...r, artifacts: artifacts.slice() }))}
            onLoadDeck={(deck) => setRun((r) => ({ ...r, deck: deck.slice() }))}
            initialFen={extras.matchSetup.fen}
            initialBoardSize={extras.matchSetup.size}
            aiStrength={aiStrength}
            activeBoss={activeBossFor(run)}
            onMatchEnd={onMatchEnd}
            onCaptureFinalSnapshot={onCaptureFinalSnapshot}
            onRevertMatchEnd={onRevertMatchEnd}
            onAppendHistory={onAppendHistory}
            runState={run}
            lastInterest={extras.lastInterest}
            palette={palette}
            onPaletteChange={onPaletteChange}
            vision={vision}
            onToggleVision={onToggleVision}
            threats={threats}
            onToggleThreats={onToggleThreats}
            onShowRunLog={() => setHistoryOpen(true)}
            runLogCount={runHistory.length}
            onExit={onExit}
            endOfRunPanel={
              run.phase === "won" || run.phase === "lost" ? (
                <RunSummary run={run} outcome={extras.finalOutcome?.outcome} onExit={onExit} />
              ) : extras.pendingWin ? (
                <MatchWonPanel run={run} outcome={extras.pendingWin} onContinue={onConfirmWin} />
              ) : undefined
            }
          />
        )}
      {run.phase === "placement" && run.roster && (
        <Match
          key={`placement-${run.matchNumber}`}
          runMode="run"
          initialDeck={[]}
          initialArtifacts={run.artifacts}
          initialFen={emptyBoardFen(skirmishBoardSize(run.matchNumber))}
          initialBoardSize={skirmishBoardSize(run.matchNumber)}
          onMatchEnd={onPlacementMatchEnd}
          runState={run}
          palette={palette}
          onPaletteChange={onPaletteChange}
          vision={vision}
          onToggleVision={onToggleVision}
          threats={threats}
          onToggleThreats={onToggleThreats}
          onShowRunLog={() => setHistoryOpen(true)}
          runLogCount={runHistory.length}
          onExit={onExit}
          placementConfig={{
            roster: run.roster,
            boardSize: skirmishBoardSize(run.matchNumber),
            matchNumber: run.matchNumber,
            onConfirm: onPlacementConfirm,
          }}
        />
      )}
      {run.phase === "reward" && (
        <Reward
          run={run}
          bossArtifactOffer={extras.bossArtifactOffer}
          bossPickOffer={extras.bossPickOffer}
          pieceDraftOffer={extras.pieceDraftOffer}
          onPickBossArtifact={onPickBossArtifact}
          onSkipBossArtifact={onSkipBossArtifact}
          onPickBossOption={onPickBossOption}
          onDeleteDeckCard={onDeleteDeckCard}
          onPickPiece={onPickPiece}
          onSkipPieceDraft={onSkipPieceDraft}
        />
      )}
      {run.phase === "shop" && extras.shop && (
        <Shop
          run={run}
          shop={extras.shop}
          onUpdate={onShopUpdate}
          onLeave={onLeaveShop}
          onAction={onShopAction}
        />
      )}
      {run.phase === "won" && !extras.matchSetup && extras.finalSnapshot && (
        <Match
          // Distinct key from the live Match so React mounts a fresh instance
          // for the display-only snapshot.
          key={`m-${run.matchNumber}-snapshot`}
          runMode="run"
          initialBoardSize={extras.finalSnapshot.size}
          initialEngineSnapshot={extras.finalSnapshot.engineSnapshot}
          initialCardState={extras.finalSnapshot.cardState}
          displayOnly
          endOfRunPanel={
            <RunSummary run={run} outcome={extras.finalOutcome?.outcome} onExit={onExit} />
          }
        />
      )}
      {(run.phase === "won" || run.phase === "lost") &&
        !extras.matchSetup &&
        !(run.phase === "won" && extras.finalSnapshot) && (
          <RunSummary run={run} outcome={extras.finalOutcome?.outcome} onExit={onExit} />
        )}
      {historyOpen && <RunHistoryModal events={runHistory} onClose={() => setHistoryOpen(false)} />}
    </div>
  );
}
