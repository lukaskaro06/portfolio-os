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
  revenueBase,
  revenueGrowth,
  ebitMargin,
  taxRate,
  reinvestmentRate,
  wacc,
  terminalGrowth,
  forecastYears,
  currentPrice,
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

  const terminalFCF    = cashFlows[cashFlows.length - 1].fcf * (1 + terminalGrowth / 100);
  const terminalVal    = terminalFCF / ((wacc - terminalGrowth) / 100);
  const terminalPV     = terminalVal / Math.pow(1 + wacc / 100, forecastYears);
  const intrinsicValue = totalPV + terminalPV;

  let signal = "HOLD";
  if (currentPrice && intrinsicValue > 0) {
    const upside = (intrinsicValue - currentPrice) / currentPrice;
    if (upside > 0.15)  signal = "BUY";
    if (upside < -0.15) signal = "SELL";
  }

  return {
    cashFlows,
    terminalValue:  +terminalVal.toFixed(2),
    terminalPV:     +terminalPV.toFixed(2),
    intrinsicValue: +intrinsicValue.toFixed(2),
    pvFCF:          +totalPV.toFixed(2),
    terminalPct:    +((terminalPV / intrinsicValue) * 100).toFixed(1),
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
// Fixed: returns all fields Backtest.jsx expects:
//   cumSeries        — [{date, portfolio, benchmark}] cumulative % gain from 0
//   drawdownSeries   — [{date, drawdown}] drawdown % from peak (negative numbers)
//   monthlyHeatmap   — [{year, Jan, Feb, …, Dec, Annual}] array of row objects
//   metrics          — { annReturn, annVol, sharpe, sortino, maxDD,
//                        alpha, beta, winRate, bestMonth, worstMonth }
export function runBacktest({ priceHistory, weights, benchmark }) {
  // ── 1. Align dates ──────────────────────────────────────
  const tickerDates = Object.values(priceHistory).map(s => new Set(s.map(d => d.date)));
  const benchDates  = new Set(benchmark.map(d => d.date));
  const commonDates = [...benchDates]
    .filter(d => tickerDates.every(set => set.has(d)))
    .sort();

  if (commonDates.length < 3) throw new Error("Not enough common dates for backtest");

  // ── 2. Build price lookups ──────────────────────────────
  const lookup = {};
  for (const [ticker, series] of Object.entries(priceHistory)) {
    lookup[ticker] = Object.fromEntries(series.map(d => [d.date, d.close]));
  }
  const benchLookup = Object.fromEntries(benchmark.map(d => [d.date, d.close]));

  // ── 3. Compute monthly returns ──────────────────────────
  const portRets  = [];
  const benchRets = [];

  for (let i = 1; i < commonDates.length; i++) {
    const prev = commonDates[i - 1];
    const curr = commonDates[i];

    let pRet = 0;
    for (const [ticker, w] of Object.entries(weights)) {
      const p0 = lookup[ticker]?.[prev];
      const p1 = lookup[ticker]?.[curr];
      if (p0 && p1 && p0 > 0) pRet += w * ((p1 - p0) / p0);
    }

    const b0 = benchLookup[prev];
    const b1 = benchLookup[curr];
    const bRet = b0 && b1 && b0 > 0 ? (b1 - b0) / b0 : 0;

    portRets.push({ date: curr, r: pRet });
    benchRets.push({ date: curr, r: bRet });
  }

  // ── 4. Cumulative series (% gain from 0, not indexed at 100) ──
  let portVal  = 1;
  let benchVal = 1;
  const cumSeries = portRets.map((pr, i) => {
    portVal  *= (1 + pr.r);
    benchVal *= (1 + benchRets[i].r);
    return {
      date:      pr.date,
      portfolio: +((portVal  - 1) * 100).toFixed(2),
      benchmark: +((benchVal - 1) * 100).toFixed(2),
    };
  });

  // ── 5. Drawdown series ──────────────────────────────────
  let peak   = 1;
  let runVal = 1;
  const drawdownSeries = portRets.map(pr => {
    runVal *= (1 + pr.r);
    if (runVal > peak) peak = runVal;
    const dd = peak > 0 ? -((peak - runVal) / peak) * 100 : 0;
    return { date: pr.date, drawdown: +dd.toFixed(2) };
  });

  // ── 6. Summary metrics ──────────────────────────────────
  const n       = portRets.length;
  const portAvg = portRets.reduce((s, r) => s + r.r, 0) / n;
  const portStd = Math.sqrt(portRets.reduce((s, r) => s + Math.pow(r.r - portAvg, 2), 0) / n);

  // Annualised
  const finalPortVal = 1 + (cumSeries[cumSeries.length - 1]?.portfolio ?? 0) / 100;
  const annReturn    = +(( Math.pow(finalPortVal, 12 / n) - 1) * 100).toFixed(2);
  const annVol       = +(portStd * Math.sqrt(12) * 100).toFixed(2);

  // Sharpe (Rf = 4.5% annual = 0.375%/month)
  const rf      = 0.045 / 12;
  const sharpe  = portStd > 0 ? +((portAvg - rf) / portStd * Math.sqrt(12)).toFixed(2) : 0;

  // Sortino — only downside deviation
  const downRets   = portRets.filter(r => r.r < rf).map(r => r.r - rf);
  const downStd    = downRets.length > 0
    ? Math.sqrt(downRets.reduce((s, r) => s + r * r, 0) / n)
    : portStd;
  const sortino    = downStd > 0 ? +((portAvg - rf) / downStd * Math.sqrt(12)).toFixed(2) : 0;

  // Max drawdown
  const maxDD = +(Math.min(...drawdownSeries.map(d => d.drawdown))).toFixed(2);

  // Beta vs benchmark
  const benchAvg = benchRets.reduce((s, r) => s + r.r, 0) / n;
  const cov      = portRets.reduce((s, pr, i) => s + (pr.r - portAvg) * (benchRets[i].r - benchAvg), 0) / n;
  const benchVar = benchRets.reduce((s, r) => s + Math.pow(r.r - benchAvg, 2), 0) / n;
  const beta     = benchVar > 0 ? +(cov / benchVar).toFixed(2) : 1;

  // Alpha (Jensen's alpha annualised)
  const benchAnnReturn = +(( Math.pow(1 + benchRets.reduce((s,r)=>s+r.r,0)/n, 12) - 1) * 100).toFixed(2);
  const alpha          = +(annReturn - (4.5 + beta * (benchAnnReturn - 4.5))).toFixed(2);

  // Win rate
  const wins    = portRets.filter(r => r.r > 0).length;
  const winRate = +((wins / n) * 100).toFixed(1);

  // Best / worst month
  const monthlyPcts = portRets.map(r => +(r.r * 100).toFixed(2));
  const bestMonth   = +Math.max(...monthlyPcts).toFixed(2);
  const worstMonth  = +Math.min(...monthlyPcts).toFixed(2);

  // ── 7. Monthly heatmap ──────────────────────────────────
  // Backtest.jsx expects: array of { year, Jan, Feb, ..., Dec, Annual }
  // with null for missing months, values as rounded % numbers
  const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  const calMap = {};
  for (const pr of portRets) {
    const [yr, mo] = pr.date.split("-");
    if (!calMap[yr]) calMap[yr] = {};
    const monthName = MONTH_NAMES[parseInt(mo, 10) - 1];
    if (monthName) calMap[yr][monthName] = +(pr.r * 100).toFixed(2);
  }

  const monthlyHeatmap = Object.keys(calMap).sort().map(yr => {
    const row = { year: yr };
    let compounded = 1;
    for (const m of MONTH_NAMES) {
      const v = calMap[yr][m] ?? null;
      row[m] = v;
      if (v !== null) compounded *= (1 + v / 100);
    }
    row["Annual"] = +((compounded - 1) * 100).toFixed(2);
    return row;
  });

  // ── 8. Return everything ────────────────────────────────
  return {
    // Charts
    cumSeries,
    drawdownSeries,
    monthlyHeatmap,
    // Metrics object matching Backtest.jsx exactly
    metrics: {
      annReturn:  annReturn.toFixed(2),
      annVol:     annVol.toFixed(2),
      sharpe:     sharpe.toFixed(2),
      sortino:    sortino.toFixed(2),
      maxDD:      maxDD.toFixed(2),
      alpha:      alpha.toFixed(2),
      beta:       beta.toFixed(2),
      winRate:    winRate.toFixed(1),
      bestMonth:  bestMonth.toFixed(2),
      worstMonth: worstMonth.toFixed(2),
    },
    // Legacy fields kept for any other consumers
    portCagr:    annReturn,
    benchCagr:   benchAnnReturn,
    maxDrawdown: Math.abs(maxDD),
    sharpe,
  };
}

// ── Monte Carlo simulation ─────────────────────────────────
export function runMonteCarlo({ annualReturn, annualVol, initialValue, years, simCount = 500 }) {
  const monthlyRet = annualReturn / 100 / 12;
  const monthlyVol = annualVol   / 100 / Math.sqrt(12);
  const months     = years * 12;

  const simulations = [];
  for (let s = 0; s < simCount; s++) {
    let val = initialValue;
    const path = [val];
    for (let m = 0; m < months; m++) {
      const z   = boxMullerRandom();
      const ret = monthlyRet + monthlyVol * z;
      val      *= (1 + ret);
      path.push(val);
    }
    simulations.push(path);
  }

  // Build percentile bands per month
  const bands = [];
  for (let m = 0; m <= months; m++) {
    const vals = simulations.map(s => s[m]).sort((a, b) => a - b);
    bands.push({
      month:  m,
      p10:    vals[Math.floor(simCount * 0.10)],
      p25:    vals[Math.floor(simCount * 0.25)],
      median: vals[Math.floor(simCount * 0.50)],
      p75:    vals[Math.floor(simCount * 0.75)],
      p90:    vals[Math.floor(simCount * 0.90)],
    });
  }

  const finalVals = simulations.map(s => s[months]).sort((a, b) => a - b);
  return {
    bands,
    median:     finalVals[Math.floor(simCount * 0.5)],
    p10:        finalVals[Math.floor(simCount * 0.1)],
    p90:        finalVals[Math.floor(simCount * 0.9)],
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
