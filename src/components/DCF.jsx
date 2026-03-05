import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";
import { runDCF, buildSensitivityTable } from "../utils/finance";
import { SectionLabel, MetricRow } from "./UI";

// ── Default assumptions per stock ─────────────────────────
// In a real app these would come from financial statements.
// For demo purposes we derive sensible defaults from the
// stock's sector and valuation data.
function getDefaults(stock) {
  const sectorDefaults = {
    "Technology":     { revenueGrowth: 12, ebitMargin: 25, wacc: 9.5  },
    "Financials":     { revenueGrowth: 6,  ebitMargin: 30, wacc: 8.5  },
    "Healthcare":     { revenueGrowth: 8,  ebitMargin: 20, wacc: 8.0  },
    "Energy":         { revenueGrowth: 4,  ebitMargin: 15, wacc: 9.0  },
    "Consumer Disc.": { revenueGrowth: 7,  ebitMargin: 12, wacc: 9.0  },
    "Staples":        { revenueGrowth: 4,  ebitMargin: 14, wacc: 7.5  },
    "Utilities":      { revenueGrowth: 3,  ebitMargin: 20, wacc: 6.5  },
    "Industrials":    { revenueGrowth: 6,  ebitMargin: 14, wacc: 8.5  },
  };
  const d = sectorDefaults[stock?.sector] ?? { revenueGrowth: 7, ebitMargin: 18, wacc: 9.0 };
  return {
    revenueBase:      50,    // revenue per share — user should update
    revenueGrowth:    d.revenueGrowth,
    ebitMargin:       d.ebitMargin,
    taxRate:          21,
    reinvestmentRate: 30,
    wacc:             d.wacc,
    terminalGrowth:   2.5,
    forecastYears:    5,
  };
}

const SIGNAL_STYLE = {
  BUY:  { color: "#00ff9d", bg: "#00ff9d18", border: "#00ff9d44" },
  HOLD: { color: "#ffd700", bg: "#ffd70018", border: "#ffd70044" },
  SELL: { color: "#ff6b35", bg: "#ff6b3518", border: "#ff6b3544" },
};

// ── DCFTab ─────────────────────────────────────────────────
export default function DCFTab({ holdings }) {
  const [selectedTicker, setSelectedTicker] = useState(
    holdings[0]?.ticker ?? null
  );
  const [inputs, setInputs] = useState(() =>
    getDefaults(holdings[0])
  );
  const [error, setError] = useState(null);

  const stock = holdings.find(h => h.ticker === selectedTicker);

  // Re-seed defaults when user switches stock
  const handleSelectStock = (ticker) => {
    const s = holdings.find(h => h.ticker === ticker);
    setSelectedTicker(ticker);
    setInputs(getDefaults(s));
    setError(null);
  };

  const set = (key, val) =>
    setInputs(prev => ({ ...prev, [key]: parseFloat(val) || 0 }));

  // ── Run DCF ───────────────────────────────────────────────
  const result = useMemo(() => {
    try {
      setError(null);
      return runDCF({ ...inputs, currentPrice: stock?.price ?? null });
    } catch (e) {
      setError(e.message);
      return null;
    }
  }, [inputs, stock]);

  // ── Sensitivity table ─────────────────────────────────────
  const sensitivity = useMemo(() => {
    if (!result) return null;
    return buildSensitivityTable(
      inputs,
      [inputs.wacc - 2, inputs.wacc + 2],
      [inputs.terminalGrowth - 1.5, inputs.terminalGrowth + 1.5],
      5
    );
  }, [inputs, result]);

  if (!holdings.length) {
    return <p style={{ color: "#8b949e", padding: 40, textAlign: "center" }}>Add holdings to run a DCF.</p>;
  }

  const signal     = result?.signal;
  const sigStyle   = signal ? SIGNAL_STYLE[signal] : null;
  const currentP   = stock?.price ?? null;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20 }}>

      {/* ── Left: inputs ──────────────────────────────────── */}
      <div>
        {/* Stock selector */}
        <SectionLabel>Select Stock</SectionLabel>
        <div style={{
          background: "#0d1117", border: "1px solid #1c2333",
          borderRadius: 6, overflow: "hidden", marginBottom: 20,
        }}>
          {holdings.map(h => (
            <div
              key={h.ticker}
              onClick={() => handleSelectStock(h.ticker)}
              style={{
                padding: "10px 14px",
                borderBottom: "1px solid #0d1117",
                cursor: "pointer",
                background: selectedTicker === h.ticker ? "#00ff9d0d" : "transparent",
                borderLeft: selectedTicker === h.ticker ? "2px solid #00ff9d" : "2px solid transparent",
                display: "flex", justifyContent: "space-between", alignItems: "center",
                transition: "all 0.1s",
              }}
            >
              <div>
                <span className="ticker-tag" style={{ marginRight: 8 }}>{h.ticker}</span>
                <span style={{ color: "#8b949e", fontSize: 11 }}>{h.sector}</span>
              </div>
              {h.price && (
                <span style={{ color: "#c9d1d9", fontSize: 12 }}>${h.price.toFixed(2)}</span>
              )}
            </div>
          ))}
        </div>

        {/* Assumption inputs */}
        <SectionLabel>Model Assumptions</SectionLabel>
        <div className="stat-card">
          <p style={{ color: "#8b949e", fontSize: 10, marginBottom: 14, lineHeight: 1.7 }}>
            Adjust inputs below. Defaults are seeded from sector averages — update revenue per share from the company's latest financials for best accuracy.
          </p>

          {[
            { key: "revenueBase",      label: "Revenue / Share ($)",     min: 0,   max: 500,  step: 1   },
            { key: "revenueGrowth",    label: "Revenue Growth (%)",      min: -10, max: 50,   step: 0.5 },
            { key: "ebitMargin",       label: "EBIT Margin (%)",         min: 0,   max: 60,   step: 0.5 },
            { key: "taxRate",          label: "Tax Rate (%)",            min: 0,   max: 40,   step: 0.5 },
            { key: "reinvestmentRate", label: "Reinvestment Rate (%)",   min: 0,   max: 80,   step: 1   },
            { key: "wacc",             label: "WACC (%)",                min: 3,   max: 20,   step: 0.1 },
            { key: "terminalGrowth",   label: "Terminal Growth (%)",     min: 0,   max: 5,    step: 0.1 },
            { key: "forecastYears",    label: "Forecast Period (years)", min: 3,   max: 10,   step: 1   },
          ].map(({ key, label, min, max, step }) => (
            <div key={key} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ color: "#8b949e", fontSize: 11 }}>{label}</span>
                <span style={{ color: "#00ff9d", fontWeight: 600, fontSize: 12 }}>
                  {inputs[key]}{key !== "revenueBase" && key !== "forecastYears" ? "" : ""}
                </span>
              </div>
              <input
                type="range" min={min} max={max} step={step}
                value={inputs[key]}
                onChange={e => set(key, e.target.value)}
                style={{ width: "100%" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#8b949e44", marginTop: 2 }}>
                <span>{min}</span><span>{max}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right: results ────────────────────────────────── */}
      <div>
        {error && (
          <div style={{ background: "#ff6b3518", border: "1px solid #ff6b3533", borderRadius: 6, padding: "12px 16px", color: "#ff6b35", fontSize: 12, marginBottom: 16 }}>
            ⚠ {error}
          </div>
        )}

        {result && (
          <div className="fade-in">

            {/* Signal banner */}
            {signal && sigStyle && (
              <div style={{
                background: sigStyle.bg, border: `1px solid ${sigStyle.border}`,
                borderRadius: 6, padding: "16px 20px", marginBottom: 20,
                display: "flex", alignItems: "center", gap: 20,
              }}>
                <div style={{
                  fontSize: 28, fontWeight: 700, color: sigStyle.color,
                  letterSpacing: "0.1em", minWidth: 70,
                }}>
                  {signal}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ color: "#8b949e", fontSize: 10, marginBottom: 3 }}>INTRINSIC VALUE</div>
                      <div style={{ color: sigStyle.color, fontSize: 22, fontWeight: 700 }}>
                        ${result.intrinsicValue.toFixed(2)}
                      </div>
                    </div>
                    {currentP && (
                      <>
                        <div>
                          <div style={{ color: "#8b949e", fontSize: 10, marginBottom: 3 }}>CURRENT PRICE</div>
                          <div style={{ color: "#c9d1d9", fontSize: 22, fontWeight: 700 }}>${currentP.toFixed(2)}</div>
                        </div>
                        <div>
                          <div style={{ color: "#8b949e", fontSize: 10, marginBottom: 3 }}>UPSIDE / DOWNSIDE</div>
                          <div style={{
                            color: result.upside >= 0 ? "#00ff9d" : "#ff6b35",
                            fontSize: 22, fontWeight: 700,
                          }}>
                            {result.upside >= 0 ? "+" : ""}{result.upside}%
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div style={{ color: "#8b949e", fontSize: 11, textAlign: "right" }}>
                  <div>PV Stage 1: <span style={{ color: "#c9d1d9" }}>${result.pvStage1.toFixed(2)}</span></div>
                  <div style={{ marginTop: 4 }}>PV Terminal: <span style={{ color: "#c9d1d9" }}>${result.pvTerminal.toFixed(2)}</span></div>
                </div>
              </div>
            )}

            {/* FCF forecast chart */}
            <div className="stat-card" style={{ marginBottom: 20 }}>
              <p style={{ color: "#8b949e", fontSize: 11, letterSpacing: "0.08em", marginBottom: 16 }}>
                FREE CASH FLOW FORECAST (PER SHARE)
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={result.stages} margin={{ right: 20, bottom: 10 }}>
                  <CartesianGrid stroke="#1c2333" vertical={false} />
                  <XAxis
                    dataKey="year" tickFormatter={v => `Yr ${v}`}
                    tick={{ fill: "#8b949e", fontSize: 11 }}
                  />
                  <YAxis tick={{ fill: "#8b949e", fontSize: 10 }} tickFormatter={v => `$${v}`} />
                  <Tooltip
                    formatter={(v, n) => [`$${Number(v).toFixed(2)}`, n]}
                    contentStyle={{ background: "#0d1117", border: "1px solid #1c2333", fontFamily: "monospace", fontSize: 12 }}
                  />
                  <Bar dataKey="fcf"  name="Free Cash Flow" radius={[3,3,0,0]}>
                    {result.stages.map((_, i) => (
                      <Cell key={i} fill={`rgba(0, 255, 157, ${0.4 + i * 0.12})`} />
                    ))}
                  </Bar>
                  <Bar dataKey="pv" name="PV of FCF" fill="#00c8ff" opacity={0.6} radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* DCF breakdown table */}
            <div className="stat-card" style={{ marginBottom: 20 }}>
              <p style={{ color: "#8b949e", fontSize: 11, letterSpacing: "0.08em", marginBottom: 14 }}>
                CASH FLOW PROJECTION TABLE
              </p>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, fontFamily: "monospace" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #1c2333" }}>
                      {["YEAR","REVENUE","EBIT","NOPAT","FCF","PV (FCF)"].map(h => (
                        <th key={h} style={{ color: "#8b949e", textAlign: "right", padding: "6px 12px", fontWeight: 500 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.stages.map(row => (
                      <tr key={row.year} style={{ borderBottom: "1px solid #0d1117" }}>
                        <td style={{ color: "#8b949e", padding: "7px 12px", textAlign: "right" }}>Yr {row.year}</td>
                        <td style={{ color: "#c9d1d9", padding: "7px 12px", textAlign: "right" }}>${row.revenue.toFixed(2)}</td>
                        <td style={{ color: "#c9d1d9", padding: "7px 12px", textAlign: "right" }}>${row.ebit.toFixed(2)}</td>
                        <td style={{ color: "#c9d1d9", padding: "7px 12px", textAlign: "right" }}>${row.nopat.toFixed(2)}</td>
                        <td style={{ color: "#00ff9d", padding: "7px 12px", textAlign: "right", fontWeight: 600 }}>${row.fcf.toFixed(2)}</td>
                        <td style={{ color: "#00c8ff", padding: "7px 12px", textAlign: "right" }}>${row.pv.toFixed(2)}</td>
                      </tr>
                    ))}
                    {/* Terminal value row */}
                    <tr style={{ borderTop: "1px solid #1c2333", background: "#00ff9d08" }}>
                      <td style={{ color: "#ffd700", padding: "7px 12px", textAlign: "right" }}>Terminal</td>
                      <td colSpan={3} style={{ color: "#8b949e", padding: "7px 12px", textAlign: "right", fontSize: 10 }}>
                        Gordon Growth Model (g={inputs.terminalGrowth}%)
                      </td>
                      <td style={{ color: "#ffd700", padding: "7px 12px", textAlign: "right", fontWeight: 600 }}>
                        ${result.terminalValue.toFixed(2)}
                      </td>
                      <td style={{ color: "#ffd700", padding: "7px 12px", textAlign: "right", fontWeight: 600 }}>
                        ${result.pvTerminal.toFixed(2)}
                      </td>
                    </tr>
                    {/* Intrinsic value total */}
                    <tr style={{ borderTop: "1px solid #1c2333", background: "#00ff9d0a" }}>
                      <td colSpan={5} style={{ color: "#8b949e", padding: "8px 12px", textAlign: "right", fontSize: 11 }}>
                        INTRINSIC VALUE (PV Stage 1 + PV Terminal)
                      </td>
                      <td style={{ color: "#00ff9d", padding: "8px 12px", textAlign: "right", fontWeight: 700, fontSize: 14 }}>
                        ${result.intrinsicValue.toFixed(2)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Sensitivity table */}
            {sensitivity && (
              <div className="stat-card">
                <p style={{ color: "#8b949e", fontSize: 11, letterSpacing: "0.08em", marginBottom: 4 }}>
                  SENSITIVITY ANALYSIS — INTRINSIC VALUE
                </p>
                <p style={{ color: "#8b949e", fontSize: 11, marginBottom: 14 }}>
                  Rows = WACC · Columns = Terminal Growth Rate
                </p>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ borderCollapse: "collapse", fontSize: 11, fontFamily: "monospace", width: "100%" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #1c2333" }}>
                        <th style={{ color: "#8b949e", padding: "6px 14px", textAlign: "right", minWidth: 70 }}>
                          WACC \ TG
                        </th>
                        {sensitivity.tgValues.map(tg => (
                          <th key={tg} style={{ color: "#ffd700", padding: "6px 14px", textAlign: "right", minWidth: 80 }}>
                            {tg}%
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sensitivity.rows.map(row => (
                        <tr key={row.wacc} style={{ borderBottom: "1px solid #0d1117" }}>
                          <td style={{ color: "#ffd700", padding: "7px 14px", textAlign: "right", fontWeight: 600 }}>
                            {row.wacc}%
                          </td>
                          {row.cols.map((val, ci) => {
                            // Colour cells relative to current price
                            const upside = currentP && val
                              ? ((val - currentP) / currentP) * 100
                              : null;
                            const bg = upside === null ? "transparent"
                              : upside >  15 ? "#00ff9d22"
                              : upside >   0 ? "#00ff9d0d"
                              : upside > -15 ? "#ff6b3511"
                              :                "#ff6b3522";
                            const color = upside === null ? "#c9d1d9"
                              : upside >= 0 ? "#00ff9d" : "#ff6b35";
                            // Highlight the base case cell
                            const isBase =
                              Math.abs(row.wacc - inputs.wacc) < 0.05 &&
                              Math.abs(sensitivity.tgValues[ci] - inputs.terminalGrowth) < 0.05;
                            return (
                              <td key={ci} style={{
                                textAlign: "right", padding: "7px 14px",
                                background: isBase ? "#ffd70018" : bg,
                                color: isBase ? "#ffd700" : color,
                                fontWeight: isBase ? 700 : 400,
                                border: isBase ? "1px solid #ffd70044" : "none",
                              }}>
                                {val !== null ? `$${val.toFixed(2)}` : "—"}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {currentP && (
                  <p style={{ color: "#8b949e", fontSize: 10, marginTop: 10 }}>
                    🟢 Green = above current price (${currentP.toFixed(2)}) &nbsp;·&nbsp;
                    🔴 Red = below current price &nbsp;·&nbsp;
                    🟡 Highlighted = base case
                  </p>
                )}
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
