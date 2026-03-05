// ── marketData.js ──────────────────────────────────────────
// All FMP API calls live here. Components never call fetch()
// directly — they go through this service.
//
// Free tier: 250 calls/day
// Docs: https://financialmodelingprep.com/developer/docs

const API_KEY  = process.env.REACT_APP_FMP_KEY;
const BASE_URL = "https://financialmodelingprep.com/api/v3";

// Simple in-memory cache so we don't burn API calls on
// re-renders. Cache expires after 5 minutes.
const cache    = {};
const CACHE_MS = 5 * 60 * 1000;

async function apiFetch(path) {
  const url = `${BASE_URL}${path}${path.includes("?") ? "&" : "?"}apikey=${API_KEY}`;

  // Return cached value if fresh
  if (cache[url] && Date.now() - cache[url].ts < CACHE_MS) {
    return cache[url].data;
  }

  const res = await fetch(url);
  if (!res.ok) throw new Error(`FMP error ${res.status}: ${path}`);
  const data = await res.json();

  // FMP returns { "Error Message": "..." } on bad key / limit hit
  if (data?.["Error Message"]) throw new Error(data["Error Message"]);

  cache[url] = { data, ts: Date.now() };
  return data;
}

// ── Company profile ────────────────────────────────────────
// Returns live price, P/E, P/B, beta, dividend yield, sector
export async function fetchProfile(ticker) {
  const [data] = await apiFetch(`/profile/${ticker}`);
  if (!data) throw new Error(`No profile found for ${ticker}`);
  return {
    ticker:         data.symbol,
    name:           data.companyName,
    sector:         data.sector        || "Unknown",
    price:          data.price         ?? null,
    pe:             data.pe            ?? null,
    pb:             data.priceToBook   ?? null,
    beta:           data.beta          ?? null,
    dividend:       data.lastDiv       ?? 0,
    marketCap:      data.mktCap        ?? null,
    description:    data.description   ?? "",
    website:        data.website       ?? "",
    image:          data.image         ?? "",
  };
}

// ── Key metrics (EV/EBITDA, etc.) ─────────────────────────
export async function fetchKeyMetrics(ticker) {
  const [data] = await apiFetch(`/key-metrics-ttm/${ticker}`);
  if (!data) return {};
  return {
    evEbitda:       data.enterpriseValueOverEBITDATTM ?? null,
    roeTTM:         data.roeTTM                       ?? null,
    debtToEquity:   data.debtToEquityTTM              ?? null,
    currentRatio:   data.currentRatioTTM              ?? null,
    revenuePerShare: data.revenuePerShareTTM          ?? null,
  };
}

// ── Analyst price targets ──────────────────────────────────
// Used as a proxy for expected return
export async function fetchPriceTarget(ticker) {
  const data = await apiFetch(`/price-target-consensus/${ticker}`);
  if (!data || !data.targetConsensus) return null;
  return {
    targetHigh:    data.targetHigh,
    targetLow:     data.targetLow,
    targetMean:    data.targetConsensus,
    targetMedian:  data.targetMedian,
  };
}

// ── Full enriched stock data (combines all endpoints) ──────
// This is what usePortfolio calls — one function per ticker.
export async function fetchEnrichedStock(ticker, fallback = {}) {
  try {
    // Run profile + metrics in parallel to save time
    const [profile, metrics, target] = await Promise.allSettled([
      fetchProfile(ticker),
      fetchKeyMetrics(ticker),
      fetchPriceTarget(ticker),
    ]);

    const p = profile.status  === "fulfilled" ? profile.value  : {};
    const m = metrics.status  === "fulfilled" ? metrics.value  : {};
    const t = target.status   === "fulfilled" ? target.value   : null;

    // Derive expected return from analyst consensus target vs current price
    let expectedReturn = fallback.expectedReturn ?? 10;
    if (t?.targetMean && p?.price && p.price > 0) {
      expectedReturn = parseFloat(
        (((t.targetMean - p.price) / p.price) * 100 + (p.dividend ?? 0)).toFixed(2)
      );
    }

    // Derive volatility: FMP free tier doesn't give σ directly,
    // so we estimate from beta (σ_stock ≈ β × σ_market, σ_SPY ≈ 15%)
    const beta       = p.beta          ?? fallback.beta       ?? 1;
    const volatility = parseFloat(Math.max(10, beta * 15).toFixed(1));

    return {
      // Identity
      ticker:         p.ticker        ?? ticker,
      name:           p.name          ?? fallback.name  ?? ticker,
      sector:         p.sector        ?? fallback.sector ?? "Unknown",
      // Valuation
      price:          p.price         ?? null,
      pe:             p.pe            ?? fallback.pe     ?? 20,
      pb:             p.pb            ?? fallback.pb     ?? 3,
      evEbitda:       m.evEbitda      ?? fallback.evEbitda ?? 12,
      // Risk
      beta,
      volatility,
      // Return
      expectedReturn,
      dividend:       p.dividend      ?? fallback.dividend ?? 0,
      // Extra
      marketCap:      p.marketCap     ?? null,
      analystTarget:  t,
      roeTTM:         m.roeTTM        ?? null,
      debtToEquity:   m.debtToEquity  ?? null,
    };
  } catch (err) {
    console.warn(`fetchEnrichedStock(${ticker}) failed, using fallback:`, err.message);
    return { ...fallback, ticker, _error: err.message };
  }
}

// ── Batch fetch for multiple tickers ──────────────────────
// Returns a map: { AAPL: {...}, MSFT: {...} }
export async function fetchMultipleStocks(tickers, fallbacks = {}) {
  const results = await Promise.allSettled(
    tickers.map(t => fetchEnrichedStock(t, fallbacks[t] ?? {}))
  );
  return Object.fromEntries(
    results.map((r, i) => [
      tickers[i],
      r.status === "fulfilled" ? r.value : { ...fallbacks[tickers[i]], ticker: tickers[i] },
    ])
  );
}
