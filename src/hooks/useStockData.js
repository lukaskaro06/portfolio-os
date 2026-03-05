// ── useStockData.js  (src/hooks/useStockData.js) ───────────
// Uses ONLY v8/finance/chart — no quoteSummary → no 401 errors.
// Exports: useStockData hook, fetchQuote, fetchCandles, fetchStockNews, searchTicker

import { useState, useEffect, useCallback, useRef } from "react";

export function proxyUrl(url) {
  return `/api/proxy?url=${encodeURIComponent(url)}`;
}

// ── Quote  +  7-day sparkline ──────────────────────────────
export async function fetchQuote(ticker) {
  const raw  = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=7d&includePrePost=false`;
  const res  = await fetch(proxyUrl(raw));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json   = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error(json?.chart?.error?.description ?? "No data");

  const meta   = result.meta ?? {};
  const q      = result.indicators?.quote?.[0] ?? {};
  const adj    = result.indicators?.adjclose?.[0]?.adjclose ?? q.close ?? [];
  const ts     = result.timestamp ?? [];

  const price     = meta.regularMarketPrice ?? adj[adj.length - 1] ?? 0;
  const prev      = meta.chartPreviousClose ?? meta.previousClose  ?? adj[adj.length - 2] ?? price;
  const change    = price - prev;
  const changePct = prev ? (change / prev) * 100 : 0;

  const sparkline = ts.map((t, i) => ({
    date:   new Date(t * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    open:   q.open?.[i]   != null ? +q.open[i].toFixed(2)   : null,
    high:   q.high?.[i]   != null ? +q.high[i].toFixed(2)   : null,
    low:    q.low?.[i]    != null ? +q.low[i].toFixed(2)    : null,
    close:  adj[i]        != null ? +adj[i].toFixed(2)      : null,
    volume: q.volume?.[i] ?? null,
    v:      adj[i]        != null ? +adj[i].toFixed(2)      : null, // legacy compat
  })).filter(d => d.close !== null);

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
    sparkline,
    positive:  changePct >= 0,
    updated:   new Date().toLocaleTimeString(),
  };
}

// ── OHLCV candles for any range  (used by MarketWatch) ─────
export async function fetchCandles(ticker, range = "1mo") {
  const ivMap = { "1wk": "1d", "1mo": "1d", "3mo": "1d", "6mo": "1wk", "1y": "1wk", "2y": "1wk", "5y": "1mo" };
  const iv    = ivMap[range] ?? "1d";
  const raw   = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=${iv}&range=${range}&includePrePost=false`;
  const res   = await fetch(proxyUrl(raw));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json   = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error("No candle data");

  const ts  = result.timestamp ?? [];
  const q   = result.indicators?.quote?.[0] ?? {};
  const adj = result.indicators?.adjclose?.[0]?.adjclose ?? q.close ?? [];
  const longRange = range === "5y" || range === "2y";

  return ts.map((t, i) => ({
    date:   new Date(t * 1000).toLocaleDateString("en-US", {
              month: "short", day: "numeric",
              ...(longRange ? { year: "2-digit" } : {}),
            }),
    open:   q.open?.[i]   != null ? +q.open[i].toFixed(2)   : null,
    high:   q.high?.[i]   != null ? +q.high[i].toFixed(2)   : null,
    low:    q.low?.[i]    != null ? +q.low[i].toFixed(2)    : null,
    close:  adj[i]        != null ? +adj[i].toFixed(2)      : null,
    volume: q.volume?.[i] ?? null,
  })).filter(d => d.close !== null);
}

// ── Stock-specific news ────────────────────────────────────
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

// ── Global hook  (call once in App.jsx) ───────────────────
const quoteCache = {};

export function useStockData(tickers = []) {
  const [quotes,     setQuotes]     = useState({});
  const [loading,    setLoading]    = useState(false);
  const [errors,     setErrors]     = useState({});
  const [lastUpdate, setLastUpdate] = useState(null);
  const intervalRef  = useRef();
  const tickerKey    = [...tickers].sort().join(",");

  const refresh = useCallback(async (list) => {
    if (!list?.length) return;
    setLoading(true);
    const newQ = {}, newE = {};
    await Promise.allSettled(list.map(async t => {
      try   { const q = await fetchQuote(t); quoteCache[t] = q; newQ[t] = q; }
      catch (e) { newE[t] = e.message; }
    }));
    setQuotes(prev => ({ ...prev, ...newQ }));
    setErrors(prev => ({ ...prev, ...newE }));
    setLoading(false);
    setLastUpdate(new Date());
  // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (tickers.length) refresh(tickers);
    clearInterval(intervalRef.current);
    if (tickers.length)
      intervalRef.current = setInterval(() => refresh(tickers), 30_000);
    return () => clearInterval(intervalRef.current);
  // eslint-disable-next-line
  }, [tickerKey]);

  const getQuote = useCallback(t => quotes[t] ?? quoteCache[t] ?? null, [quotes]);

  return { quotes, errors, loading, lastUpdate, getQuote, refresh: () => refresh(tickers) };
}
