import { useState, useMemo, useCallback } from "react";
import { STOCK_UNIVERSE } from "../data/stocks";
import { calcPortfolioMetrics, optimizeWeights } from "../utils/finance";

// ── usePortfolio ───────────────────────────────────────────
// Central state hook. All portfolio mutations live here so
// every tab reads from a single source of truth.
export function usePortfolio() {
  // Holdings = STOCK_UNIVERSE entries enriched with `weight`
  const [holdings, setHoldings] = useState([
    { ...STOCK_UNIVERSE[0], weight: 25 },
    { ...STOCK_UNIVERSE[1], weight: 20 },
    { ...STOCK_UNIVERSE[2], weight: 15 },
  ]);

  const [riskTolerance, setRiskTolerance] = useState(50);

  // ── Derived ─────────────────────────────────────────────
  const totalWeight = useMemo(
    () => parseFloat(holdings.reduce((s, h) => s + h.weight, 0).toFixed(1)),
    [holdings],
  );

  const metrics = useMemo(
    () => calcPortfolioMetrics(holdings),
    [holdings],
  );

  const sectorBreakdown = useMemo(() => {
    const map = {};
    holdings.forEach(h => {
      map[h.sector] = parseFloat(((map[h.sector] || 0) + h.weight).toFixed(1));
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [holdings]);

  // ── Mutations ────────────────────────────────────────────
  const addStock = useCallback((stock) => {
    setHoldings(prev => {
      if (prev.find(h => h.ticker === stock.ticker)) return prev;
      return [...prev, { ...stock, weight: 10 }];
    });
  }, []);

  const removeStock = useCallback((ticker) => {
    setHoldings(prev => prev.filter(h => h.ticker !== ticker));
  }, []);

  const updateWeight = useCallback((ticker, raw) => {
    const val = Math.max(0, Math.min(100, parseFloat(raw) || 0));
    setHoldings(prev =>
      prev.map(h => h.ticker === ticker ? { ...h, weight: val } : h),
    );
  }, []);

  const equalWeight = useCallback(() => {
    setHoldings(prev => {
      const w = parseFloat((100 / prev.length).toFixed(1));
      return prev.map(h => ({ ...h, weight: w }));
    });
  }, []);

  const optimize = useCallback(() => {
    setHoldings(prev => optimizeWeights(prev, riskTolerance));
  }, [riskTolerance]);

  // Add a completely custom stock entered by the user
  const addCustomStock = useCallback((stock) => {
    setHoldings(prev => {
      if (prev.find(h => h.ticker === stock.ticker)) return prev;
      return [...prev, { ...stock, weight: 10 }];
    });
  }, []);

  return {
    holdings,
    totalWeight,
    metrics,
    sectorBreakdown,
    riskTolerance,
    setRiskTolerance,
    addStock,
    removeStock,
    updateWeight,
    equalWeight,
    optimize,
    addCustomStock,
  };
}
