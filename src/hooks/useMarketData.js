// ── useMarketData.js ───────────────────────────────────────
// Fetches live data for every ticker in the portfolio and
// merges it into the holdings. Components just read
// `enrichedHoldings` instead of raw holdings.
//
// Usage:
//   const { enrichedHoldings, loading, errors, refresh } =
//     useMarketData(holdings);

import { useState, useEffect, useCallback, useRef } from "react";
import { fetchMultipleStocks } from "../services/marketData";
import { STOCK_UNIVERSE } from "../data/stocks";

// Build a quick lookup of static fallbacks from the universe
const FALLBACK_MAP = Object.fromEntries(
  STOCK_UNIVERSE.map(s => [s.ticker, s])
);

export function useMarketData(holdings) {
  const [liveData,  setLiveData]  = useState({});   // { ticker: enrichedStock }
  const [loading,   setLoading]   = useState(false);
  const [errors,    setErrors]    = useState([]);    // list of failed tickers
  const [lastFetch, setLastFetch] = useState(null);

  // Track which tickers we've already fetched so we only
  // call the API for newly added holdings
  const fetchedRef = useRef(new Set());

  const fetchData = useCallback(async (tickers) => {
    if (!tickers.length) return;

    // Only fetch tickers we don't have fresh data for
    const toFetch = tickers.filter(t => !fetchedRef.current.has(t));
    if (!toFetch.length) return;

    setLoading(true);
    setErrors([]);

    try {
      const result = await fetchMultipleStocks(toFetch, FALLBACK_MAP);

      // Collect any tickers that fell back due to errors
      const failed = Object.entries(result)
        .filter(([, v]) => v._error)
        .map(([t]) => t);

      setErrors(failed);
      setLiveData(prev => ({ ...prev, ...result }));
      toFetch.forEach(t => fetchedRef.current.add(t));
      setLastFetch(new Date());
    } catch (err) {
      console.error("useMarketData fetch failed:", err);
      setErrors(tickers);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch whenever the set of tickers changes
  useEffect(() => {
    const tickers = holdings.map(h => h.ticker);
    fetchData(tickers);
  }, [holdings, fetchData]);

  // Force-refresh all current tickers (clears cache ref)
  const refresh = useCallback(() => {
    fetchedRef.current = new Set();
    const tickers = holdings.map(h => h.ticker);
    fetchData(tickers);
  }, [holdings, fetchData]);

  // Merge live data on top of static holdings
  // Falls back gracefully to static data if API hasn't returned yet
  const enrichedHoldings = holdings.map(h => ({
    ...h,                          // static / user-set fields (weight, etc.)
    ...(liveData[h.ticker] ?? {}), // live fields overwrite where available
    weight: h.weight,              // always keep user-set weight
  }));

  const hasApiKey = !!process.env.REACT_APP_FMP_KEY;

  return {
    enrichedHoldings,
    loading,
    errors,
    lastFetch,
    hasApiKey,
    refresh,
  };
}
