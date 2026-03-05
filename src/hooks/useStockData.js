// ── useStockData.js ────────────────────────────────────────
// Single source of truth for all live market data.
// Call ONCE in App.jsx, pass quotes/details down to all tabs.

import { useState, useEffect, useCallback, useRef } from "react";

export function proxyUrl(url) {
  return `/api/proxy?url=${encodeURIComponent(url)}`;
}

// ── Fetch quote + 7d sparkline ─────────────────────────────
export async function fetchQuote(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=7d`;
  const res = await fetch(proxyUrl(url));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error("No data");

  const meta   = result.meta;
  const closes = result.indicators?.adjclose?.[0]?.adjclose
               ?? result.indicators?.quote?.[0]?.close ?? [];
  const timestamps = result.timestamp ?? [];

  const price     = meta.regularMarketPrice ?? closes[closes.length - 1];
  const prev      = meta.chartPreviousClose ?? meta.previousClose ?? closes[closes.length - 2];
  const change    = price - prev;
  const changePct = prev ? (change / prev) * 100 : 0;

  return {
    ticker,
    name:      meta.longName ?? meta.shortName ?? ticker,
    price:     parseFloat(price?.toFixed(2)),
    change:    parseFloat(change?.toFixed(2)),
    changePct: parseFloat(changePct?.toFixed(2)),
    volume:    meta.regularMarketVolume,
    marketCap: meta.marketCap,
    currency:  meta.currency ?? "USD",
    sparkline: timestamps.map((ts, i) => ({
      t: new Date(ts * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      v: closes[i] ?? null,
    })).filter(d => d.v !== null),
    positive:  changePct >= 0,
    updated:   new Date().toLocaleTimeString(),
  };
}

// ── Fetch full fundamentals ────────────────────────────────
export async function fetchDetail(ticker) {
  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=price,summaryDetail,defaultKeyStatistics,financialData,recommendationTrend`;
  const res = await fetch(proxyUrl(url));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const s = json?.quoteSummary?.result?.[0];
  if (!s) throw new Error("No detail");

  const price    = s.price ?? {};
  const summary  = s.summaryDetail ?? {};
  const keyStats = s.defaultKeyStatistics ?? {};
  const finData  = s.financialData ?? {};
  const rec      = s.recommendationTrend?.trend?.[0] ?? {};

  const totalRecs = (rec.strongBuy ?? 0) + (rec.buy ?? 0) + (rec.hold ?? 0) + (rec.sell ?? 0) + (rec.strongSell ?? 0);
  const eps        = keyStats.trailingEps?.raw ?? null;
  const growth     = finData.revenueGrowth?.raw ?? 0.08;
  const currentP   = price.regularMarketPrice?.raw;
  const dcfEst     = eps ? parseFloat((eps * 15 * (1 + growth)).toFixed(2)) : null;
  const dcfUpside  = dcfEst && currentP ? parseFloat((((dcfEst - currentP) / currentP) * 100).toFixed(1)) : null;

  return {
    ticker,
    name:          price.longName ?? price.shortName ?? ticker,
    price:         currentP,
    changePct:     price.regularMarketChangePercent?.raw != null ? price.regularMarketChangePercent.raw * 100 : null,
    high52:        summary.fiftyTwoWeekHigh?.raw,
    low52:         summary.fiftyTwoWeekLow?.raw,
    pe:            summary.trailingPE?.raw ?? keyStats.forwardPE?.raw,
    forwardPE:     keyStats.forwardPE?.raw,
    pb:            keyStats.priceToBook?.raw,
    eps,
    revenue:       finData.totalRevenue?.raw,
    revenueGrowth: finData.revenueGrowth?.raw,
    grossMargin:   finData.grossMargins?.raw,
    profitMargin:  finData.profitMargins?.raw,
    debtToEquity:  finData.debtToEquity?.raw,
    roe:           finData.returnOnEquity?.raw,
    targetPrice:   finData.targetMeanPrice?.raw,
    recommendation:finData.recommendationKey,
    strongBuy:     rec.strongBuy ?? 0,
    buy:           rec.buy ?? 0,
    hold:          rec.hold ?? 0,
    sell:          rec.sell ?? 0,
    strongSell:    rec.strongSell ?? 0,
    buyPct:        totalRecs ? Math.round(((rec.strongBuy + rec.buy) / totalRecs) * 100) : null,
    totalRecs,
    dcfEst,
    dcfUpside,
    beta:          summary.beta?.raw ?? keyStats.beta?.raw,
    dividendYield: summary.dividendYield?.raw,
    marketCap:     price.marketCap?.raw,
    sector:        price.sector ?? "",
    industry:      price.industry ?? "",
    evEbitda:      keyStats.enterpriseToEbitda?.raw,
    expectedReturn: finData.returnOnEquity?.raw != null ? parseFloat((finData.returnOnEquity.raw * 100).toFixed(1)) : null,
    volatility:    null, // not available from Yahoo summary
  };
}

// ── Fetch stock news ───────────────────────────────────────
export async function fetchStockNews(ticker) {
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${ticker}&quotesCount=0&newsCount=8`;
  const res = await fetch(proxyUrl(url));
  if (!res.ok) throw new Error("News fetch failed");
  const json = await res.json();
  return (json?.news ?? []).map(n => ({
    title:  n.title,
    url:    n.link,
    source: n.publisher,
    time:   n.providerPublishTime ? new Date(n.providerPublishTime * 1000).toLocaleString() : "",
  }));
}

// ── Search ─────────────────────────────────────────────────
export async function searchTicker(query) {
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=6&newsCount=0`;
  const res = await fetch(proxyUrl(url));
  if (!res.ok) throw new Error("Search failed");
  const json = await res.json();
  return (json?.quotes ?? []).filter(q => q.quoteType === "EQUITY" || q.quoteType === "ETF").slice(0, 6);
}

// ── The global hook ────────────────────────────────────────
const quoteCache  = {};
const detailCache = {};

export function useStockData(tickers = []) {
  const [quotes,     setQuotes]     = useState({});
  const [details,    setDetails]    = useState({});
  const [loading,    setLoading]    = useState(false);
  const [errors,     setErrors]     = useState({});
  const [lastUpdate, setLastUpdate] = useState(null);
  const intervalRef  = useRef();
  const tickerKey    = [...tickers].sort().join(",");

  const refresh = useCallback(async (tickerList) => {
    if (!tickerList?.length) return;
    setLoading(true);
    const newQ = {}, newE = {};
    await Promise.allSettled(tickerList.map(async t => {
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
    if (tickers.length) intervalRef.current = setInterval(() => refresh(tickers), 30000);
    return () => clearInterval(intervalRef.current);
  // eslint-disable-next-line
  }, [tickerKey]);

  const loadDetail = useCallback(async (ticker) => {
    if (detailCache[ticker]) { setDetails(p => ({ ...p, [ticker]: detailCache[ticker] })); return detailCache[ticker]; }
    try {
      const d = await fetchDetail(ticker);
      detailCache[ticker] = d;
      setDetails(p => ({ ...p, [ticker]: d }));
      return d;
    } catch (e) { console.warn("Detail failed:", ticker, e.message); return null; }
  }, []);

  return {
    quotes, details, errors, loading, lastUpdate,
    getQuote:  t => quotes[t]  ?? quoteCache[t]  ?? null,
    getDetail: t => details[t] ?? detailCache[t] ?? null,
    loadDetail,
    refresh: () => refresh(tickers),
  };
}
