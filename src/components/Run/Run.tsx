// Run shell — owns the run state machine and routes between match, reward,
// and shop phases.
//
// State management note: the run is small enough that useState is fine here.
// Architecture doc earmarks zustand for "if cross-component state grows
// painful" — the M5 mini-run touches at most three siblings (Match, Reward,
// Shop), all owned by this shell.

import { useEffect, useMemo, useState } from "react";

import { BossPreview } from "./BossPreview";
import { Match } from "../Match";
import { MatchWonPanel } from "./MatchWonPanel";
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
import { artifactEmoji } from "../../game/artifacts/library";
import { goldOnMatchStart } from "../../game/artifacts/effects";
import { getCardById } from "../../game/cards/library";
import type { EngineSnapshot } from "../../game/chess/engine";
import type {
  Artifact,
  BoardSize,
  BossArtifactOffer,
  BossDef,
  Card,
  CurseTrigger,
  DraftOffer,
  MatchCardState,
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
  /**
   * Held while the player reviews the just-finished match's final position
   * after a win. The phase stays at `"match"` so `<Match>` keeps its engine
   * state mounted; the win panel replaces the side panel and the player
   * advances to reward via the Continue button (`applyMatchOutcome`).
   */
  pendingWin: RunMatchOutcome | null;
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
    draftOffer: null,
    shop: null,
    lastInterest: 0,
    matchSetup: null,
    bossArtifactOffer: null,
    bossArtifactGenerated: false,
    pendingWin: null,
    finalSnapshot: null,
  });

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
        extras.bossArtifactOffer !== null ||
        extras.finalSnapshot !== null
      ) {
        setExtras((e) => ({
          ...e,
          draftOffer: null,
          shop: null,
          bossArtifactOffer: null,
          bossArtifactGenerated: false,
          finalSnapshot: null,
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
    extras.finalSnapshot,
  ]);

  // ---- Match phase --------------------------------------------------------

  const onMatchEnd = (outcome: RunMatchOutcome) => {
    if (outcome.won) {
      // Pause on the final position so the player can review the win and
      // confirm before the reward step takes over the screen. The phase
      // stays "match" until they hit Continue in the win panel.
      setExtras((e) => ({ ...e, pendingWin: outcome }));
      return;
    }
    setRun((r) => applyMatchOutcome(r, outcome));
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

  const onConfirmWin = () => {
    if (!extras.pendingWin) return;
    const outcome = extras.pendingWin;
    setRun((r) => applyMatchOutcome(r, outcome));
    setExtras((e) => ({ ...e, pendingWin: null }));
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
                <span className={styles.bossTooltipHeading}>Curses</span>
                {activeBoss.curses.length === 0 ? (
                  <span className={styles.bossTooltipText}>None.</span>
                ) : (
                  <ul className={styles.bossTooltipCurseList}>
                    {activeBoss.curses.map((c, i) => {
                      const card = safeLookupCurse(c.curseId);
                      return (
                        <li key={`${c.curseId}-${i}`} className={styles.bossTooltipCurse}>
                          <span className={styles.bossTooltipCurseTrigger}>
                            {describeTrigger(c.trigger)}
                          </span>
                          <span className={styles.bossTooltipCurseName}>
                            {card?.name ?? c.curseId}
                          </span>
                          {card && (
                            <span className={styles.bossTooltipCurseDesc}>{card.description}</span>
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
            endOfRunPanel={
              run.phase === "won" || run.phase === "lost" ? (
                <RunSummary run={run} onExit={onExit} />
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
          endOfRunPanel={<RunSummary run={run} onExit={onExit} />}
        />
      )}
      {(run.phase === "won" || run.phase === "lost") &&
        !extras.matchSetup &&
        !(run.phase === "won" && extras.finalSnapshot) && <RunSummary run={run} onExit={onExit} />}
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
      const where = b.region.kind === "rank" ? `rank ${b.region.rank}` : b.region.anchor;
      const fx =
        b.buff.kind === "energy-per-turn"
          ? `+${b.buff.amount} energy/turn`
          : `+${b.buff.amount} hand size`;
      parts.push(`Boss-side zone-buff at ${where}: ${fx} while contested.`);
    }
  }
  return parts.join(" ");
}

function describeTrigger(t: CurseTrigger): string {
  switch (t.kind) {
    case "turn":
      return `Turn ${t.turn}`;
    case "every-n-turns":
      return `Every ${t.n} turns`;
    case "on-player-check":
      return "When you check";
    case "on-player-capture":
      return "When you capture";
  }
}

function safeLookupCurse(id: string) {
  try {
    return getCardById(id);
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
  if (boss.curses.length === 0) {
    parts.push("No curses.");
  } else {
    const curseDescriptions = boss.curses
      .map((c) => {
        const card = safeLookupCurse(c.curseId);
        const name = card?.name ?? c.curseId;
        const desc = card ? ` — ${card.description}` : "";
        return `${describeTrigger(c.trigger)}: ${name}${desc}`;
      })
      .join("; ");
    parts.push(`Curses: ${curseDescriptions}`);
  }
  return parts.join(". ");
}
