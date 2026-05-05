// Run shell — owns the run state machine and routes between match, reward,
// and shop phases.
//
// State management note: the run is small enough that useState is fine here.
// Architecture doc earmarks zustand for "if cross-component state grows
// painful" — the M5 mini-run touches at most three siblings (Match, Reward,
// Shop), all owned by this shell.

import { useEffect, useMemo, useState } from "react";

import { ArtifactSidebar } from "./ArtifactSidebar";
import { BossPreview } from "./BossPreview";
import { Match } from "../Match";
import { Reward } from "./Reward";
import { Shop } from "./Shop";
import { RunSummary } from "./RunSummary";
import {
  activeBossFor,
  applyMatchOutcome,
  createRun,
  dismissBossPreview,
  enterShop,
  generateBossArtifactOffer,
  generateDraftOffer,
  isBossMatch,
  leaveShop,
  nextMatchSetup,
  pickBossArtifact,
  pickDraftCard,
  previewBossFor,
  skipBossArtifact,
  skipDraft,
  totalMatches,
} from "../../game/progression/run";
import { applyInterest, generateShop } from "../../game/shop/shop";
import { goldOnMatchStart } from "../../game/artifacts/effects";
import type {
  Artifact,
  BoardSize,
  BossArtifactOffer,
  Card,
  DraftOffer,
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
};

/**
 * Phase-local state held alongside the run. Generated when entering the
 * phase so reroll / re-show transitions don't accidentally reuse a stale
 * offer that was meant for the previous match.
 */
type PhaseExtras = {
  draftOffer: DraftOffer | null;
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
   * Reward UI shows the artifact picker first, then the regular card draft.
   */
  bossArtifactOffer: BossArtifactOffer | null;
  /**
   * True once the boss artifact offer has been generated for this reward
   * step (so the effect doesn't keep regenerating after the player resolves
   * it). Reset when the run leaves the reward phase.
   */
  bossArtifactGenerated: boolean;
};

export function Run({ mode, onExit, rngSeed }: Props) {
  const [run, setRun] = useState<RunState>(() => createRun({ mode, rngSeed }));
  const [extras, setExtras] = useState<PhaseExtras>({
    draftOffer: null,
    shop: null,
    lastInterest: 0,
    matchSetup: null,
    bossArtifactOffer: null,
    bossArtifactGenerated: false,
  });

  // Lazy-generate the draft / shop on phase entry. The phase transitions
  // happen via setRun(...) and the new state lands here as a fresh `run`;
  // we mirror that into `extras` so the phase UI has its prepared content.
  useEffect(() => {
    if (run.phase === "reward") {
      // Boss artifact offer first — generated once per reward step. The
      // Reward UI shows it before the regular card draft.
      if (!extras.bossArtifactGenerated && isBossMatch(run)) {
        const { offer, next } = generateBossArtifactOffer(run);
        setExtras((e) => ({
          ...e,
          bossArtifactOffer: offer.artifacts.length > 0 ? offer : null,
          bossArtifactGenerated: true,
        }));
        setRun(next);
        return;
      }
      if (!extras.bossArtifactGenerated) {
        // Non-boss reward — mark generation done so the regular draft fires.
        setExtras((e) => ({ ...e, bossArtifactGenerated: true }));
        return;
      }
      if (extras.draftOffer === null) {
        const { offer, next } = generateDraftOffer(run);
        setExtras((e) => ({ ...e, draftOffer: offer }));
        setRun(next);
        return;
      }
    }
    if (run.phase === "shop" && extras.shop === null) {
      const { shop, next } = generateShop(run);
      setExtras((e) => ({ ...e, shop }));
      setRun(next);
      return;
    }
    if (run.phase === "match") {
      // Stale draft / shop from previous round must not leak into the next
      // entry to that phase — drop them as we leave them behind.
      if (
        extras.draftOffer !== null ||
        extras.shop !== null ||
        extras.bossArtifactGenerated ||
        extras.bossArtifactOffer !== null
      ) {
        setExtras((e) => ({
          ...e,
          draftOffer: null,
          shop: null,
          bossArtifactOffer: null,
          bossArtifactGenerated: false,
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
        setRun(matchStartGold > 0 ? { ...next, gold: next.gold + matchStartGold } : next);
        setExtras((e) => ({ ...e, matchSetup: { fen, size } }));
      }
    }
  }, [
    run,
    extras.draftOffer,
    extras.shop,
    extras.matchSetup,
    extras.bossArtifactOffer,
    extras.bossArtifactGenerated,
  ]);

  // ---- Match phase --------------------------------------------------------

  const onMatchEnd = (outcome: RunMatchOutcome) => {
    setRun((r) => applyMatchOutcome(r, outcome));
    // Drop the per-match setup so the next "match" phase entry generates
    // a fresh starting position.
    setExtras((e) => ({ ...e, matchSetup: null }));
  };

  // ---- Reward phase -------------------------------------------------------

  const onPickDraftCard = (card: Card) => {
    setRun((r) => enterShop(pickDraftCard(r, card)));
    setExtras((e) => ({ ...e, draftOffer: null }));
  };

  const onSkipDraft = () => {
    if (!extras.draftOffer) return;
    const skipGold = extras.draftOffer.skipGold;
    setRun((r) => enterShop(skipDraft(r, skipGold)));
    setExtras((e) => ({ ...e, draftOffer: null }));
  };

  // ---- Boss reward handlers ----------------------------------------------

  const onPickBossArtifact = (artifact: Artifact) => {
    setRun((r) => pickBossArtifact(r, artifact));
    setExtras((e) => ({ ...e, bossArtifactOffer: null }));
  };

  const onSkipBossArtifact = () => {
    if (!extras.bossArtifactOffer) return;
    const skipGold = extras.bossArtifactOffer.skipGold;
    setRun((r) => skipBossArtifact(r, skipGold));
    setExtras((e) => ({ ...e, bossArtifactOffer: null }));
  };

  // ---- Boss preview --------------------------------------------------------

  const onDismissBossPreview = () => {
    setRun((r) => dismissBossPreview(r));
  };

  // ---- Shop phase ---------------------------------------------------------

  const onShopUpdate = (next: { state: RunState; shop: ShopState }) => {
    setRun(next.state);
    setExtras((e) => ({ ...e, shop: next.shop }));
  };

  const onLeaveShop = () => {
    setRun((r) => {
      const { state, interest } = applyInterest(r);
      setExtras((e) => ({ ...e, shop: null, lastInterest: interest }));
      return leaveShop(state);
    });
  };

  // ---- Render -------------------------------------------------------------

  const total = totalMatches(run);
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
        {extras.lastInterest > 0 && run.phase === "match" && (
          <span className={styles.bannerInterest}>+{extras.lastInterest} interest</span>
        )}
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
      run.phase,
      total,
      extras.lastInterest,
      onExit,
    ],
  );

  return (
    <div className={styles.run}>
      {banner}
      {run.artifacts.length > 0 && run.phase !== "won" && run.phase !== "lost" && (
        <ArtifactSidebar artifacts={run.artifacts} />
      )}
      {run.phase === "match" && extras.matchSetup && (
        <Match
          // Re-mount each match so the engine + card state both reset cleanly.
          key={`m-${run.matchNumber}`}
          runMode="run"
          initialDeck={run.deck.slice()}
          initialArtifacts={run.artifacts}
          onSaveArtifacts={(artifacts) => setRun((r) => ({ ...r, artifacts: artifacts.slice() }))}
          initialFen={extras.matchSetup.fen}
          initialBoardSize={extras.matchSetup.size}
          activeBoss={activeBossFor(run)}
          onMatchEnd={onMatchEnd}
        />
      )}
      {run.phase === "boss-preview" && previewBossFor(run) && (
        <BossPreview boss={previewBossFor(run)!} onContinue={onDismissBossPreview} />
      )}
      {run.phase === "reward" && (
        <Reward
          run={run}
          offer={extras.draftOffer}
          bossArtifactOffer={extras.bossArtifactOffer}
          onPick={onPickDraftCard}
          onSkip={onSkipDraft}
          onPickBossArtifact={onPickBossArtifact}
          onSkipBossArtifact={onSkipBossArtifact}
        />
      )}
      {run.phase === "shop" && extras.shop && (
        <Shop run={run} shop={extras.shop} onUpdate={onShopUpdate} onLeave={onLeaveShop} />
      )}
      {(run.phase === "won" || run.phase === "lost") && <RunSummary run={run} onExit={onExit} />}
    </div>
  );
}

function titleCase(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}
