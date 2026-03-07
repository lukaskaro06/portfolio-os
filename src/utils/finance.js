// src/utils/finance.js
// Pure calculation functions — no imports, no side-effects

// ── Formatters ─────────────────────────────────────────────
export const fmt = {
  dollar: n => {
    if (n == null || isNaN(n)) return "—";
    if (Math.abs(n) >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
    if (Math.abs(n) >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`;
    if (Math.abs(n) >= 1e6)  return `$${(n / 1e6).toFixed(2)}M`;
    if (Math.abs(n) >= 1e3)  return `$${(n / 1e3).toFixed(1)}K`;
    return `$${n.toFixed(2)}`;
  },
  pct: (n, d = 1) => n == null ? "—" : `${(+n).toFixed(d)}%`,
  num: (n, d = 2) => n == null ? "—" : (+n).toFixed(d),
};

// ── Valuation scoring ──────────────────────────────────────
// Returns 0–100 where 100 = most attractive
export function getValuationScore(stock) {
  let score = 50;

  // P/E (lower = better)
  if (stock.pe != null) {
    if      (stock.pe < 10)  score += 20;
    else if (stock.pe < 15)  score += 12;
    else if (stock.pe < 20)  score += 6;
    else if (stock.pe < 25)  score += 0;
    else if (stock.pe < 35)  score -= 8;
    else                      score -= 18;
  }

  // P/B (lower = better)
  if (stock.pb != null) {
    if      (stock.pb < 1)   score += 14;
    else if (stock.pb < 2)   score += 8;
    else if (stock.pb < 4)   score += 3;
    else if (stock.pb < 7)   score -= 4;
    else                      score -= 12;
  }

  // EV/EBITDA (lower = better)
  if (stock.evEbitda != null) {
    if      (stock.evEbitda < 8)   score += 14;
    else if (stock.evEbitda < 12)  score += 8;
    else if (stock.evEbitda < 18)  score += 2;
    else if (stock.evEbitda < 25)  score -= 6;
    else                            score -= 14;
  }

  // Expected return bonus
  if (stock.expectedReturn >= 15) score += 5;
  if (stock.expectedReturn <= 7)  score -= 5;

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function getValuationLabel(score) {
  if (score >= 65) return { label: "UNDERVALUED", color: "#00ff9d" };
  if (score >= 40) return { label: "FAIR VALUE",  color: "#ffd700" };
  return                   { label: "OVERVALUED",  color: "#ff6b35" };
}

// ── Portfolio metrics ──────────────────────────────────────
export function calcPortfolioMetrics(holdings) {
  if (!holdings.length) return null;
  const total = holdings.reduce((s, h) => s + h.weight, 0);
  if (total === 0) return null;

  const w = holdings.map(h => h.weight / total);

  const ret      = holdings.reduce((s, h, i) => s + w[i] * (h.expectedReturn ?? 10), 0);
  const vol      = Math.sqrt(holdings.reduce((s, h, i) => s + Math.pow(w[i] * (h.volatility ?? 20), 2), 0));
  const beta     = holdings.reduce((s, h, i) => s + w[i] * (h.beta ?? 1), 0);
  const divYield = holdings.reduce((s, h, i) => s + w[i] * (h.dividend ?? 0), 0);
  const sharpe   = vol > 0 ? (ret - 4.5) / vol : 0;

  return {
    ret:      ret.toFixed(1),
    vol:      vol.toFixed(1),
    beta:     beta.toFixed(2),
    sharpe:   sharpe.toFixed(2),
    divYield: divYield.toFixed(2),
  };
}

// ── Weight optimizer ───────────────────────────────────────
export function optimizeWeights(holdings, riskTolerance = 50) {
  if (!holdings.length) return holdings;
  const rf = 4.5;
  const riskPenalty = 1 - (riskTolerance / 100) * 0.6; // 1.0 (conservative) → 0.4 (aggressive)

  const scores = holdings.map(h => {
    const valScore = getValuationScore(h) / 100;
    const rawScore = (h.expectedReturn ?? 10) - riskPenalty * (h.volatility ?? 20) * 0.3 + valScore * 2;
    return Math.max(0.1, rawScore);
  });

  const total = scores.reduce((s, x) => s + x, 0);
  return holdings.map((h, i) => ({
    ...h,
    weight: parseFloat(((scores[i] / total) * 100).toFixed(1)),
  }));
}

// ── Efficient frontier ─────────────────────────────────────
export function buildEfficientFrontier(universe) {
  const points = [];
  for (let rt = 0; rt <= 100; rt += 5) {
    const optimized = optimizeWeights(universe.slice(0, 20), rt);
    const metrics   = calcPortfolioMetrics(optimized);
    if (metrics) {
      points.push({ vol: parseFloat(metrics.vol), ret: parseFloat(metrics.ret), riskTolerance: rt });
    }
  }
  return points.sort((a, b) => a.vol - b.vol);
}

// ── DCF model ──────────────────────────────────────────────
export function runDCF({
  revenueBase,      // current revenue $B
  revenueGrowth,    // % annual growth
  ebitMargin,       // % EBIT margin
  taxRate,          // % tax rate
  reinvestmentRate, // % of NOPAT reinvested
  wacc,             // % discount rate
  terminalGrowth,   // % terminal growth rate
  forecastYears,    // number of forecast years (usually 5)
  currentPrice,     // live stock price
}) {
  if (wacc <= terminalGrowth) throw new Error("WACC must exceed terminal growth rate");

  const cashFlows = [];
  let revenue = revenueBase;
  let totalPV = 0;

  for (let yr = 1; yr <= forecastYears; yr++) {
    revenue       *= (1 + revenueGrowth / 100);
    const ebit     = revenue * (ebitMargin / 100);
    const nopat    = ebit * (1 - taxRate / 100);
    const fcf      = nopat * (1 - reinvestmentRate / 100);
    const pv       = fcf / Math.pow(1 + wacc / 100, yr);
    totalPV       += pv;
    cashFlows.push({ year: yr, revenue: +revenue.toFixed(2), ebit: +ebit.toFixed(2), nopat: +nopat.toFixed(2), fcf: +fcf.toFixed(2), pv: +pv.toFixed(2) });
  }

  const terminalFCF = cashFlows[cashFlows.length - 1].fcf * (1 + terminalGrowth / 100);
  const terminalVal = terminalFCF / ((wacc - terminalGrowth) / 100);
  const terminalPV  = terminalVal / Math.pow(1 + wacc / 100, forecastYears);
  const intrinsicValue = totalPV + terminalPV;

  let signal = "HOLD";
  if (currentPrice && intrinsicValue > 0) {
    const upside = (intrinsicValue - currentPrice) / currentPrice;
    if (upside > 0.15)  signal = "BUY";
    if (upside < -0.15) signal = "SELL";
  }

  return {
    cashFlows,
    terminalValue: +terminalVal.toFixed(2),
    terminalPV:    +terminalPV.toFixed(2),
    intrinsicValue:+intrinsicValue.toFixed(2),
    pvFCF:         +totalPV.toFixed(2),
    terminalPct:   +((terminalPV / intrinsicValue) * 100).toFixed(1),
    signal,
  };
}

// ── DCF sensitivity table ──────────────────────────────────
export function buildSensitivityTable(baseInputs, waccRange, growthRange, steps = 5) {
  const waccStep   = (waccRange[1]  - waccRange[0])  / (steps - 1);
  const growthStep = (growthRange[1] - growthRange[0]) / (steps - 1);

  const waccs   = Array.from({ length: steps }, (_, i) => +(waccRange[0]  + i * waccStep).toFixed(2));
  const growths = Array.from({ length: steps }, (_, i) => +(growthRange[0] + i * growthStep).toFixed(2));

  const table = growths.map(tg =>
    waccs.map(w => {
      try {
        const r = runDCF({ ...baseInputs, wacc: w, terminalGrowth: tg });
        return +r.intrinsicValue.toFixed(2);
      } catch { return null; }
    })
  );

  return { waccs, growths, table };
}

// ── Backtest ───────────────────────────────────────────────
export function runBacktest({ priceHistory, weights, benchmark }) {
  // priceHistory: { ticker: [{ date, close }] }
  // weights: { ticker: weight (0-1) }
  // benchmark: [{ date, close }]

  // Find common dates across all series
  const tickerDates = Object.values(priceHistory).map(series => new Set(series.map(d => d.date)));
  const benchDates  = new Set(benchmark.map(d => d.date));
  const commonDates = [...benchDates].filter(d => tickerDates.every(set => set.has(d))).sort();

  if (commonDates.length < 2) throw new Error("Not enough common dates for backtest");

  // Build indexed price lookup
  const lookup = {};
  for (const [ticker, series] of Object.entries(priceHistory)) {
    lookup[ticker] = Object.fromEntries(series.map(d => [d.date, d.close]));
  }
  const benchLookup = Object.fromEntries(benchmark.map(d => [d.date, d.close]));

  // Calculate monthly returns
  const portfolioReturns = [];
  const benchmarkReturns = [];

  for (let i = 1; i < commonDates.length; i++) {
    const prevDate = commonDates[i - 1];
    const currDate = commonDates[i];

    let portRet = 0;
    for (const [ticker, weight] of Object.entries(weights)) {
      const prev = lookup[ticker]?.[prevDate];
      const curr = lookup[ticker]?.[currDate];
      if (prev && curr && prev > 0) {
        portRet += weight * ((curr - prev) / prev);
      }
    }

    const benchPrev = benchLookup[prevDate];
    const benchCurr = benchLookup[currDate];
    const benchRet  = benchPrev && benchCurr && benchPrev > 0
      ? (benchCurr - benchPrev) / benchPrev : 0;

    portfolioReturns.push({ date: currDate, return: portRet });
    benchmarkReturns.push({ date: currDate, return: benchRet });
  }

  // Build cumulative equity curves
  let portValue  = 1;
  let benchValue = 1;
  const curve = commonDates.slice(1).map((date, i) => {
    portValue  *= (1 + portfolioReturns[i].return);
    benchValue *= (1 + benchmarkReturns[i].return);
    return { date, portfolio: +(portValue * 100).toFixed(2), benchmark: +(benchValue * 100).toFixed(2) };
  });

  // Summary stats
  const portTotal   = portValue - 1;
  const benchTotal  = benchValue - 1;
  const portCagr    = Math.pow(portValue, 12 / portfolioReturns.length) - 1;
  const benchCagr   = Math.pow(benchValue, 12 / benchmarkReturns.length) - 1;

  const portAvg = portfolioReturns.reduce((s, r) => s + r.return, 0) / portfolioReturns.length;
  const portStd = Math.sqrt(portfolioReturns.reduce((s, r) => s + Math.pow(r.return - portAvg, 2), 0) / portfolioReturns.length);
  const sharpe  = portStd > 0 ? (portAvg - 0.045 / 12) / portStd * Math.sqrt(12) : 0;

  // Max drawdown
  let peak = 1, maxDd = 0, runVal = 1;
  for (const r of portfolioReturns) {
    runVal *= (1 + r.return);
    if (runVal > peak) peak = runVal;
    const dd = (peak - runVal) / peak;
    if (dd > maxDd) maxDd = dd;
  }

  // Monthly calendar
  const monthlyCalendar = buildMonthlyCalendar(portfolioReturns);

  return {
    curve,
    portTotal:   +(portTotal  * 100).toFixed(2),
    benchTotal:  +(benchTotal * 100).toFixed(2),
    portCagr:    +(portCagr   * 100).toFixed(2),
    benchCagr:   +(benchCagr  * 100).toFixed(2),
    sharpe:      +sharpe.toFixed(2),
    maxDrawdown: +(maxDd * 100).toFixed(2),
    monthlyCalendar,
  };
}

function buildMonthlyCalendar(returns) {
  const byYear = {};
  for (const r of returns) {
    const [yr, mo] = r.date.split("-");
    if (!byYear[yr]) byYear[yr] = Array(13).fill(null);
    const idx = parseInt(mo) - 1;
    byYear[yr][idx] = r.return * 100;
  }
  // Annual totals
  for (const yr of Object.keys(byYear)) {
    const months = byYear[yr].slice(0, 12).filter(v => v !== null);
    const total  = months.reduce((s, v) => s * (1 + v / 100), 1) - 1;
    byYear[yr][12] = +(total * 100).toFixed(2);
  }
  return byYear;
}

// ── Monte Carlo simulation ────────────────────────────────
export function runMonteCarlo({ annualReturn, annualVol, initialValue, years, simCount = 500 }) {
  const monthlyRet = annualReturn / 100 / 12;
  const monthlyVol = annualVol   / 100 / Math.sqrt(12);
  const months     = years * 12;

  const simulations = [];
  for (let s = 0; s < simCount; s++) {
    let val = initialValue;
    const path = [val];
    for (let m = 0; m < months; m++) {
      const z    = boxMullerRandom();
      const ret  = monthlyRet + monthlyVol * z;
      val       *= (1 + ret);
      path.push(val);
    }
    simulations.push(path);
  }

  // Build percentile bands per month
  const bands = [];
  for (let m = 0; m <= months; m++) {
    const vals = simulations.map(s => s[m]).sort((a, b) => a - b);
    bands.push({
      month: m,
      p10:   vals[Math.floor(simCount * 0.10)],
      p25:   vals[Math.floor(simCount * 0.25)],
      p50:   vals[Math.floor(simCount * 0.50)],
      p75:   vals[Math.floor(simCount * 0.75)],
      p90:   vals[Math.floor(simCount * 0.90)],
    });
  }

  const finalVals = simulations.map(s => s[months]).sort((a, b) => a - b);
  return {
    bands,
    median:    finalVals[Math.floor(simCount * 0.5)],
    p10:       finalVals[Math.floor(simCount * 0.1)],
    p90:       finalVals[Math.floor(simCount * 0.9)],
    probProfit: finalVals.filter(v => v > initialValue).length / simCount,
  };
}

// Box-Muller transform for normal random variable
function boxMullerRandom() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}
