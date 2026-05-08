// Run shell — owns the run state machine and routes between match, reward,
// and shop phases.
//
// State management note: the run is small enough that useState is fine here.
// Architecture doc earmarks zustand for "if cross-component state grows
// painful" — the M5 mini-run touches at most three siblings (Match, Reward,
// Shop), all owned by this shell.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { BossPreview } from "./BossPreview";
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
  dismissBossPreview,
  enterShop,
  generateBossArtifactOffer,
  generateBossPickOffer,
  leaveShop,
  nextMatchSetup,
  pickBossArtifact,
  pickBossOption,
  previewBossFor,
  skipBossArtifact,
  totalMatches,
} from "../../game/progression/run";
import { applyInterest, generateShop } from "../../game/shop/shop";
import { artifactEmoji } from "../../game/artifacts/library";
import { goldOnMatchStart } from "../../game/artifacts/effects";
import type { EngineSnapshot } from "../../game/chess/engine";
import type {
  Artifact,
  BoardSize,
  BossArtifactOffer,
  BossDef,
  BossPickOffer,
  BossPickOption,
  MatchCardState,
  RunMatchOutcome,
  RunMode,
  RunState,
  Shop as ShopState,
  StatusTrigger,
} from "../../game/types";
import { getStatusEffectById } from "../../game/status/library";

import styles from "./Run.module.css";

type Props = {
  mode: RunMode;
  /** Called when the user wants to leave the run (back to menu). */
  onExit: () => void;
  /** Optional seed for deterministic runs (tests). */
  rngSeed?: number;
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

export function Run({ mode, onExit, rngSeed }: Props) {
  const [run, setRun] = useState<RunState>(() => createRun({ mode, rngSeed }));
  const [extras, setExtras] = useState<PhaseExtras>({
    shop: null,
    lastInterest: 0,
    matchSetup: null,
    bossArtifactOffer: null,
    bossArtifactGenerated: false,
    bossPickOffer: null,
    bossPickResolved: false,
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
      ascension: run.ascension,
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
      (run.phase === "reward" || run.phase === "shop" || run.phase === "boss-preview") &&
      extras.matchSetup !== null
    ) {
      setExtras((e) => ({ ...e, matchSetup: null }));
      return;
    }
    if (run.phase === "reward") {
      // The reward phase is boss-only now — non-boss wins skip it via
      // applyMatchOutcome. Resolution order: bossPick → bossArtifact → shop.
      if (!extras.bossPickResolved) {
        if (extras.bossPickOffer === null) {
          setExtras((e) => ({ ...e, bossPickOffer: generateBossPickOffer() }));
          return;
        }
        // Offer is showing — wait for the player to resolve it.
        return;
      }
      // Boss-pick may have given the player free deletion charges; gate the
      // rest of the reward step until they're spent.
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
      // Boss-artifact pick still showing — wait for the player.
      if (extras.bossArtifactOffer !== null) return;
      // All boss-reward steps resolved → advance to the shop.
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
        });
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
    // setup is cleared when the run advances into reward/shop/boss-preview.
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

  // ---- Boss preview --------------------------------------------------------

  const onDismissBossPreview = () => {
    pushRunEvent({
      kind: "boss-preview-dismissed",
      act: run.act,
      bossId: previewBossFor(run)?.id ?? null,
    });
    setRun((r) => dismissBossPreview(r));
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

  // ---- Render -------------------------------------------------------------

  const total = totalMatches(run);
  const activeBoss = run.phase === "match" ? activeBossFor(run) : null;
  const banner = useMemo(
    () => (
      <div className={styles.banner} aria-label="Run progress">
        <span className={styles.bannerSegment}>
          <span className={styles.bannerLabel}>Mode</span>
          <span className={styles.bannerValue}>{titleCase(run.mode)}</span>
        </span>
        <span className={styles.bannerSegment}>
          <span className={styles.bannerLabel}>Match</span>
          <span className={styles.bannerValue}>
            {run.matchNumber} / {total}
          </span>
        </span>
        <span className={styles.bannerSegment}>
          <span className={styles.bannerLabel}>Gold</span>
          <span className={styles.bannerValue}>{run.gold}</span>
        </span>
        <span className={styles.bannerSegment}>
          <span className={styles.bannerLabel}>Deck</span>
          <span className={styles.bannerValue}>{run.deck.length}</span>
        </span>
        {activeBoss && (
          <span
            className={`${styles.bannerSegment} ${styles.bannerBoss}`}
            tabIndex={0}
            aria-label={bossAriaLabel(activeBoss)}
          >
            <span className={styles.bannerLabel}>Boss</span>
            <span className={styles.bannerValue}>{activeBoss.name}</span>
            <span className={styles.bossTooltip} role="tooltip">
              <span className={styles.bossTooltipName}>{activeBoss.name}</span>
              <span className={styles.bossTooltipFlavor}>{activeBoss.description}</span>
              <span className={styles.bossTooltipSection}>
                <span className={styles.bossTooltipHeading}>Modifier</span>
                <span className={styles.bossTooltipText}>{activeBoss.modifierDescription}</span>
              </span>
              {(activeBoss.hazardWalls.length > 0 ||
                (activeBoss.voidSquares && activeBoss.voidSquares.length > 0) ||
                (activeBoss.zoneBuffs && activeBoss.zoneBuffs.length > 0)) && (
                <span className={styles.bossTooltipSection}>
                  <span className={styles.bossTooltipHeading}>Hazards</span>
                  <span className={styles.bossTooltipText}>{describeHazards(activeBoss)}</span>
                </span>
              )}
              <span className={styles.bossTooltipSection}>
                <span className={styles.bossTooltipHeading}>Status effects</span>
                {activeBoss.statusEffects.length === 0 ? (
                  <span className={styles.bossTooltipText}>None.</span>
                ) : (
                  <ul className={styles.bossTooltipCurseList}>
                    {activeBoss.statusEffects.map((id, i) => {
                      const def = safeLookupStatus(id);
                      return (
                        <li key={`${id}-${i}`} className={styles.bossTooltipCurse}>
                          <span className={styles.bossTooltipCurseTrigger}>
                            {def ? describeTrigger(def.trigger) : ""}
                          </span>
                          <span className={styles.bossTooltipCurseName}>{def?.name ?? id}</span>
                          {def && (
                            <span className={styles.bossTooltipCurseDesc}>{def.description}</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </span>
            </span>
          </span>
        )}
        {run.artifacts.length > 0 && (
          <span
            className={styles.bannerArtifacts}
            aria-label={`Artifacts (${run.artifacts.length})`}
          >
            {run.artifacts.map((a, i) => (
              <span
                key={`${a.id}-${i}`}
                className={`${styles.artifactBadge} ${rarityClass(a.rarity)}`}
                tabIndex={0}
                aria-label={`${a.name}: ${a.description}`}
              >
                <span aria-hidden="true">{artifactEmoji(a.id)}</span>
                <span className={styles.artifactTooltip} role="tooltip">
                  <span className={styles.artifactTooltipName}>{a.name}</span>
                  <span className={styles.artifactTooltipDesc}>{a.description}</span>
                </span>
              </span>
            ))}
          </span>
        )}
        {extras.lastInterest > 0 && run.phase === "match" && (
          <span className={styles.bannerInterest}>+{extras.lastInterest} interest</span>
        )}
        <button
          type="button"
          onClick={() => setHistoryOpen(true)}
          className={styles.log}
          title="Show / export run log"
          aria-label="Show run log"
        >
          Log ({runHistory.length})
        </button>
        <button type="button" onClick={onExit} className={styles.quit}>
          Quit run
        </button>
      </div>
    ),
    [
      run.mode,
      run.matchNumber,
      run.gold,
      run.deck.length,
      run.artifacts,
      run.phase,
      total,
      activeBoss,
      extras.lastInterest,
      onExit,
      runHistory.length,
    ],
  );

  return (
    <div className={styles.run}>
      {banner}
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
            activeBoss={activeBossFor(run)}
            onMatchEnd={onMatchEnd}
            onCaptureFinalSnapshot={onCaptureFinalSnapshot}
            onRevertMatchEnd={onRevertMatchEnd}
            onAppendHistory={onAppendHistory}
            endOfRunPanel={
              run.phase === "won" || run.phase === "lost" ? (
                <RunSummary run={run} outcome={extras.finalOutcome?.outcome} onExit={onExit} />
              ) : extras.pendingWin ? (
                <MatchWonPanel run={run} outcome={extras.pendingWin} onContinue={onConfirmWin} />
              ) : undefined
            }
          />
        )}
      {run.phase === "boss-preview" && previewBossFor(run) && (
        <BossPreview boss={previewBossFor(run)!} onContinue={onDismissBossPreview} />
      )}
      {run.phase === "reward" && (
        <Reward
          run={run}
          bossArtifactOffer={extras.bossArtifactOffer}
          bossPickOffer={extras.bossPickOffer}
          onPickBossArtifact={onPickBossArtifact}
          onSkipBossArtifact={onSkipBossArtifact}
          onPickBossOption={onPickBossOption}
          onDeleteDeckCard={onDeleteDeckCard}
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

function titleCase(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}

function rarityClass(rarity: Artifact["rarity"]): string {
  if (rarity === "rare") return styles.rare;
  if (rarity === "uncommon") return styles.uncommon;
  return styles.common;
}

function describeHazards(boss: BossDef): string {
  const parts: string[] = [];
  if (boss.hazardWalls.length > 0) {
    parts.push(`Indestructible walls on ${boss.hazardWalls.join(", ")}.`);
  }
  if (boss.voidSquares && boss.voidSquares.length > 0) {
    parts.push(`Void at ${boss.voidSquares.join(", ")} (any piece ending there is destroyed).`);
  }
  if (boss.zoneBuffs && boss.zoneBuffs.length > 0) {
    for (const b of boss.zoneBuffs) {
      const where =
        b.region.kind === "rank"
          ? `rank ${b.region.rank}`
          : b.region.kind === "center"
            ? "the center"
            : b.region.anchor;
      const fx =
        b.buff.kind === "energy-per-turn"
          ? `+${b.buff.amount} energy/turn`
          : `+${b.buff.amount} hand size`;
      parts.push(`Boss-side zone-buff at ${where}: ${fx} while contested.`);
    }
  }
  return parts.join(" ");
}

function describeTrigger(t: StatusTrigger): string {
  switch (t.kind) {
    case "turn-start":
      return "Turn start";
    case "every-n-turns":
      return `Every ${t.n} turns`;
    case "on-self-check":
      return "When you check";
    case "on-self-capture":
      return "When you capture";
    case "on-opponent-capture":
      return "When the boss captures";
    case "on-self-pawn-move":
      return "When you move a pawn";
  }
}

function safeLookupStatus(id: string) {
  try {
    return getStatusEffectById(id);
  } catch {
    return null;
  }
}

function bossAriaLabel(boss: BossDef): string {
  const parts: string[] = [`Boss: ${boss.name}`, boss.description];
  parts.push(`Modifier: ${boss.modifierDescription}`);
  const hazards = describeHazards(boss);
  if (hazards.length > 0) {
    parts.push(`Hazards: ${hazards}`);
  }
  if (boss.statusEffects.length === 0) {
    parts.push("No status effects.");
  } else {
    const statusDescriptions = boss.statusEffects
      .map((id) => {
        const def = safeLookupStatus(id);
        const name = def?.name ?? id;
        const desc = def ? ` — ${def.description}` : "";
        return `${def ? describeTrigger(def.trigger) : ""}: ${name}${desc}`;
      })
      .join("; ");
    parts.push(`Status effects: ${statusDescriptions}`);
  }
  return parts.join(". ");
}
