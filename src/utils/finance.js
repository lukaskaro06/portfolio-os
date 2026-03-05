import { RISK_FREE_RATE } from "../data/stocks";

// ── Valuation Score (0 – 100, higher = cheaper) ────────────
// Combines P/E, P/B, EV/EBITDA into a single score.
// Thresholds chosen to reflect typical S&P 500 ranges.
export function getValuationScore(stock) {
  const peScore    = Math.max(0, 100 - (stock.pe      / 60)  * 100);
  const pbScore    = Math.max(0, 100 - (stock.pb      / 60)  * 100);
  const evScore    = Math.max(0, 100 - (stock.evEbitda / 45) * 100);
  return parseFloat(((peScore + pbScore + evScore) / 3).toFixed(1));
}

// ── Valuation label + accent colour ───────────────────────
export function getValuationLabel(score) {
  if (score >= 65) return { label: "UNDERVALUED", color: "#00ff9d" };
  if (score >= 40) return { label: "FAIR VALUE",  color: "#ffd700" };
  return               { label: "OVERVALUED",  color: "#ff6b35" };
}

// ── Portfolio-level metrics from a holdings array ─────────
// Each holding must have: weight (0-100), expectedReturn,
// volatility, pe, pb, evEbitda, beta, dividend
export function calcPortfolioMetrics(holdings) {
  if (!holdings.length) return null;

  const w = holdings.map(h => h.weight / 100);

  const ret     = holdings.reduce((s, h, i) => s + w[i] * h.expectedReturn,  0);
  const varP    = holdings.reduce((s, h, i) => s + Math.pow(w[i] * h.volatility, 2), 0);
  const vol     = Math.sqrt(varP);
  const sharpe  = (ret - RISK_FREE_RATE) / vol;
  const avgPE   = holdings.reduce((s, h, i) => s + w[i] * h.pe,          0);
  const avgPB   = holdings.reduce((s, h, i) => s + w[i] * h.pb,          0);
  const avgEV   = holdings.reduce((s, h, i) => s + w[i] * h.evEbitda,    0);
  const beta    = holdings.reduce((s, h, i) => s + w[i] * h.beta,        0);
  const divYld  = holdings.reduce((s, h, i) => s + w[i] * h.dividend,    0);

  return {
    ret:      ret.toFixed(2),
    vol:      vol.toFixed(2),
    sharpe:   sharpe.toFixed(2),
    avgPE:    avgPE.toFixed(1),
    avgPB:    avgPB.toFixed(1),
    avgEV:    avgEV.toFixed(1),
    beta:     beta.toFixed(2),
    divYield: divYld.toFixed(2),
  };
}

// ── Valuation-driven optimizer ────────────────────────────
// Objective: score_i = adj_return_i / (vol_i * risk_penalty)
// Undervalued stocks get a return uplift proportional to their
// valuation score. Risk tolerance (0-100) scales the penalty.
export function optimizeWeights(holdings, riskTolerance) {
  const rt = riskTolerance / 100;

  const scored = holdings.map(h => {
    const valScore  = getValuationScore(h);
    // Undervalued bonus: up to +10% on expected return
    const adjReturn = h.expectedReturn * (1 + (valScore - 50) / 200);
    const penalty   = h.volatility * (1 - rt * 0.5);
    const score     = Math.max(0, (adjReturn - RISK_FREE_RATE * (1 - rt)) / penalty);
    return { ...h, _score: score };
  });

  const total = scored.reduce((s, h) => s + h._score, 0);

  return scored.map(h => ({
    ...h,
    weight: total > 0
      ? parseFloat(((h._score / total) * 100).toFixed(1))
      : h.weight,
  }));
}

// ── Monte Carlo simulation ────────────────────────────────
// Returns `simCount` paths of `years*12` monthly returns.
// Uses normal approximation: r_monthly ~ N(μ/12, σ/√12)
export function runMonteCarlo({
  annualReturn,    // e.g. 11.5  (percent)
  annualVol,       // e.g. 18.3  (percent)
  initialValue = 100_000,
  years        = 10,
  simCount     = 200,
}) {
  const mu    = annualReturn / 100 / 12;
  const sigma = annualVol    / 100 / Math.sqrt(12);
  const steps = years * 12;
  const paths = [];

  // Box-Muller for standard normal samples
  const randn = () => {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  for (let s = 0; s < simCount; s++) {
    const path = [initialValue];
    for (let t = 1; t <= steps; t++) {
      const prev = path[t - 1];
      path.push(prev * Math.exp(mu - 0.5 * sigma * sigma + sigma * randn()));
    }
    paths.push(path);
  }

  // Compute percentile bands at each time step
  const bands = [];
  for (let t = 0; t <= steps; t++) {
    const vals = paths.map(p => p[t]).sort((a, b) => a - b);
    const pct  = (p) => vals[Math.floor(p * simCount)];
    bands.push({
      month:  t,
      p10:    Math.round(pct(0.10)),
      p25:    Math.round(pct(0.25)),
      median: Math.round(pct(0.50)),
      p75:    Math.round(pct(0.75)),
      p90:    Math.round(pct(0.90)),
    });
  }

  return { paths, bands };
}

// ── Efficient Frontier (mean-variance, simplified) ────────
// Sweeps target returns and finds min-variance weight vectors
// using a greedy 2-asset approximation (N-asset needs QP solver).
// For demo purposes we use the closed-form 2-fund separation
// across a grid of risk-aversion parameters λ.
export function buildEfficientFrontier(universe) {
  const points = [];
  for (let lambda = 0.01; lambda <= 5; lambda += 0.08) {
    // Score each asset under this risk aversion
    const scores = universe.map(s => {
      const adjR = s.expectedReturn - lambda * s.volatility;
      return Math.max(0, adjR);
    });
    const total = scores.reduce((a, b) => a + b, 0);
    if (total === 0) continue;
    const w = scores.map(sc => sc / total);

    const ret = universe.reduce((s, a, i) => s + w[i] * a.expectedReturn, 0);
    const vol = Math.sqrt(universe.reduce((s, a, i) => s + Math.pow(w[i] * a.volatility, 2), 0));
    points.push({ vol: parseFloat(vol.toFixed(2)), ret: parseFloat(ret.toFixed(2)) });
  }
  // Deduplicate and sort by vol
  return points
    .filter((p, i, arr) => arr.findIndex(q => q.vol === p.vol) === i)
    .sort((a, b) => a.vol - b.vol);
}

// ── Formatting helpers ─────────────────────────────────────
export const fmt = {
  pct:      v  => `${Number(v).toFixed(2)}%`,
  dollar:   v  => `$${Number(v).toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
  number:   v  => Number(v).toFixed(2),
  sign:     v  => (v >= 0 ? "+" : "") + Number(v).toFixed(2),
};
// ── APPEND THESE FUNCTIONS TO THE BOTTOM OF src/utils/finance.js ──

// ── Backtest engine ────────────────────────────────────────
// Takes historical monthly price series per holding and
// computes blended portfolio returns vs a benchmark.
//
// Input:
//   priceHistory  – { AAPL: [{date, close}, ...], ... }
//   weights       – { AAPL: 0.25, MSFT: 0.20, ... }  (must sum to 1)
//   benchmark     – [{ date, close }, ...]  (e.g. SPY)
//
// Output: see return object below
export function runBacktest({ priceHistory, weights, benchmark }) {
  // ── Step 1: compute monthly returns per ticker ───────────
  const tickerReturns = {};
  for (const [ticker, prices] of Object.entries(priceHistory)) {
    const sorted = [...prices].sort((a, b) => new Date(a.date) - new Date(b.date));
    tickerReturns[ticker] = sorted.slice(1).map((p, i) => ({
      date:   p.date,
      return: (p.close - sorted[i].close) / sorted[i].close,
    }));
  }
// ── Step 2: find common dates across all tickers ─────────
  // Guard: skip tickers that came back empty
  const validReturns = Object.values(tickerReturns).filter(r => r.length > 0);
  if (validReturns.length === 0) throw new Error("No valid price history returned for any holding.");

  const dateSets = validReturns.map(r => new Set(r.map(x => x.date)));
  const commonDates = [...dateSets[0]].filter(d => dateSets.every(s => s.has(d))).sort();

  if (commonDates.length === 0) throw new Error("No overlapping dates found across holdings.");

  // ── Step 3: blend into portfolio returns ─────────────────
  const portfolioReturns = commonDates.map(date => {
    const blended = Object.entries(weights).reduce((sum, [ticker, w]) => {
      const row = tickerReturns[ticker]?.find(r => r.date === date);
      return sum + (row ? row.return * w : 0);
    }, 0);
    return { date, return: blended };
  });

  // ── Step 4: benchmark returns ────────────────────────────
  const benchSorted  = [...benchmark].sort((a, b) => new Date(a.date) - new Date(b.date));
  const benchReturns = benchSorted.slice(1).map((p, i) => ({
    date:   p.date,
    return: (p.close - benchSorted[i].close) / benchSorted[i].close,
  }));
  const benchMap = Object.fromEntries(benchReturns.map(r => [r.date, r.return]));

  // ── Step 5: cumulative return series (for chart) ─────────
  let portCum  = 1;
  let benchCum = 1;
  const cumSeries = portfolioReturns.map(({ date, return: r }) => {
    portCum  *= (1 + r);
    benchCum *= (1 + (benchMap[date] ?? 0));
    return {
      date,
      portfolio:  parseFloat(((portCum  - 1) * 100).toFixed(2)),
      benchmark:  parseFloat(((benchCum - 1) * 100).toFixed(2)),
    };
  });

  // ── Step 6: risk metrics ──────────────────────────────────
  const rets    = portfolioReturns.map(r => r.return);
  const bRets   = portfolioReturns.map(r => benchMap[r.date] ?? 0);
  const metrics = calcRiskMetrics(rets, bRets);

  // ── Step 7: drawdown series ───────────────────────────────
  let peak = 1;
  let nav  = 1;
  const drawdownSeries = portfolioReturns.map(({ date, return: r }) => {
    nav  *= (1 + r);
    peak  = Math.max(peak, nav);
    return { date, drawdown: parseFloat((((nav - peak) / peak) * 100).toFixed(2)) };
  });

  // ── Step 8: monthly returns heatmap data ─────────────────
  const monthlyHeatmap = buildMonthlyHeatmap(portfolioReturns);

  return { cumSeries, drawdownSeries, monthlyHeatmap, metrics };
}

// ── Risk metrics calculator ────────────────────────────────
// rets   – array of monthly portfolio returns (decimals)
// bRets  – array of monthly benchmark returns (decimals)
export function calcRiskMetrics(rets, bRets) {
  const n          = rets.length;
  const mean       = rets.reduce((s, r) => s + r, 0) / n;
  const annReturn  = (Math.pow(1 + mean, 12) - 1) * 100;

  // Volatility (annualised)
  const variance   = rets.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / (n - 1);
  const annVol     = Math.sqrt(variance * 12) * 100;

  // Sharpe (Rf = 4.5% annual = 0.367% monthly)
  const rfMonthly  = 0.045 / 12;
  const sharpe     = ((mean - rfMonthly) / Math.sqrt(variance)) * Math.sqrt(12);

  // Sortino (only downside deviation)
  const downside   = rets.filter(r => r < rfMonthly);
  const downVar    = downside.reduce((s, r) => s + Math.pow(r - rfMonthly, 2), 0) / (n - 1);
  const sortino    = ((mean - rfMonthly) / Math.sqrt(downVar)) * Math.sqrt(12);

  // Max drawdown
  let peak = 1, nav = 1, maxDD = 0;
  rets.forEach(r => {
    nav  *= (1 + r);
    peak  = Math.max(peak, nav);
    maxDD = Math.min(maxDD, (nav - peak) / peak);
  });

  // Beta & Alpha vs benchmark
  const bMean   = bRets.reduce((s, r) => s + r, 0) / bRets.length;
  const cov     = rets.reduce((s, r, i) => s + (r - mean) * (bRets[i] - bMean), 0) / (n - 1);
  const bVar    = bRets.reduce((s, r) => s + Math.pow(r - bMean, 2), 0) / (n - 1);
  const beta    = bVar !== 0 ? cov / bVar : 1;
  const alpha   = (mean - rfMonthly - beta * (bMean - rfMonthly)) * 12 * 100;

  // Win rate
  const wins    = rets.filter(r => r > 0).length;
  const winRate = (wins / n) * 100;

  // Best / worst month
  const bestMonth  = Math.max(...rets) * 100;
  const worstMonth = Math.min(...rets) * 100;

  return {
    annReturn:  annReturn.toFixed(2),
    annVol:     annVol.toFixed(2),
    sharpe:     sharpe.toFixed(2),
    sortino:    sortino.toFixed(2),
    maxDD:      (maxDD * 100).toFixed(2),
    beta:       beta.toFixed(2),
    alpha:      alpha.toFixed(2),
    winRate:    winRate.toFixed(1),
    bestMonth:  bestMonth.toFixed(2),
    worstMonth: worstMonth.toFixed(2),
    numMonths:  n,
  };
}

// ── Monthly returns heatmap builder ───────────────────────
// Returns rows of { year, Jan, Feb, ..., Dec, Annual }
function buildMonthlyHeatmap(returns) {
  const byYearMonth = {};
  returns.forEach(({ date, return: r }) => {
    const [year, month] = date.split("-");
    if (!byYearMonth[year]) byYearMonth[year] = {};
    byYearMonth[year][parseInt(month)] = r;
  });

  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  return Object.entries(byYearMonth)
    .sort(([a], [b]) => a - b)
    .map(([year, months]) => {
      const row = { year };
      let annual = 1;
      MONTHS.forEach((m, i) => {
        const r = months[i + 1];
        row[m]  = r !== undefined ? parseFloat((r * 100).toFixed(2)) : null;
        if (r !== undefined) annual *= (1 + r);
      });
      row.Annual = parseFloat(((annual - 1) * 100).toFixed(2));
      return row;
    });
}
// ── APPEND THESE FUNCTIONS TO THE BOTTOM OF src/utils/finance.js ──

// ── DCF Model ──────────────────────────────────────────────
// Standard 2-stage DCF:
//   Stage 1: explicit forecast period (years 1-N)
//   Stage 2: terminal value via Gordon Growth Model
//
// Inputs:
//   revenueBase      – current year revenue per share ($)
//   revenueGrowth    – annual revenue growth rate (%, e.g. 8.5)
//   ebitMargin       – EBIT margin (%, e.g. 22.0)
//   taxRate          – effective tax rate (%, e.g. 21.0)
//   reinvestmentRate – % of NOPAT reinvested (%, e.g. 30.0)
//   wacc             – weighted avg cost of capital (%, e.g. 9.0)
//   terminalGrowth   – perpetual growth rate (%, e.g. 3.0)
//   forecastYears    – explicit forecast period (default 5)
//   sharesOut        – shares outstanding (millions, for total equity value)
//   currentPrice     – current stock price (for margin of safety)
//
// Returns: { intrinsicValue, upside, signal, stages, terminalValue, pvTerminal }
export function runDCF({
  revenueBase,
  revenueGrowth,
  ebitMargin,
  taxRate          = 21,
  reinvestmentRate = 30,
  wacc,
  terminalGrowth,
  forecastYears    = 5,
  currentPrice     = null,
}) {
  const g   = revenueGrowth    / 100;
  const m   = ebitMargin       / 100;
  const t   = taxRate          / 100;
  const rr  = reinvestmentRate / 100;
  const r   = wacc             / 100;
  const tg  = terminalGrowth   / 100;

  if (r <= tg) throw new Error("WACC must be greater than terminal growth rate.");

  // ── Stage 1: forecast FCF per year ───────────────────────
  let revenue = revenueBase;
  let pvSum   = 0;
  const stages = [];

  for (let yr = 1; yr <= forecastYears; yr++) {
    revenue       *= (1 + g);
    const ebit     = revenue * m;
    const nopat    = ebit * (1 - t);
    const fcf      = nopat * (1 - rr);
    const pv       = fcf / Math.pow(1 + r, yr);
    pvSum         += pv;

    stages.push({
      year:    yr,
      revenue: parseFloat(revenue.toFixed(2)),
      ebit:    parseFloat(ebit.toFixed(2)),
      nopat:   parseFloat(nopat.toFixed(2)),
      fcf:     parseFloat(fcf.toFixed(2)),
      pv:      parseFloat(pv.toFixed(2)),
    });
  }

  // ── Stage 2: terminal value ───────────────────────────────
  const lastFCF      = stages[stages.length - 1].fcf;
  const terminalFCF  = lastFCF * (1 + tg);
  const terminalValue = terminalFCF / (r - tg);
  const pvTerminal    = terminalValue / Math.pow(1 + r, forecastYears);

  const intrinsicValue = pvSum + pvTerminal;

  // ── Signal ────────────────────────────────────────────────
  let upside = null;
  let signal = null;
  if (currentPrice && currentPrice > 0) {
    upside = ((intrinsicValue - currentPrice) / currentPrice) * 100;
    signal = upside >  15 ? "BUY"
           : upside < -15 ? "SELL"
           :                "HOLD";
  }

  return {
    intrinsicValue: parseFloat(intrinsicValue.toFixed(2)),
    pvStage1:       parseFloat(pvSum.toFixed(2)),
    terminalValue:  parseFloat(terminalValue.toFixed(2)),
    pvTerminal:     parseFloat(pvTerminal.toFixed(2)),
    upside:         upside !== null ? parseFloat(upside.toFixed(1)) : null,
    signal,
    stages,
  };
}

// ── Sensitivity table ──────────────────────────────────────
// Sweeps WACC (rows) and terminal growth (cols) and returns
// a 2D grid of intrinsic values — standard IB sensitivity analysis.
//
// waccRange      – [min, max] e.g. [7, 11]
// tgRange        – [min, max] e.g. [1, 4]
// steps          – number of steps per axis (default 5)
export function buildSensitivityTable(dcfInputs, waccRange, tgRange, steps = 5) {
  const waccStep = (waccRange[1] - waccRange[0]) / (steps - 1);
  const tgStep   = (tgRange[1]  - tgRange[0])  / (steps - 1);

  const waccValues = Array.from({ length: steps }, (_, i) =>
    parseFloat((waccRange[0] + i * waccStep).toFixed(2))
  );
  const tgValues = Array.from({ length: steps }, (_, i) =>
    parseFloat((tgRange[0] + i * tgStep).toFixed(2))
  );

  const rows = waccValues.map(wacc => {
    const cols = tgValues.map(tg => {
      try {
        const { intrinsicValue } = runDCF({ ...dcfInputs, wacc, terminalGrowth: tg });
        return parseFloat(intrinsicValue.toFixed(2));
      } catch {
        return null;
      }
    });
    return { wacc, cols };
  });

  return { rows, tgValues, waccValues };
}