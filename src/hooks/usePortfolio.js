// src/hooks/usePortfolio.js
import { useMemo, useCallback } from "react";
import { STOCK_UNIVERSE } from "../data/stocks";
import { calcPortfolioMetrics, optimizeWeights } from "../utils/finance";

export function usePortfolio({ holdings, setHoldings, riskTolerance, setRiskTolerance }) {
  const totalWeight = useMemo(
    () => parseFloat(holdings.reduce((s, h) => s + h.weight, 0).toFixed(1)),
    [holdings],
  );

  const metrics = useMemo(() => calcPortfolioMetrics(holdings), [holdings]);

  const sectorBreakdown = useMemo(() => {
    const map = {};
    holdings.forEach(h => { map[h.sector] = parseFloat(((map[h.sector] || 0) + h.weight).toFixed(1)); });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [holdings]);

  const addStock = useCallback((stock) => {
    setHoldings(prev => {
      const full = typeof stock === "string"
        ? STOCK_UNIVERSE.find(s => s.ticker === stock) ?? { ticker: stock, name: stock, sector: "Unknown", pe: null, pb: null, evEbitda: null, beta: 1, expectedReturn: 10, volatility: 20, dividend: 0 }
        : stock;
      if (prev.find(h => h.ticker === full.ticker)) return prev;
      return [...prev, { ...full, weight: 10 }];
    });
  }, [setHoldings]);

  const removeStock = useCallback((ticker) => {
    setHoldings(prev => prev.filter(h => h.ticker !== ticker));
  }, [setHoldings]);

  const updateWeight = useCallback((ticker, raw) => {
    const val = Math.max(0, Math.min(100, parseFloat(raw) || 0));
    setHoldings(prev => prev.map(h => h.ticker === ticker ? { ...h, weight: val } : h));
  }, [setHoldings]);

  const equalWeight = useCallback(() => {
    setHoldings(prev => {
      const w = parseFloat((100 / prev.length).toFixed(1));
      return prev.map(h => ({ ...h, weight: w }));
    });
  }, [setHoldings]);

  const optimize = useCallback(() => {
    setHoldings(prev => optimizeWeights(prev, riskTolerance));
  }, [setHoldings, riskTolerance]);

  const addCustomStock = useCallback((stock) => {
    setHoldings(prev => {
      if (prev.find(h => h.ticker === stock.ticker)) return prev;
      return [...prev, { ...stock, weight: 10 }];
    });
  }, [setHoldings]);

  return {
    holdings, totalWeight, metrics, sectorBreakdown,
    riskTolerance, setRiskTolerance,
    addStock, removeStock, updateWeight, equalWeight, optimize, addCustomStock,
  };
}
