// src/hooks/useStockData.js
// ─────────────────────────────────────────────────────────────
// Yahoo Finance v8/chart — polls every 2 s for quotes.
// fetchCandles supports intraday: 1m, 5m, 15m, 1h intervals.

import { useState, useEffect, useCallback, useRef } from "react";

export function proxyUrl(url) {
  return `/api/proxy?url=${encodeURIComponent(url)}`;
}

// ── Single quote fetch ─────────────────────────────────────
export async function fetchQuote(ticker) {
  const raw  = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d&includePrePost=false`;
  const res  = await fetch(proxyUrl(raw));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json   = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error(json?.chart?.error?.description ?? "No data");

  const meta   = result.meta ?? {};
  const q      = result.indicators?.quote?.[0] ?? {};
  const adj    = result.indicators?.adjclose?.[0]?.adjclose ?? q.close ?? [];

  const price     = meta.regularMarketPrice ?? adj[adj.length - 1] ?? 0;
  const prev      = meta.chartPreviousClose ?? meta.previousClose  ?? price;
  const change    = price - prev;
  const changePct = prev ? (change / prev) * 100 : 0;

  return {
    ticker,
    name:      meta.longName ?? meta.shortName ?? ticker,
    price:     +price.toFixed(2),
    change:    +change.toFixed(2),
    changePct: +changePct.toFixed(2),
    volume:    meta.regularMarketVolume ?? null,
    marketCap: meta.marketCap ?? null,
    currency:  meta.currency ?? "USD",
    high52:    meta.fiftyTwoWeekHigh ?? null,
    low52:     meta.fiftyTwoWeekLow  ?? null,
    dayHigh:   meta.regularMarketDayHigh ?? null,
    dayLow:    meta.regularMarketDayLow  ?? null,
    open:      meta.regularMarketOpen    ?? null,
    positive:  changePct >= 0,
    updated:   Date.now(),
  };
}

// ── 7-day sparkline (fetched once per session) ─────────────
export async function fetchSparkline(ticker) {
  const raw    = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=7d&includePrePost=false`;
  const res    = await fetch(proxyUrl(raw));
  if (!res.ok) return [];
  const json   = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) return [];
  const q   = result.indicators?.quote?.[0] ?? {};
  const adj = result.indicators?.adjclose?.[0]?.adjclose ?? q.close ?? [];
  const ts  = result.timestamp ?? [];
  return ts.map((t, i) => ({
    date:   new Date(t * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    v:      adj[i] != null ? +adj[i].toFixed(2) : null,
    open:   q.open?.[i]   != null ? +q.open[i].toFixed(2)  : null,
    high:   q.high?.[i]   != null ? +q.high[i].toFixed(2)  : null,
    low:    q.low?.[i]    != null ? +q.low[i].toFixed(2)   : null,
    close:  adj[i]        != null ? +adj[i].toFixed(2)     : null,
    volume: q.volume?.[i] ?? null,
  })).filter(d => d.v !== null);
}

// ── OHLCV candles ──────────────────────────────────────────
// Supports intraday (1m, 5m, 15m, 1h) and daily/weekly/monthly.
//
// Yahoo interval / range compatibility:
//   1m  → max range 7d
//   2m  → max range 60d
//   5m  → max range 60d
//   15m → max range 60d
//   1h  → max range 730d
//   1d  → any
//   1wk → any
//   1mo → any
//
// We map our UI "range" keys to the best interval automatically.
export async function fetchCandles(ticker, range = "5d") {
  const { interval, yahooRange } = resolveIntervalRange(range);
  const raw  = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=${interval}&range=${yahooRange}&includePrePost=false`;
  const res  = await fetch(proxyUrl(raw));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json   = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error(json?.chart?.error?.description ?? "No candle data");

  const ts  = result.timestamp ?? [];
  const q   = result.indicators?.quote?.[0] ?? {};
  const adj = result.indicators?.adjclose?.[0]?.adjclose ?? q.close ?? [];

  // Intraday: format timestamp as HH:MM or "Mon DD HH:MM"
  const isIntraday = ["1m","2m","5m","15m","30m","1h"].includes(interval);

  return ts.map((t, i) => {
    const d = new Date(t * 1000);
    let date;
    if (isIntraday) {
      const hhmm = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
      // For ranges > 1 day, prefix with Mon DD
      if (yahooRange !== "1d") {
        const prefix = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        date = `${prefix} ${hhmm}`;
      } else {
        date = hhmm;
      }
    } else {
      const longRange = yahooRange === "5y" || yahooRange === "2y";
      date = d.toLocaleDateString("en-US", {
        month: "short", day: "numeric",
        ...(longRange ? { year: "2-digit" } : {}),
      });
    }

    return {
      date,
      open:   q.open?.[i]   != null ? +q.open[i].toFixed(2)  : null,
      high:   q.high?.[i]   != null ? +q.high[i].toFixed(2)  : null,
      low:    q.low?.[i]    != null ? +q.low[i].toFixed(2)   : null,
      close:  adj[i]        != null ? +adj[i].toFixed(2)     : null,
      volume: q.volume?.[i] ?? null,
    };
  }).filter(d => d.close !== null);
}

// ── Range → interval resolver ──────────────────────────────
// Maps our UI range labels to the best Yahoo interval + range param.
export function resolveIntervalRange(range) {
  const map = {
    // Intraday
    "1d-1m":  { interval: "1m",  yahooRange: "1d"  },
    "1d":     { interval: "5m",  yahooRange: "1d"  },  // default "today" = 5m candles
    "5d":     { interval: "5m",  yahooRange: "5d"  },
    "5d-15m": { interval: "15m", yahooRange: "5d"  },
    "1mo-1h": { interval: "1h",  yahooRange: "1mo" },
    // Daily+
    "1mo":    { interval: "1d",  yahooRange: "1mo" },
    "3mo":    { interval: "1d",  yahooRange: "3mo" },
    "6mo":    { interval: "1d",  yahooRange: "6mo" },
    "1y":     { interval: "1wk", yahooRange: "1y"  },
    "2y":     { interval: "1wk", yahooRange: "2y"  },
    "5y":     { interval: "1mo", yahooRange: "5y"  },
  };
  return map[range] ?? { interval: "5m", yahooRange: "5d" };
}

// ── News ───────────────────────────────────────────────────
export async function fetchStockNews(ticker) {
  const raw = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(ticker)}&quotesCount=0&newsCount=8`;
  const res  = await fetch(proxyUrl(raw));
  if (!res.ok) throw new Error("News fetch failed");
  const json = await res.json();
  return (json?.news ?? []).map(n => ({
    title:  n.title,
    url:    n.link,
    source: n.publisher,
    time:   n.providerPublishTime ? new Date(n.providerPublishTime * 1000).toLocaleString() : "",
  }));
}

// ── Ticker search ──────────────────────────────────────────
export async function searchTicker(query) {
  const raw = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=6&newsCount=0`;
  const res  = await fetch(proxyUrl(raw));
  if (!res.ok) throw new Error("Search failed");
  const json = await res.json();
  return (json?.quotes ?? [])
    .filter(q => q.quoteType === "EQUITY" || q.quoteType === "ETF")
    .slice(0, 6);
}

// ═══════════════════════════════════════════════════════════
// Global hook — single instance in App.jsx
// ═══════════════════════════════════════════════════════════
const quoteCache     = {};
const sparklineCache = {};

export function useStockData(tickers = []) {
  const [quotes,     setQuotes]     = useState({});
  const [loading,    setLoading]    = useState(false);
  const [errors,     setErrors]     = useState({});
  const [lastUpdate, setLastUpdate] = useState(null);

  const pollRef   = useRef(null);
  const tickerKey = [...tickers].sort().join(",");

  const fetchOne = useCallback(async (ticker) => {
    const q = await fetchQuote(ticker);
    if (!sparklineCache[ticker]) {
      try { sparklineCache[ticker] = await fetchSparkline(ticker); }
      catch { sparklineCache[ticker] = []; }
    }
    const full = { ...q, sparkline: sparklineCache[ticker] };
    quoteCache[ticker] = full;
    return full;
  }, []);

  const poll = useCallback(async (list, isInitial = false) => {
    if (!list?.length) return;
    if (isInitial) setLoading(true);
    const newQ = {}, newE = {};
    await Promise.allSettled(list.map(async t => {
      try   { newQ[t] = await fetchOne(t); }
      catch (e) { newE[t] = e.message; }
    }));
    setQuotes(prev => ({ ...prev, ...newQ }));
    if (Object.keys(newE).length) setErrors(prev => ({ ...prev, ...newE }));
    if (isInitial) setLoading(false);
    setLastUpdate(new Date());
  }, [fetchOne]);

  useEffect(() => {
    if (!tickers.length) return;
    poll(tickers, true);
    clearInterval(pollRef.current);
    pollRef.current = setInterval(() => poll(tickers), 2000);
    return () => clearInterval(pollRef.current);
  // eslint-disable-next-line
  }, [tickerKey]);

  const getQuote = useCallback(t => quotes[t] ?? quoteCache[t] ?? null, [quotes]);

  return {
    quotes, errors, loading, lastUpdate, getQuote,
    refresh: () => poll(tickers, true),
  };
}
