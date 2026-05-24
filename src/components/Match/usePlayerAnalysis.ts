import { useCallback, useEffect, useRef, useState } from "react";

import {
  StockfishEngine,
  type AnalysisResult,
  type StockfishOptions,
  legalMoveToUci,
  variantFor,
} from "../../ai/stockfish";
import type { ChoseEngine } from "../../game/chess/engine";

const ANALYSIS_DEPTH = 12;
const DEBOUNCE_MS = 150;

type Params = {
  engine: ChoseEngine;
  active: boolean;
  version: number;
  createAi?: (opts?: StockfishOptions) => StockfishEngine;
};

type Analysis = {
  scoreCp: number | null;
  scoreMate: number | null;
  bestMove: string;
};

export function usePlayerAnalysis({ engine, active, version, createAi }: Params): Analysis | null {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const aiRef = useRef<StockfishEngine | null>(null);
  const genRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const variant = variantFor(engine.size());

  useEffect(() => {
    if (!active) {
      if (aiRef.current) {
        aiRef.current.destroy();
        aiRef.current = null;
      }
      setAnalysis(null);
      return;
    }
    let ai: StockfishEngine | null = null;
    try {
      ai = createAi ? createAi() : new StockfishEngine();
    } catch {
      return;
    }
    aiRef.current = ai;
    ai.ready()
      .then(() => {
        ai?.setVariant(variant);
      })
      .catch(() => {});
    return () => {
      ai?.destroy();
      aiRef.current = null;
    };
  }, [active, createAi, variant]);

  const runAnalysis = useCallback(async () => {
    const ai = aiRef.current;
    if (!ai) return;
    const gen = ++genRef.current;
    try {
      await ai.ready();
      if (genRef.current !== gen) return;
      ai.setVariant(variant);
      ai.setPosition(engine.fen());
      const playerMoves = engine.legalMoves().map(legalMoveToUci);
      if (playerMoves.length === 0) return;
      const result: AnalysisResult = await ai.analyze({
        depth: ANALYSIS_DEPTH,
        searchMoves: playerMoves,
      });
      if (genRef.current !== gen) return;
      setAnalysis({
        scoreCp: result.scoreCp,
        scoreMate: result.scoreMate,
        bestMove: result.bestMove,
      });
    } catch {
      // Stale or destroyed — ignore
    }
  }, [engine, variant]);

  useEffect(() => {
    if (!active) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      runAnalysis();
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [active, version, runAnalysis]);

  return active ? analysis : null;
}
