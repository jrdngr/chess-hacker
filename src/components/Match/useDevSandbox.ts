// Dev-mode sandbox actions — board reseed (clear / standard / random / size),
// energy bumps, deck/artifact editor saves, library-card free play wiring,
// skip-match-and-win, and the side-to-move toggle.
//
// All here are one-shot actions invoked from the dev panel. They orchestrate
// engine + cardState + history together, so they can't be pure helpers; they
// need access to React's setters. Dev-panel toggle state (devPanelOpen,
// devAiOn, chessVision) stays in Match.tsx because earlier hooks (useAiLoop,
// useCardPlay) read those values, and putting them here would create a hook-
// ordering cycle.

import { useCallback } from "react";

import { ChoseEngine } from "../../game/chess/engine";
import { generateChess960Position } from "../../game/chess/positions";
import {
  clampEnergy,
  createMatchCardState,
  startPlayerTurn,
  type Rng,
} from "../../game/cards/match";
import { STANDARD_MATCHES, resolvePieceSet } from "../../game/progression/standard";
import { makeStarterDeck } from "../../game/cards/library";
import type { ZoneBoardContext } from "../../game/overlays/zoneBuffs";
import type {
  AlgebraicSquare,
  Artifact,
  BoardSize,
  Card,
  MatchCardState,
  RunMatchOutcome,
  Side,
} from "../../game/types";

import type { HistoryEvent } from "./history";
import type { useUndoRedo } from "./useUndoRedo";

function zoneBoardContextOf(engine: ChoseEngine): ZoneBoardContext {
  return {
    size: engine.size(),
    pieceSideAt: (sq) => engine.pieceAt(sq)?.side ?? null,
    pieceTypeAt: (sq) => engine.pieceAt(sq)?.type ?? null,
  };
}

/**
 * Center-anchored axis remap. Used when a board resize adds/removes a file
 * or rank — pieces shift inward so the back ranks stay intact.
 */
function remapAxis(oldCoord: number, oldSize: number, newSize: number): number | null {
  let coord = oldCoord;
  let size = oldSize;
  while (size < newSize) {
    const insertIdx = Math.floor((size + 1) / 2);
    if (coord >= insertIdx) coord += 1;
    size += 1;
  }
  while (size > newSize) {
    const removeIdx = Math.floor(size / 2);
    if (coord === removeIdx) return null;
    if (coord > removeIdx) coord -= 1;
    size -= 1;
  }
  return coord;
}

const HUMAN_SIDE: Side = "player";

type UndoRedo = ReturnType<typeof useUndoRedo>;

type Params = {
  engine: ChoseEngine;
  setEngine: (next: ChoseEngine) => void;
  cardState: MatchCardState;
  setCardState: (next: MatchCardState | ((prev: MatchCardState) => MatchCardState)) => void;
  bumpVersion: () => void;
  resetVersion: () => void;
  rng?: Rng;
  pushSnapshot: (state: MatchCardState) => void;
  pushHistory: (event: HistoryEvent) => HistoryEvent[];
  replaceHistory: (next: HistoryEvent[]) => void;
  undoRedo: UndoRedo;
  mode: "vs-ai" | "local-pvp";
  artifacts: ReadonlyArray<Artifact>;
  setArtifacts: (next: ReadonlyArray<Artifact>) => void;
  initialDeck: ReadonlyArray<Card> | undefined;
  onLoadDeck?: (cards: Card[]) => void;
  onSaveArtifacts?: (next: Artifact[]) => void;
  onMatchEnd?: (outcome: RunMatchOutcome) => void;
  matchEndedRef: React.MutableRefObject<boolean>;
  matchOver: boolean;
  runMode: "prototype" | "dev" | "run";
  // Cross-hook coordination
  cancelInFlightAi: () => void;
  resetCardPlay: () => void;
  resetDevEditor: () => void;
  setSelected: (sq: AlgebraicSquare | null) => void;
  synthesizeLibraryCard: (card: Card, mode: "click" | "drag") => void;
  cancelTargeting: () => void;
};

type Result = {
  setSideToMove: (side: Side) => void;
  clearBoard: () => void;
  resizeBoard: (size: BoardSize) => void;
  standardStart: () => void;
  randomStart: () => void;
  bumpEnergy: (delta: number) => void;
  skipMatchAndWin: () => void;
  saveDeck: (next: {
    drawPile: Card[];
    discardPile: Card[];
    consumedPile: Card[];
    addedCards: Card[];
  }) => void;
  loadDeck: (cards: ReadonlyArray<Card>) => void;
  saveArtifacts: (next: Artifact[]) => void;
  playLibraryCard: (card: Card) => void;
  dragStartLibraryCard: (card: Card) => void;
  dragEndLibraryCard: () => void;
};

export function useDevSandbox({
  engine,
  setEngine,
  cardState,
  setCardState,
  bumpVersion,
  resetVersion,
  rng,
  pushSnapshot,
  pushHistory,
  replaceHistory,
  undoRedo,
  mode,
  artifacts,
  setArtifacts,
  initialDeck,
  onLoadDeck,
  onSaveArtifacts,
  onMatchEnd,
  matchEndedRef,
  matchOver,
  runMode,
  cancelInFlightAi,
  resetCardPlay,
  resetDevEditor,
  setSelected,
  synthesizeLibraryCard,
  cancelTargeting,
}: Params): Result {
  const setSideToMove = useCallback(
    (side: Side) => {
      if (engine.turn() === side) return;
      engine.forceTurn(side);
      bumpVersion();
      pushSnapshot(cardState);
    },
    [engine, cardState, pushSnapshot, bumpVersion],
  );

  const clearBoard = useCallback(() => {
    for (const { square } of engine.pieces()) {
      engine.removePiece(square);
    }
    // Clearing wipes every piece, so any per-piece status is now stale.
    const next: MatchCardState = {
      ...cardState,
      freezes: [],
      roots: [],
      disarms: [],
      compels: [],
      shields: [],
      hastes: [],
      lightnings: [],
      empowers: [],
    };
    setCardState(next);
    bumpVersion();
    pushSnapshot(next);
  }, [engine, cardState, pushSnapshot, bumpVersion, setCardState]);

  const resizeBoard = useCallback(
    (size: BoardSize) => {
      const emptyRow = String(size.files);
      const board = Array.from({ length: size.ranks }, () => emptyRow).join("/");
      const fresh = new ChoseEngine(`${board} w - - 0 1`, size);
      const oldSize = engine.size();
      for (const { square, piece } of engine.pieces()) {
        const file = square.charCodeAt(0) - 97;
        const rank = Number(square.slice(1)) - 1;
        const newFile = remapAxis(file, oldSize.files, size.files);
        const newRank = remapAxis(rank, oldSize.ranks, size.ranks);
        if (newFile === null || newRank === null) continue;
        const newSquare = `${String.fromCharCode(97 + newFile)}${newRank + 1}` as AlgebraicSquare;
        fresh.placePiece(newSquare, piece);
      }
      fresh.forceTurn(engine.turn());
      setEngine(fresh);
      const next: MatchCardState = {
        ...cardState,
        freezes: [],
        roots: [],
        disarms: [],
        compels: [],
        shields: [],
        hastes: [],
        lightnings: [],
        empowers: [],
      };
      setCardState(next);
      setSelected(null);
      bumpVersion();
      pushSnapshot(next);
    },
    [engine, cardState, pushSnapshot, bumpVersion, setCardState, setEngine, setSelected],
  );

  const standardStart = useCallback(() => {
    const freshEngine = new ChoseEngine();
    setEngine(freshEngine);
    const fresh = startPlayerTurn(
      createMatchCardState(initialDeck ?? makeStarterDeck(), rng, artifacts),
      rng,
      zoneBoardContextOf(freshEngine),
    );
    setCardState(fresh);
    setSelected(null);
    resetVersion();
    resetCardPlay();
    resetDevEditor();
    const initialHistory: HistoryEvent[] = [
      {
        kind: "match-start",
        turn: fresh.turn,
        fen: freshEngine.fen(),
        size: freshEngine.size(),
        mode,
      },
    ];
    replaceHistory(initialHistory);
    undoRedo.seed({
      engineSnapshot: freshEngine.snapshot(),
      cardState: fresh,
      history: initialHistory,
    });
  }, [
    initialDeck,
    rng,
    undoRedo,
    mode,
    replaceHistory,
    artifacts,
    resetCardPlay,
    resetDevEditor,
    setEngine,
    setCardState,
    setSelected,
    resetVersion,
  ]);

  const randomStart = useCallback(() => {
    const r: Rng = rng ?? Math.random;
    const currentSize = engine.size();
    const fitting = STANDARD_MATCHES.filter((m) => m.size.files <= currentSize.files);
    const pool = fitting.length > 0 ? fitting : STANDARD_MATCHES;
    const cfg = pool[Math.floor(r() * pool.length)];
    const pieceSet = resolvePieceSet(cfg, r);
    const { fen, size } = generateChess960Position(pieceSet, currentSize, r);
    const freshEngine = new ChoseEngine(fen, size);
    // Cancel any in-flight AI reply — `randomStart` doubles as the "New game"
    // action on match-over in sandbox.
    cancelInFlightAi();
    setEngine(freshEngine);
    const fresh = startPlayerTurn(
      createMatchCardState(initialDeck ?? makeStarterDeck(), rng, artifacts),
      rng,
      zoneBoardContextOf(freshEngine),
    );
    setCardState(fresh);
    setSelected(null);
    resetVersion();
    resetCardPlay();
    resetDevEditor();
    const initialHistory: HistoryEvent[] = [
      {
        kind: "match-start",
        turn: fresh.turn,
        fen: freshEngine.fen(),
        size: freshEngine.size(),
        mode,
      },
    ];
    replaceHistory(initialHistory);
    undoRedo.seed({
      engineSnapshot: freshEngine.snapshot(),
      cardState: fresh,
      history: initialHistory,
    });
  }, [
    engine,
    initialDeck,
    rng,
    undoRedo,
    mode,
    replaceHistory,
    artifacts,
    cancelInFlightAi,
    resetCardPlay,
    resetDevEditor,
    setEngine,
    setCardState,
    setSelected,
    resetVersion,
  ]);

  const bumpEnergy = useCallback(
    (delta: number) => {
      setCardState((s) => {
        const next = { ...s, energy: clampEnergy(s.energy + delta) };
        pushHistory({
          kind: "energy-bump",
          turn: next.turn,
          delta,
          energyAfter: next.energy,
        });
        pushSnapshot(next);
        return next;
      });
    },
    [pushSnapshot, pushHistory, setCardState],
  );

  /**
   * Dev-only: synthesize a player checkmate so the Run shell advances to
   * Reward + Shop and onto the next match. Lets us spot-check AI behaviour
   * across every board size in one run without grinding through nine real
   * matches. We flip `matchEndedRef` first so the natural-outcome useEffect
   * doesn't refire `onMatchEnd` if the engine later reaches a real terminal
   * state before this Match instance unmounts.
   */
  const skipMatchAndWin = useCallback(() => {
    if (runMode !== "run" || !onMatchEnd || matchOver) return;
    matchEndedRef.current = true;
    onMatchEnd({
      won: true,
      outcome: { kind: "checkmate", winner: HUMAN_SIDE },
      turnsPlayed: cardState.turn,
    });
  }, [runMode, onMatchEnd, matchOver, cardState.turn, matchEndedRef]);

  const saveDeck = useCallback(
    (next: { drawPile: Card[]; discardPile: Card[]; consumedPile: Card[]; addedCards: Card[] }) => {
      setCardState((prev) => {
        const updated: MatchCardState = {
          ...prev,
          drawPile: next.drawPile,
          discardPile: next.discardPile,
          consumedPile: next.consumedPile,
          acquisitionLog: [...prev.acquisitionLog, ...next.addedCards],
        };
        pushSnapshot(updated);
        return updated;
      });
    },
    [pushSnapshot, setCardState],
  );

  const loadDeck = useCallback(
    (cards: ReadonlyArray<Card>) => {
      const next = cards.slice();
      setCardState((prev) => {
        const updated: MatchCardState = {
          ...prev,
          drawPile: next,
          discardPile: [],
          consumedPile: [],
          acquisitionLog: [...prev.acquisitionLog, ...next],
        };
        pushSnapshot(updated);
        return updated;
      });
      onLoadDeck?.(next);
    },
    [pushSnapshot, onLoadDeck, setCardState],
  );

  const saveArtifacts = useCallback(
    (next: Artifact[]) => {
      const frozen = next.slice();
      setArtifacts(frozen);
      setCardState((prev) => {
        const updated: MatchCardState = { ...prev, artifacts: frozen };
        pushSnapshot(updated);
        return updated;
      });
      onSaveArtifacts?.(frozen);
    },
    [pushSnapshot, onSaveArtifacts, setArtifacts, setCardState],
  );

  // Library card play (dev only). Click vs drag are surfaced separately for
  // the dev panel so a no-target card can resolve immediately on click but
  // always enter targeting on drag (drop-anywhere overlay). The hook decides.
  const playLibraryCard = useCallback(
    (card: Card) => synthesizeLibraryCard(card, "click"),
    [synthesizeLibraryCard],
  );
  const dragStartLibraryCard = useCallback(
    (card: Card) => synthesizeLibraryCard(card, "drag"),
    [synthesizeLibraryCard],
  );
  const dragEndLibraryCard = useCallback(() => {
    // If the drop landed on a board square, the resolver already cleared the
    // synth. If the drop missed, cancelTargeting backs it out.
    cancelTargeting();
  }, [cancelTargeting]);

  return {
    setSideToMove,
    clearBoard,
    resizeBoard,
    standardStart,
    randomStart,
    bumpEnergy,
    skipMatchAndWin,
    saveDeck,
    loadDeck,
    saveArtifacts,
    playLibraryCard,
    dragStartLibraryCard,
    dragEndLibraryCard,
  };
}
