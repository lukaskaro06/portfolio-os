// src/components/MonteCarlo.jsx — live holdings shown in header
import { useState, useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { runMonteCarlo, fmt } from "../utils/finance";
import { SectionLabel, MetricRow } from "./UI";

export default function MonteCarloTab({ metrics, liveHoldings }) {
  const [initialValue, setInitialValue] = useState(100_000);
  const [years,        setYears]        = useState(10);
  const [simCount,     setSimCount]     = useState(500);
  const [ran,          setRan]          = useState(false);

  const result = useMemo(() => {
    if (!metrics || !ran) return null;
    return runMonteCarlo({
      annualReturn: parseFloat(metrics.ret),
      annualVol:    parseFloat(metrics.vol),
      initialValue, years, simCount,
    });
  }, [ran, metrics, initialValue, years, simCount]);

  const chartData = useMemo(() => {
    if (!result) return [];
    return result.bands.filter(b => b.month % 12 === 0).map(b => ({ ...b, year: b.month / 12 }));
  }, [result]);

  const final = chartData[chartData.length - 1];

  if (!metrics)
    return <p style={{ color: "#8b949e", padding: 40, textAlign: "center" }}>Add holdings to run simulation.</p>;

  // Compute live portfolio value if prices available
  const liveTotal = liveHoldings?.reduce((sum, h) => {
    const p = h.livePrice ?? h.price;
    return p ? sum + p * (h.weight / 100) : sum;
  }, 0) ?? null;

  return (
    <div>
      <SectionLabel>Monte Carlo Portfolio Simulation</SectionLabel>

      {/* Live portfolio snapshot */}
      {liveHoldings?.length > 0 && (
        <div style={{ background: "#0d1117", border: "1px solid #1c2333", borderRadius: 6, padding: "12px 18px", marginBottom: 20 }}>
          <p style={{ color: "#8b949e", fontSize: 10, letterSpacing: "0.08em", marginBottom: 10 }}>CURRENT PORTFOLIO — LIVE PRICES</p>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            {liveHoldings.map(h => {
              const p = h.livePrice ?? h.price;
              return (
                <div key={h.ticker} style={{ textAlign: "center", minWidth: 70 }}>
                  <div style={{ color: "#8b949e", fontSize: 10 }}>{h.ticker}</div>
                  <div style={{ color: "#fff", fontWeight: 600 }}>{p ? `$${p}` : "—"}</div>
                  {h.liveChangePct != null && (
                    <div style={{ color: h.livePositive ? "#00ff9d" : "#ff6b35", fontSize: 10 }}>
                      {h.livePositive ? "+" : ""}{h.liveChangePct?.toFixed(2)}%
                    </div>
                  )}
                  <div style={{ color: "#8b949e44", fontSize: 9 }}>{h.weight.toFixed(1)}%</div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #1c2333", display: "flex", gap: 20 }}>
            <span style={{ color: "#8b949e", fontSize: 11 }}>Annualised Return <span style={{ color: "#00ff9d", fontWeight: 700 }}>{metrics.ret}%</span></span>
            <span style={{ color: "#8b949e", fontSize: 11 }}>Volatility <span style={{ color: "#ffd700", fontWeight: 700 }}>{metrics.vol}%</span></span>
            <span style={{ color: "#8b949e", fontSize: 11 }}>Sharpe <span style={{ color: parseFloat(metrics.sharpe) >= 1 ? "#00ff9d" : "#ff6b35", fontWeight: 700 }}>{metrics.sharpe}</span></span>
          </div>
        </div>
      )}

      {/* Controls */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 20 }}>
        <ControlCard label="INITIAL INVESTMENT">
          <input className="input-dark" type="number" style={{ width: "100%" }}
            value={initialValue} onChange={e => { setInitialValue(+e.target.value); setRan(false); }} />
          <span style={{ color: "#8b949e", fontSize: 11 }}>USD</span>
        </ControlCard>
        <ControlCard label="HORIZON (YEARS)">
          <input type="range" min={1} max={30} value={years}
            onChange={e => { setYears(+e.target.value); setRan(false); }} style={{ flex: 1 }} />
          <span style={{ color: "#00ff9d", fontWeight: 600, minWidth: 28 }}>{years}y</span>
        </ControlCard>
        <ControlCard label="SIMULATIONS">
          {[200, 500, 1000].map(n => (
            <button key={n} className={`btn ${simCount === n ? "btn-primary" : "btn-ghost"}`}
              style={{ flex: 1, padding: "5px 0" }}
              onClick={() => { setSimCount(n); setRan(false); }}>{n}</button>
          ))}
        </ControlCard>
      </div>

      <button className="btn btn-primary"
        style={{ width: "100%", padding: 12, fontSize: 13, letterSpacing: "0.05em", marginBottom: 24 }}
        onClick={() => setRan(v => !v)}>
        RUN {simCount.toLocaleString()} SIMULATIONS →
      </button>

      {result && (
        <div className="fade-in">
          <div className="stat-card" style={{ marginBottom: 20 }}>
            <p style={{ color: "#8b949e", fontSize: 11, letterSpacing: "0.08em", marginBottom: 16 }}>
              PORTFOLIO VALUE PROJECTION — PERCENTILE BANDS
            </p>
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={chartData} margin={{ right: 20, bottom: 20 }}>
                <defs>
                  {[["gP90","#00c8ff"],[" gP75","#00ff9d"],["gP25","#ff6b35"]].map(([id, c]) => (
                    <linearGradient key={id} id={id.trim()} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={c} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={c} stopOpacity={0}    />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid stroke="#1c2333" strokeDasharray="3 3" />
                <XAxis dataKey="year" tick={{ fill: "#8b949e", fontSize: 11 }}
                  label={{ value: "YEARS", position: "insideBottom", offset: -10, fill: "#8b949e", fontSize: 11 }} />
                <YAxis tickFormatter={v => `$${(v/1000).toFixed(0)}k`} tick={{ fill: "#8b949e", fontSize: 11 }} />
                <Tooltip formatter={(v, n) => [fmt.dollar(v), n]}
                  contentStyle={{ background: "#0d1117", border: "1px solid #1c2333", fontFamily: "monospace", fontSize: 12 }} />
                <ReferenceLine y={initialValue} stroke="#8b949e" strokeDasharray="4 4" />
                <Area dataKey="p90"    name="90th pct"  fill="url(#gP90)"  stroke="#00c8ff" strokeWidth={1.5} dot={false} />
                <Area dataKey="p75"    name="75th pct"  fill="url(#gP75)"  stroke="#00ff9d" strokeWidth={2}   dot={false} />
                <Area dataKey="median" name="Median"    fill="none"         stroke="#ffffff" strokeWidth={2.5} dot={false} />
                <Area dataKey="p25"    name="25th pct"  fill="url(#gP25)"  stroke="#ffd700" strokeWidth={1.5} dot={false} />
                <Area dataKey="p10"    name="10th pct"  fill="none"         stroke="#ff6b35" strokeWidth={1.5} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", gap: 20, justifyContent: "center", fontSize: 11, color: "#8b949e", marginTop: 8 }}>
              {[["P90","#00c8ff"],["P75","#00ff9d"],["MED","#ffffff"],["P25","#ffd700"],["P10","#ff6b35"]].map(([l, c]) => (
                <span key={l} style={{ display: "flex", gap: 5, alignItems: "center" }}>
                  <span style={{ width: 20, height: 2, background: c, display: "inline-block" }} />{l}
                </span>
              ))}
            </div>
          </div>

          {final && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
              {[
                { label: "WORST (P10)",    val: final.p10,    color: "#ff6b35" },
                { label: "BELOW MED (P25)",val: final.p25,    color: "#ffd700" },
                { label: "MEDIAN",         val: final.median, color: "#ffffff" },
                { label: "ABOVE MED (P75)",val: final.p75,    color: "#00ff9d" },
                { label: "BEST (P90)",     val: final.p90,    color: "#00c8ff" },
              ].map(({ label, val, color }) => {
                const gain = ((val - initialValue) / initialValue * 100).toFixed(1);
                return (
                  <div key={label} className="stat-card" style={{ textAlign: "center", borderColor: color + "33" }}>
                    <div style={{ color: "#8b949e", fontSize: 10, marginBottom: 8, letterSpacing: "0.07em" }}>{label}</div>
                    <div style={{ color, fontSize: 18, fontWeight: 600 }}>{fmt.dollar(val)}</div>
                    <div style={{ color: parseFloat(gain) >= 0 ? "#00ff9d" : "#ff6b35", fontSize: 11, marginTop: 4 }}>
                      {gain >= 0 ? "+" : ""}{gain}%
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="stat-card" style={{ marginTop: 16, fontSize: 11, color: "#8b949e", lineHeight: 1.8 }}>
            <p style={{ color: "#8b949e", letterSpacing: "0.08em", marginBottom: 6 }}>ASSUMPTIONS</p>
            <p>Annual return {metrics.ret}% · Volatility {metrics.vol}% · Normal log-return distribution · Monthly compounding · No rebalancing · No taxes/fees · {simCount.toLocaleString()} paths · Horizon {years} years</p>
            <p style={{ marginTop: 6, color: "#ff6b3588" }}>⚠ Monte Carlo results are illustrative only and do not constitute financial advice.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function ControlCard({ label, children }) {
  return (
    <div className="stat-card">
      <p style={{ color: "#8b949e", fontSize: 11, letterSpacing: "0.08em", marginBottom: 10 }}>{label}</p>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>{children}</div>
    </div>
  );
}
