import { useMemo, useState } from "react";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Line, LineChart,
} from "recharts";
import { STOCK_UNIVERSE } from "../data/stocks";
import { getValuationScore, getValuationLabel, buildEfficientFrontier } from "../utils/finance";
import { SectionLabel, MetricRow, ValuationBadge, WeightBar, ChartTooltip } from "./UI";

// ── Optimizer ──────────────────────────────────────────────
// Left: risk-tolerance slider + run button + allocation bars
// Right: risk/return scatter + efficient frontier + metrics
export default function Optimizer({
  holdings, metrics, riskTolerance,
  setRiskTolerance, optimize,
}) {
  const [optimized, setOptimized] = useState(false);

  const handleOptimize = () => {
    optimize();
    setOptimized(true);
    setTimeout(() => setOptimized(false), 1800);
  };

  // Efficient frontier across full universe
  const frontier = useMemo(() => buildEfficientFrontier(STOCK_UNIVERSE), []);

  // Scatter: all universe points + portfolio point
  const universePoints = useMemo(() =>
    STOCK_UNIVERSE.map(s => ({
      ticker:     s.ticker,
      x:          s.volatility,
      y:          s.expectedReturn,
      z:          getValuationScore(s),
      inPortfolio: !!holdings.find(h => h.ticker === s.ticker),
    })),
  [holdings]);

  const portfolioPoint = metrics
    ? [{ ticker: "PORTFOLIO", x: parseFloat(metrics.vol), y: parseFloat(metrics.ret) }]
    : [];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 20 }}>

      {/* ── Left panel ─────────────────────────────────── */}
      <div>
        <SectionLabel>Valuation-Driven Allocation Optimizer</SectionLabel>

        {/* Methodology blurb */}
        <div className="stat-card" style={{ marginBottom: 16, lineHeight: 1.85, fontSize: 12 }}>
          <p style={{ color: "#8b949e", marginBottom: 8, fontSize: 11, letterSpacing: "0.08em" }}>
            OPTIMIZATION MODEL
          </p>
          <p style={{ color: "#c9d1d9" }}>
            Each asset receives an <span style={{ color: "#00ff9d" }}>objective score</span> based on
            its risk-adjusted expected return, with a premium applied to{" "}
            <span style={{ color: "#ffd700" }}>undervalued securities</span> (P/E · P/B · EV/EBITDA
            composite). The <span style={{ color: "#c084fc" }}>risk-tolerance slider</span> scales the
            volatility penalty — aggressive settings favour high-return, high-vol names.
          </p>
        </div>

        {/* Risk slider */}
        <div className="stat-card" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
            <span style={{ color: "#8b949e", fontSize: 12, minWidth: 110 }}>Risk Tolerance</span>
            <input
              type="range" min={0} max={100} value={riskTolerance}
              onChange={e => setRiskTolerance(+e.target.value)}
              style={{ flex: 1 }}
            />
            <span style={{ color: "#00ff9d", minWidth: 38, textAlign: "right", fontWeight: 600 }}>
              {riskTolerance}%
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#8b949e" }}>
            <span>← CONSERVATIVE (min volatility)</span>
            <span>(max return) AGGRESSIVE →</span>
          </div>
        </div>

        <button
          className={`btn btn-primary ${optimized ? "pulse-green" : ""}`}
          style={{ width: "100%", padding: 12, fontSize: 13, letterSpacing: "0.05em", marginBottom: 20 }}
          onClick={handleOptimize}
        >
          {optimized ? "✓ OPTIMIZATION COMPLETE" : "RUN OPTIMIZER →"}
        </button>

        {/* Allocation bars */}
        <div style={{ background: "#0d1117", border: "1px solid #1c2333", borderRadius: 6, overflow: "hidden" }}>
          <div style={{ padding: "9px 16px", borderBottom: "1px solid #1c2333", color: "#8b949e", fontSize: 11, letterSpacing: "0.08em" }}>
            CURRENT ALLOCATION
          </div>
          {holdings.map(h => {
            const score = getValuationScore(h);
            const vl    = getValuationLabel(score);
            return (
              <div key={h.ticker} style={{ padding: "12px 16px", borderBottom: "1px solid #0d1117" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <span className="ticker-tag">{h.ticker}</span>
                    <span style={{ color: "#8b949e", fontSize: 11 }}>{h.name}</span>
                  </div>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <ValuationBadge label={vl.label} color={vl.color} />
                    <span style={{ color: "#00ff9d", fontWeight: 600, minWidth: 42, textAlign: "right" }}>
                      {h.weight.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <WeightBar value={h.weight} color={vl.color} />
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Right panel ────────────────────────────────── */}
      <div>
        {/* Efficient frontier + scatter */}
        <div className="stat-card" style={{ marginBottom: 16 }}>
          <p style={{ color: "#8b949e", fontSize: 11, letterSpacing: "0.08em", marginBottom: 14 }}>
            EFFICIENT FRONTIER + RISK/RETURN MAP
          </p>
          <ResponsiveContainer width="100%" height={260}>
            <ScatterChart margin={{ top: 10, right: 10, bottom: 24, left: 0 }}>
              <CartesianGrid stroke="#1c2333" strokeDasharray="3 3" />
              <XAxis
                dataKey="x" name="Volatility" type="number" unit="%"
                domain={[10, 50]}
                tick={{ fill: "#8b949e", fontSize: 10 }}
                label={{ value: "VOLATILITY %", position: "insideBottom", offset: -12, fill: "#8b949e", fontSize: 10 }}
              />
              <YAxis
                dataKey="y" name="Return" type="number" unit="%"
                domain={[6, 20]}
                tick={{ fill: "#8b949e", fontSize: 10 }}
              />
              <Tooltip content={<ChartTooltip />} />
              {/* Universe — not in portfolio */}
              <Scatter
                data={universePoints.filter(d => !d.inPortfolio)}
                fill="#2d3748" stroke="#8b949e55" r={4}
              />
              {/* Universe — in portfolio */}
              <Scatter
                data={universePoints.filter(d => d.inPortfolio)}
                fill="#00ff9d" stroke="#00ff9d" r={6} opacity={0.85}
              />
              {/* Portfolio blended point */}
              <Scatter
                data={portfolioPoint}
                fill="#ffd700" stroke="#ffd700" r={8} shape="star"
              />
            </ScatterChart>
          </ResponsiveContainer>

          {/* Efficient frontier line */}
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={frontier} margin={{ top: 8, right: 10, bottom: 24, left: 0 }}>
              <CartesianGrid stroke="#1c2333" strokeDasharray="3 3" />
              <XAxis
                dataKey="vol" unit="%"
                tick={{ fill: "#8b949e", fontSize: 10 }}
                label={{ value: "VOLATILITY %", position: "insideBottom", offset: -12, fill: "#8b949e", fontSize: 10 }}
              />
              <YAxis dataKey="ret" unit="%" tick={{ fill: "#8b949e", fontSize: 10 }} domain={["auto","auto"]} />
              <Tooltip contentStyle={{ background: "#0d1117", border: "1px solid #1c2333", fontFamily: "monospace", fontSize: 12 }} />
              <Line
                dataKey="ret" name="Efficient Frontier"
                stroke="#00c8ff" strokeWidth={2} dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
          <p style={{ color: "#8b949e", fontSize: 10, textAlign: "center" }}>
            ● IN PORTFOLIO &nbsp;· &nbsp;● UNIVERSE &nbsp;·&nbsp; ★ BLENDED PORTFOLIO
          </p>
        </div>

        {/* Metrics summary */}
        {metrics && (
          <div className="stat-card">
            <p style={{ color: "#8b949e", fontSize: 11, letterSpacing: "0.08em", marginBottom: 12 }}>
              PORTFOLIO METRICS
            </p>
            <MetricRow label="Expected Annual Return" value={`${metrics.ret}%`}    valueColor="#00ff9d" />
            <MetricRow label="Annual Volatility"      value={`${metrics.vol}%`}    valueColor="#ffd700" />
            <MetricRow label="Sharpe Ratio (Rf=4.5%)" value={metrics.sharpe}        valueColor={parseFloat(metrics.sharpe) >= 1 ? "#00ff9d" : "#ff6b35"} />
            <MetricRow label="Portfolio Beta"         value={metrics.beta} />
            <MetricRow label="Avg Dividend Yield"     value={`${metrics.divYield}%`} valueColor="#c084fc" />
          </div>
        )}
      </div>
    </div>
  );
}
