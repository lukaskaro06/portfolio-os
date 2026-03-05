// ── backtestData.js ────────────────────────────────────────
// Routes through our own /api/proxy — no corsproxy.io, no CORS errors.

function yahooUrl(ticker, years) {
  const to   = Math.floor(Date.now() / 1000);
  const from = Math.floor((Date.now() - years * 365.25 * 24 * 3600 * 1000) / 1000);
  const t    = ticker === "BRK" ? "BRK-B" : ticker;
  const raw  = `https://query1.finance.yahoo.com/v8/finance/chart/${t}?interval=1mo&period1=${from}&period2=${to}`;
  return `/api/proxy?url=${encodeURIComponent(raw)}`;
}

// Cache key includes years so switching 3Y→5Y refetches correctly
const historyCache = {};

export async function fetchMonthlyPrices(ticker, years = 5) {
  const key = `${ticker}-${years}`;
  if (historyCache[key]) return historyCache[key];

  const res  = await fetch(yahooUrl(ticker, years));
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${ticker}`);

  const json  = await res.json();
  const chart = json?.chart?.result?.[0];
  if (!chart) {
    const msg = json?.chart?.error?.description ?? "No data returned";
    throw new Error(`Yahoo Finance: ${msg} (${ticker})`);
  }

  const timestamps = chart.timestamp ?? [];
  const closes     = chart.indicators?.adjclose?.[0]?.adjclose
                  ?? chart.indicators?.quote?.[0]?.close ?? [];

  if (!timestamps.length) throw new Error(`Empty history for ${ticker}`);

  const result = timestamps
    .map((ts, i) => ({ date: new Date(ts * 1000).toISOString().slice(0, 7), close: closes[i] }))
    .filter(d => d.close != null && !isNaN(d.close))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (result.length < 6) throw new Error(`Only ${result.length} months for ${ticker}`);

  historyCache[key] = result;
  return result;
}

export async function fetchBacktestData(tickers, years = 5) {
  const allTickers = [...new Set([...tickers, "SPY"])];
  const results    = await Promise.allSettled(allTickers.map(t => fetchMonthlyPrices(t, years)));

  const prices = {};
  const errors = [];

  allTickers.forEach((ticker, i) => {
    if (results[i].status === "fulfilled") prices[ticker] = results[i].value;
    else { console.warn(`Skipping ${ticker}:`, results[i].reason?.message); errors.push(ticker); }
  });

  const benchmark = prices["SPY"] ?? [];
  delete prices["SPY"];

  if (!benchmark.length) throw new Error("Could not fetch S&P 500 (SPY) benchmark data.");
  return { prices, benchmark, errors };
}
