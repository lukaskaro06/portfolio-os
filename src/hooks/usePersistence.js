// src/hooks/usePersistence.js
import { useState, useEffect, useRef, useCallback } from "react";
import { supabase, hasSupabase } from "../lib/supabaseClient";
import { STOCK_UNIVERSE } from "../data/stocks";

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

const DEFAULT_HOLDINGS = [
  { ...STOCK_UNIVERSE[0], weight: 25 },
  { ...STOCK_UNIVERSE[1], weight: 20 },
  { ...STOCK_UNIVERSE[2], weight: 15 },
];
const DEFAULT_WATCHLIST = ["AAPL","MSFT","GOOGL","AMZN","NVDA","SPY","QQQ","BTC-USD"];

const LS = {
  get: (key, fb) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fb; } catch { return fb; } },
  set: (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} },
};

async function safeUpsert(table, data) {
  const { data: rows, error: selErr } = await supabase
    .from(table).select("id").eq("user_id", USER_ID).limit(1);
  if (selErr) throw new Error(`SELECT failed: ${selErr.message}`);

  const payload = { ...data, updated_at: new Date().toISOString() };

  if (rows && rows.length > 0) {
    const { error } = await supabase.from(table).update(payload).eq("user_id", USER_ID);
    if (error) throw new Error(`UPDATE failed: ${error.message}`);
  } else {
    const { error } = await supabase.from(table).insert({ user_id: USER_ID, ...payload });
    if (error) throw new Error(`INSERT failed: ${error.message}`);
  }
}

export function usePersistence() {
  const [holdings,      setHoldings]      = useState(() => LS.get("holdings",      DEFAULT_HOLDINGS));
  const [riskTolerance, setRiskTolerance] = useState(() => LS.get("riskTolerance", 50));
  const [watchlist,     setWatchlist]     = useState(() => LS.get("mw_watchlist",  DEFAULT_WATCHLIST));
  const [syncStatus,    setSyncStatus]    = useState("idle");
  const [loaded,        setLoaded]        = useState(false);

  const saveTimer  = useRef(null);
  const watchTimer = useRef(null);

  useEffect(() => {
    if (!hasSupabase) { setLoaded(true); return; }
    (async () => {
      try {
        const { data: ptf, error: pe } = await supabase
          .from("portfolios").select("holdings,risk_tolerance")
          .eq("user_id", USER_ID).order("updated_at", { ascending: false }).limit(1);
        if (pe) throw pe;

        if (ptf?.length) {
          const merged = (ptf[0].holdings ?? []).map(h => {
            const fresh = STOCK_UNIVERSE.find(s => s.ticker === h.ticker);
            return fresh ? { ...fresh, ...h, weight: h.weight } : h;
          });
          setHoldings(merged);
          setRiskTolerance(ptf[0].risk_tolerance ?? 50);
          LS.set("holdings", merged);
          LS.set("riskTolerance", ptf[0].risk_tolerance ?? 50);
        }

        const { data: wl, error: we } = await supabase
          .from("watchlists").select("tickers")
          .eq("user_id", USER_ID).order("updated_at", { ascending: false }).limit(1);
        if (we) throw we;

        if (wl?.length) {
          const tickers = wl[0].tickers ?? DEFAULT_WATCHLIST;
          setWatchlist(tickers);
          LS.set("mw_watchlist", tickers);
        }
      } catch (err) {
        console.warn("[usePersistence] load error:", err.message);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const savePortfolio = useCallback((newHoldings, newRisk) => {
    LS.set("holdings", newHoldings);
    LS.set("riskTolerance", newRisk);
    if (!hasSupabase) return;

    clearTimeout(saveTimer.current);
    setSyncStatus("saving");
    saveTimer.current = setTimeout(async () => {
      try {
        const slim = newHoldings.map(h => ({
          ticker: h.ticker, name: h.name, sector: h.sector, weight: h.weight,
          pe: h.pe ?? null, pb: h.pb ?? null, evEbitda: h.evEbitda ?? null,
          beta: h.beta ?? 1, expectedReturn: h.expectedReturn ?? 10,
          volatility: h.volatility ?? 20, dividend: h.dividend ?? 0,
        }));
        await safeUpsert("portfolios", { holdings: slim, risk_tolerance: newRisk });
        setSyncStatus("saved");
        setTimeout(() => setSyncStatus("idle"), 2000);
      } catch (err) {
        console.warn("[usePersistence] save error:", err.message);
        setSyncStatus("error");
        setTimeout(() => setSyncStatus("idle"), 4000);
      }
    }, 800);
  }, []);

  const saveWatchlist = useCallback((tickers) => {
    LS.set("mw_watchlist", tickers);
    if (!hasSupabase) return;
    clearTimeout(watchTimer.current);
    watchTimer.current = setTimeout(async () => {
      try { await safeUpsert("watchlists", { tickers }); }
      catch (err) { console.warn("[usePersistence] watchlist error:", err.message); }
    }, 800);
  }, []);

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
    holdings, riskTolerance, watchlist, syncStatus, loaded,
    setHoldings: setHoldingsAndSave,
    setRiskTolerance: setRiskToleranceAndSave,
    setWatchlist: setWatchlistAndSave,
    userId: USER_ID, hasSupabase,
  };
}
