import { describe, expect, it } from "vitest";

import {
  activeBossFor,
  applyMatchOutcome,
  consumeRng,
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
  skipBossArtifact,
  skipDraft,
  STANDARD_RUN_CONFIG,
  totalMatches,
  WIN_BONUS_BOSS,
  WIN_BONUS_NORMAL,
} from "./run";
import { FORESIGHT, FROSTBITE, RECONNAISSANCE } from "../cards/library";
import { parseFen } from "../chess/rules";
import { standardMatchConfig } from "./standard";
import type { PieceType, RunMatchOutcome, RunState } from "../types";

const MOCK_OUTCOME_WIN: RunMatchOutcome = {
  won: true,
  outcome: { kind: "checkmate", winner: "player" },
  turnsPlayed: 12,
};

const MOCK_OUTCOME_LOSS: RunMatchOutcome = {
  won: false,
  outcome: { kind: "checkmate", winner: "opponent" },
  turnsPlayed: 22,
};

describe("createRun", () => {
  it("starts a Royal mini-run on match 1, gold 0, default config", () => {
    const run = createRun({ mode: "royal", rngSeed: 1 });
    expect(run.mode).toBe("royal");
    expect(run.act).toBe(1);
    expect(run.matchInAct).toBe(1);
    expect(run.matchNumber).toBe(1);
    expect(run.gold).toBe(0);
    expect(run.phase).toBe("match");
    expect(run.deck.length).toBeGreaterThan(0);
    expect(totalMatches(run)).toBe(3);
  });

  it("uses a deterministic seed for reproducible drafts", () => {
    const a = createRun({ mode: "royal", rngSeed: 42 });
    const b = createRun({ mode: "royal", rngSeed: 42 });
    expect(generateDraftOffer(a).offer.cards.map((c) => c.id)).toEqual(
      generateDraftOffer(b).offer.cards.map((c) => c.id),
    );
  });
});

describe("applyMatchOutcome", () => {
  it("a win advances to reward and pays the normal win bonus", () => {
    const run = createRun({ mode: "royal", rngSeed: 1 });
    const next = applyMatchOutcome(run, MOCK_OUTCOME_WIN);
    expect(next.phase).toBe("reward");
    expect(next.gold).toBe(WIN_BONUS_NORMAL);
    expect(next.matchNumber).toBe(1); // doesn't advance until shop closes
  });

  it("a loss transitions to the lost phase and keeps gold intact", () => {
    const start = { ...createRun({ mode: "royal", rngSeed: 1 }), gold: 10 };
    const next = applyMatchOutcome(start, MOCK_OUTCOME_LOSS);
    expect(next.phase).toBe("lost");
    expect(next.gold).toBe(10);
  });
});

describe("draft", () => {
  it("draft offer returns DRAFT_CARD_COUNT cards by default", () => {
    const run = createRun({ mode: "royal", rngSeed: 7 });
    const { offer } = generateDraftOffer(run);
    expect(offer.cards.length).toBe(3);
    expect(offer.skipGold).toBeGreaterThan(0);
  });

  it("offer cards are distinct", () => {
    const run = createRun({ mode: "royal", rngSeed: 7 });
    const { offer } = generateDraftOffer(run);
    const ids = offer.cards.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("never offers Soul or Shiv cards or curse cards", () => {
    // Sweep many seeds — none should ever surface the excluded ids.
    for (let seed = 1; seed < 50; seed++) {
      const run = createRun({ mode: "royal", rngSeed: seed });
      const { offer } = generateDraftOffer(run);
      for (const c of offer.cards) {
        expect(c.curse).toBeFalsy();
        expect(c.id.endsWith("-soul")).toBe(false);
        expect(c.id.startsWith("shiv-")).toBe(false);
      }
    }
  });

  it("picking a draft card adds it to the deck", () => {
    const run = createRun({ mode: "royal", rngSeed: 1 });
    const startingSize = run.deck.length;
    const next = pickDraftCard(run, FROSTBITE);
    expect(next.deck.length).toBe(startingSize + 1);
    expect(next.deck[next.deck.length - 1].id).toBe(FROSTBITE.id);
  });

  it("skipping a draft pays the offered skip gold", () => {
    const run = createRun({ mode: "royal", rngSeed: 1 });
    const next = skipDraft(run, 5);
    expect(next.gold).toBe(5);
    expect(next.deck.length).toBe(run.deck.length);
  });
});

describe("phase transitions: reward → shop → next match", () => {
  it("enterShop moves into the shop phase", () => {
    const run = applyMatchOutcome(createRun({ mode: "royal", rngSeed: 1 }), MOCK_OUTCOME_WIN);
    const next = enterShop(run);
    expect(next.phase).toBe("shop");
  });

  it("leaveShop advances the match number until totalMatches, then wins", () => {
    let run = createRun({ mode: "royal", rngSeed: 1 });

    // Matches 1 + 2: full reward → shop → next loop.
    for (let i = 0; i < 2; i++) {
      run = applyMatchOutcome(run, MOCK_OUTCOME_WIN);
      expect(run.phase).toBe("reward");
      run = enterShop(pickDraftCard(run, RECONNAISSANCE));
      expect(run.phase).toBe("shop");
      run = leaveShop(run);
    }

    // Match 3: enterShop short-circuits to "won" because there's no next match.
    run = applyMatchOutcome(run, MOCK_OUTCOME_WIN);
    expect(run.phase).toBe("reward");
    run = enterShop(pickDraftCard(run, RECONNAISSANCE));
    expect(run.phase).toBe("won");
    expect(run.matchNumber).toBe(3);
  });

  it("a loss anywhere ends the run", () => {
    let run = createRun({ mode: "royal", rngSeed: 1 });
    run = applyMatchOutcome(run, MOCK_OUTCOME_WIN);
    run = enterShop(pickDraftCard(run, FORESIGHT));
    run = leaveShop(run);
    expect(run.phase).toBe("match");
    expect(run.matchNumber).toBe(2);

    run = applyMatchOutcome(run, MOCK_OUTCOME_LOSS);
    expect(run.phase).toBe("lost");
  });
});

describe("nextMatchSetup (Standard mode)", () => {
  const startStandard = (matchNumber: number, seed = 1): RunState => ({
    ...createRun({ mode: "standard", rngSeed: seed, config: STANDARD_RUN_CONFIG }),
    matchNumber,
  });

  it("returns the configured board size for each match in the curve", () => {
    for (let m = 1; m <= 9; m++) {
      const cfg = standardMatchConfig(m);
      const { size } = nextMatchSetup(startStandard(m));
      expect(size).toEqual(cfg.size);
    }
  });

  it("produces a parseable FEN for every match", () => {
    for (let m = 1; m <= 9; m++) {
      const { fen, size } = nextMatchSetup(startStandard(m, m * 7));
      expect(fen).toBeDefined();
      const pos = parseFen(fen!, size);
      // Each side should have at least the king plus full pawn rank.
      let players = 0;
      let opponents = 0;
      for (const [, p] of pos.pieces) {
        if (p.side === "player") players++;
        else opponents++;
      }
      expect(players).toBeGreaterThanOrEqual(1 + standardMatchConfig(m).pawns);
      expect(players).toBe(opponents);
    }
  });

  const explicitBackRank = (m: number, expected: PieceType[]) => {
    const { fen, size } = nextMatchSetup(startStandard(m));
    const pos = parseFen(fen!, size);
    const back: Array<{ file: number; type: PieceType }> = [];
    for (const [sq, p] of pos.pieces) {
      if (p.side !== "player") continue;
      const rank = Number(sq.slice(1)) - 1;
      if (rank !== 0 || p.type === "pawn") continue;
      back.push({ file: "abcdefgh".indexOf(sq[0]), type: p.type });
    }
    const sortedTypes = back.sort((a, b) => a.file - b.file).map((b) => b.type);
    expect([...sortedTypes].sort()).toEqual([...expected].sort());
  };

  it("Boss A (match 3) places exactly K + N + B + R on a 5×6 board", () => {
    explicitBackRank(3, ["king", "knight", "bishop", "rook"]);
  });

  it("Boss B (match 6) places exactly K + 2N + 2B + 2R on a 7×7 board", () => {
    explicitBackRank(6, ["king", "knight", "knight", "bishop", "bishop", "rook", "rook"]);
  });

  it("Boss C (match 9) places exactly K + 2N + 2B + 2R + Q on an 8×8 board", () => {
    explicitBackRank(9, ["king", "knight", "knight", "bishop", "bishop", "rook", "rook", "queen"]);
  });
});

describe("Standard boss flow (M8)", () => {
  it("a Standard run starts in `boss-preview` so the player sees Boss A", () => {
    const run = createRun({ mode: "standard", rngSeed: 1 });
    expect(run.phase).toBe("boss-preview");
    expect(activeBossFor({ ...run, matchNumber: 3 })?.id).toBe("iron-garrison");
    const dismissed = dismissBossPreview(run);
    expect(dismissed.phase).toBe("match");
  });

  it("isBossMatch is true on Standard match 3, false elsewhere in act 1", () => {
    const run = createRun({ mode: "standard", rngSeed: 1 });
    expect(isBossMatch({ ...run, matchNumber: 1 })).toBe(false);
    expect(isBossMatch({ ...run, matchNumber: 2 })).toBe(false);
    expect(isBossMatch({ ...run, matchNumber: 3 })).toBe(true);
  });

  it("a Standard boss win pays WIN_BONUS_BOSS and routes to reward", () => {
    const run = createRun({ mode: "standard", rngSeed: 1 });
    const onBoss: RunState = { ...run, matchNumber: 3, phase: "match" };
    const after = applyMatchOutcome(onBoss, MOCK_OUTCOME_WIN);
    expect(after.phase).toBe("reward");
    expect(after.gold).toBe(WIN_BONUS_BOSS);
  });

  it("generateBossArtifactOffer offers up to 3 artifacts not already owned", () => {
    const run = createRun({ mode: "standard", rngSeed: 5 });
    const { offer } = generateBossArtifactOffer(run);
    expect(offer.artifacts.length).toBeGreaterThan(0);
    expect(offer.artifacts.length).toBeLessThanOrEqual(3);
    const ids = offer.artifacts.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(offer.skipGold).toBeGreaterThan(0);
  });

  it("pickBossArtifact appends to the run's artifact list", () => {
    const run = createRun({ mode: "standard", rngSeed: 5 });
    const { offer } = generateBossArtifactOffer(run);
    const next = pickBossArtifact(run, offer.artifacts[0]);
    expect(next.artifacts.length).toBe(run.artifacts.length + 1);
    expect(next.artifacts[next.artifacts.length - 1].id).toBe(offer.artifacts[0].id);
  });

  it("skipBossArtifact pays the skip gold and leaves artifacts untouched", () => {
    const run = createRun({ mode: "standard", rngSeed: 5 });
    const next = skipBossArtifact(run, 10);
    expect(next.gold).toBe(run.gold + 10);
    expect(next.artifacts.length).toBe(run.artifacts.length);
  });

  it("activeBossFor returns null on non-boss matches and outside Standard mode", () => {
    const royal = createRun({ mode: "royal", rngSeed: 1 });
    expect(activeBossFor({ ...royal, matchNumber: 3 })).toBeNull();
    const run = createRun({ mode: "standard", rngSeed: 1 });
    expect(activeBossFor({ ...run, matchNumber: 1 })).toBeNull();
  });
});

describe("consumeRng", () => {
  it("returns the same RNG sequence for the same cursor", () => {
    const run = createRun({ mode: "royal", rngSeed: 99 });
    const a = consumeRng(run);
    const b = consumeRng(run);
    expect(a.rng()).toEqual(b.rng());
    expect(a.next.rngCursor).toBe(b.next.rngCursor);
  });

  it("advances the cursor so consecutive draws differ", () => {
    const run = createRun({ mode: "royal", rngSeed: 99 });
    const first = consumeRng(run);
    const second = consumeRng(first.next);
    expect(first.next.rngCursor).toBe(1);
    expect(second.next.rngCursor).toBe(2);
    // Sequences should differ — extremely unlikely to coincide on first draw.
    expect(first.rng()).not.toEqual(second.rng());
  });
});
