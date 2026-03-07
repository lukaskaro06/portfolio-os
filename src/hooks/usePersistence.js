// src/hooks/usePersistence.js
// ─────────────────────────────────────────────────────────────
// Handles all Supabase read/write for:
//   • portfolio holdings + risk tolerance
//   • watchlist tickers
//
// Strategy:
//   - On mount: load saved data from Supabase, fall back to
//     localStorage if Supabase isn't configured
//   - On every change: debounce 800ms then save to Supabase
//     AND mirror to localStorage as an offline backup
//   - user_id: a stable anonymous UUID stored in localStorage
//     (no auth required — each browser session has its own data)

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase, hasSupabase } from "../lib/supabaseClient";
import { STOCK_UNIVERSE } from "../data/stocks";

// ── Stable anonymous user ID ──────────────────────────────
function getUserId() {
  const KEY = "portfolio_os_user_id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = "user_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(KEY, id);
  }
  return id;
}

const USER_ID = getUserId();

// ── Default holdings ──────────────────────────────────────
const DEFAULT_HOLDINGS = [
  { ...STOCK_UNIVERSE[0], weight: 25 },
  { ...STOCK_UNIVERSE[1], weight: 20 },
  { ...STOCK_UNIVERSE[2], weight: 15 },
];

const DEFAULT_WATCHLIST = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "SPY", "QQQ", "BTC-USD"];

// ── LocalStorage helpers ──────────────────────────────────
const LS = {
  get: (key, fallback) => {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch { return fallback; }
  },
  set: (key, val) => {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  },
};

// ─────────────────────────────────────────────────────────
export function usePersistence() {
  const [holdings,       setHoldings]       = useState(() => LS.get("holdings",       DEFAULT_HOLDINGS));
  const [riskTolerance,  setRiskTolerance]  = useState(() => LS.get("riskTolerance",  50));
  const [watchlist,      setWatchlist]      = useState(() => LS.get("mw_watchlist",   DEFAULT_WATCHLIST));
  const [syncStatus,     setSyncStatus]     = useState("idle"); // idle | saving | saved | error
  const [loaded,         setLoaded]         = useState(false);

  const saveTimer  = useRef(null);
  const watchTimer = useRef(null);

  // ── Load from Supabase on mount ───────────────────────
  useEffect(() => {
    if (!hasSupabase) { setLoaded(true); return; }

    const load = async () => {
      try {
        // Load portfolio
        const { data: ptfRows } = await supabase
          .from("portfolios")
          .select("holdings, risk_tolerance")
          .eq("user_id", USER_ID)
          .order("updated_at", { ascending: false })
          .limit(1);

        if (ptfRows?.length) {
          const row = ptfRows[0];
          // Re-merge with latest static data so new fields (sector, pe, etc.)
          // from stocks.js are always fresh, but weights are from DB
          const merged = row.holdings.map(h => {
            const fresh = STOCK_UNIVERSE.find(s => s.ticker === h.ticker);
            return fresh ? { ...fresh, ...h, weight: h.weight } : h;
          });
          setHoldings(merged);
          setRiskTolerance(row.risk_tolerance ?? 50);
          LS.set("holdings",      merged);
          LS.set("riskTolerance", row.risk_tolerance ?? 50);
        }

        // Load watchlist
        const { data: wlRows } = await supabase
          .from("watchlists")
          .select("tickers")
          .eq("user_id", USER_ID)
          .order("updated_at", { ascending: false })
          .limit(1);

        if (wlRows?.length) {
          setWatchlist(wlRows[0].tickers);
          LS.set("mw_watchlist", wlRows[0].tickers);
        }
      } catch (err) {
        console.warn("[usePersistence] load failed:", err.message);
      } finally {
        setLoaded(true);
      }
    };

    load();
  }, []);

  // ── Save portfolio to Supabase (debounced) ────────────
  const savePortfolio = useCallback((newHoldings, newRisk) => {
    // Always mirror to localStorage immediately
    LS.set("holdings",      newHoldings);
    LS.set("riskTolerance", newRisk);

    if (!hasSupabase) return;

    clearTimeout(saveTimer.current);
    setSyncStatus("saving");

    saveTimer.current = setTimeout(async () => {
      try {
        // Slim down holdings — only save what matters, not live price data
        const slim = newHoldings.map(h => ({
          ticker:         h.ticker,
          name:           h.name,
          sector:         h.sector,
          weight:         h.weight,
          pe:             h.pe,
          pb:             h.pb,
          evEbitda:       h.evEbitda,
          beta:           h.beta,
          expectedReturn: h.expectedReturn,
          volatility:     h.volatility,
          dividend:       h.dividend,
        }));

        const { error } = await supabase
          .from("portfolios")
          .upsert({
            user_id:       USER_ID,
            holdings:      slim,
            risk_tolerance: newRisk,
            updated_at:    new Date().toISOString(),
          }, { onConflict: "user_id" });

        if (error) throw error;
        setSyncStatus("saved");
        setTimeout(() => setSyncStatus("idle"), 2000);
      } catch (err) {
        console.warn("[usePersistence] save failed:", err.message);
        setSyncStatus("error");
        setTimeout(() => setSyncStatus("idle"), 4000);
      }
    }, 800);
  }, []);

  // ── Save watchlist to Supabase (debounced) ────────────
  const saveWatchlist = useCallback((tickers) => {
    LS.set("mw_watchlist", tickers);

    if (!hasSupabase) return;

    clearTimeout(watchTimer.current);
    watchTimer.current = setTimeout(async () => {
      try {
        const { error } = await supabase
          .from("watchlists")
          .upsert({
            user_id:    USER_ID,
            tickers,
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id" });
        if (error) throw error;
      } catch (err) {
        console.warn("[usePersistence] watchlist save failed:", err.message);
      }
    }, 800);
  }, []);

  // ── Wrapped setters that auto-save ────────────────────
  const setHoldingsAndSave = useCallback((updater) => {
    setHoldings(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      setRiskTolerance(rt => { savePortfolio(next, rt); return rt; });
      return next;
    });
  }, [savePortfolio]);

  const setRiskToleranceAndSave = useCallback((val) => {
    setRiskTolerance(val);
    setHoldings(h => { savePortfolio(h, val); return h; });
  }, [savePortfolio]);

  const setWatchlistAndSave = useCallback((updater) => {
    setWatchlist(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveWatchlist(next);
      return next;
    });
  }, [saveWatchlist]);

  return {
    // State
    holdings,
    riskTolerance,
    watchlist,
    syncStatus,
    loaded,
    // Setters (use these instead of direct setState)
    setHoldings:      setHoldingsAndSave,
    setRiskTolerance: setRiskToleranceAndSave,
    setWatchlist:     setWatchlistAndSave,
    // Expose user ID for debugging
    userId: USER_ID,
    hasSupabase,
  };
}
