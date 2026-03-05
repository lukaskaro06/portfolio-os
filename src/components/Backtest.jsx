import { useState, useCallback } from "react";
import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { fetchBacktestData }  from "../services/backtestData";
import { runBacktest }        from "../utils/finance";
import { SectionLabel, Spinner, MetricRow } from "./UI";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec","Annual"];

// ── BacktestTab ────────────────────────────────────────────
export default function BacktestTab({ holdings }) {
  const [years,   setYears]   = useState(3);
  const [result,  setResult]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const runTest = useCallback(async () => {
    if (!holdings.length) return;
    setLoading(true);
    setError(null);

    try {
      const tickers = holdings.map(h => h.ticker);
      const { prices, benchmark, errors } = await fetchBacktestData(tickers, years);

      if (errors.length === tickers.length) {
        throw new Error("Could not fetch price history for any holdings.");
      }

      // Build weight map (only for tickers we got data for)
      const available = tickers.filter(t => prices[t]);
      const totalW    = available.reduce((s, t) => {
        return s + (holdings.find(h => h.ticker === t)?.weight ?? 0);
      }, 0);
      const weights = Object.fromEntries(
        available.map(t => [
          t,
          (holdings.find(h => h.ticker === t)?.weight ?? 0) / totalW,
        ])
      );

      const backtest = runBacktest({ priceHistory: prices, weights, benchmark });
      setResult({ ...backtest, errors });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [holdings, years]);

  if (!holdings.length) {
    return <p style={{ color: "#8b949e", padding: 40, textAlign: "center" }}>Add holdings to run a backtest.</p>;
  }

  return (
    <div>
      <SectionLabel>Backtest — Portfolio vs S&P 500</SectionLabel>

      {/* Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
        <span style={{ color: "#8b949e", fontSize: 12 }}>Lookback Period</span>
        {[1, 3, 5].map(y => (
          <button
            key={y}
            className={`btn ${years === y ? "btn-primary" : "btn-ghost"}`}
            onClick={() => { setYears(y); setResult(null); }}
          >
            {y}Y
          </button>
        ))}
        <button
          className="btn btn-primary"
          style={{ marginLeft: "auto", padding: "8px 24px" }}
          onClick={runTest}
          disabled={loading}
        >
          {loading ? <span style={{ display: "flex", alignItems: "center", gap: 8 }}><Spinner /> LOADING…</span> : "RUN BACKTEST →"}
        </button>
      </div>

      {error && (
        <div style={{ background: "#ff6b3518", border: "1px solid #ff6b3533", borderRadius: 6, padding: "12px 16px", color: "#ff6b35", fontSize: 12, marginBottom: 20 }}>
          ⚠ {error}
        </div>
      )}

      {result && (
        <div className="fade-in">

          {/* Partial data warning */}
          {result.errors?.length > 0 && (
            <div style={{ background: "#ffd70018", border: "1px solid #ffd70033", borderRadius: 6, padding: "10px 16px", color: "#ffd700", fontSize: 11, marginBottom: 16 }}>
              ⚠ No price history for: {result.errors.join(", ")} — excluded from backtest, weights renormalised.
            </div>
          )}

          {/* Risk metrics grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 20 }}>
            {[
              { label: "ANN. RETURN",  value: `${result.metrics.annReturn}%`,  color: parseFloat(result.metrics.annReturn)  >= 0 ? "#00ff9d" : "#ff6b35" },
              { label: "VOLATILITY",   value: `${result.metrics.annVol}%`,     color: "#ffd700" },
              { label: "SHARPE RATIO", value: result.metrics.sharpe,            color: parseFloat(result.metrics.sharpe)     >= 1 ? "#00ff9d" : "#ff6b35" },
              { label: "SORTINO",      value: result.metrics.sortino,           color: parseFloat(result.metrics.sortino)    >= 1 ? "#00ff9d" : "#ff6b35" },
              { label: "MAX DRAWDOWN", value: `${result.metrics.maxDD}%`,      color: "#ff6b35" },
              { label: "ALPHA",        value: `${result.metrics.alpha}%`,      color: parseFloat(result.metrics.alpha)      >= 0 ? "#00ff9d" : "#ff6b35" },
              { label: "BETA",         value: result.metrics.beta,              color: "#c9d1d9" },
              { label: "WIN RATE",     value: `${result.metrics.winRate}%`,    color: "#c084fc" },
              { label: "BEST MONTH",   value: `${result.metrics.bestMonth}%`,  color: "#00ff9d" },
              { label: "WORST MONTH",  value: `${result.metrics.worstMonth}%`, color: "#ff6b35" },
            ].map(({ label, value, color }) => (
              <div key={label} className="stat-card" style={{ textAlign: "center" }}>
                <div style={{ color: "#8b949e", fontSize: 10, letterSpacing: "0.07em", marginBottom: 6 }}>{label}</div>
                <div style={{ color, fontSize: 18, fontWeight: 600 }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Cumulative return chart */}
          <div className="stat-card" style={{ marginBottom: 20 }}>
            <p style={{ color: "#8b949e", fontSize: 11, letterSpacing: "0.08em", marginBottom: 16 }}>
              CUMULATIVE RETURN — PORTFOLIO vs S&P 500
            </p>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={result.cumSeries} margin={{ right: 20, bottom: 20 }}>
                <CartesianGrid stroke="#1c2333" strokeDasharray="3 3" />
                <XAxis
                  dataKey="date" tick={{ fill: "#8b949e", fontSize: 10 }}
                  tickFormatter={d => d.slice(0, 7)}
                  interval={Math.floor(result.cumSeries.length / 8)}
                />
                <YAxis
                  tick={{ fill: "#8b949e", fontSize: 10 }}
                  tickFormatter={v => `${v > 0 ? "+" : ""}${v}%`}
                />
                <Tooltip
                  formatter={(v, n) => [`${v > 0 ? "+" : ""}${v}%`, n]}
                  contentStyle={{ background: "#0d1117", border: "1px solid #1c2333", fontFamily: "monospace", fontSize: 12 }}
                />
                <ReferenceLine y={0} stroke="#8b949e" strokeDasharray="4 4" />
                <Line dataKey="portfolio" name="Portfolio"  stroke="#00ff9d" strokeWidth={2.5} dot={false} />
                <Line dataKey="benchmark" name="S&P 500"    stroke="#8b949e" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Drawdown chart */}
          <div className="stat-card" style={{ marginBottom: 20 }}>
            <p style={{ color: "#8b949e", fontSize: 11, letterSpacing: "0.08em", marginBottom: 16 }}>
              DRAWDOWN FROM PEAK
            </p>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={result.drawdownSeries} margin={{ right: 20, bottom: 20 }}>
                <defs>
                  <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#ff6b35" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ff6b35" stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#1c2333" strokeDasharray="3 3" />
                <XAxis
                  dataKey="date" tick={{ fill: "#8b949e", fontSize: 10 }}
                  tickFormatter={d => d.slice(0, 7)}
                  interval={Math.floor(result.drawdownSeries.length / 8)}
                />
                <YAxis tick={{ fill: "#8b949e", fontSize: 10 }} tickFormatter={v => `${v}%`} />
                <Tooltip
                  formatter={v => [`${v}%`, "Drawdown"]}
                  contentStyle={{ background: "#0d1117", border: "1px solid #1c2333", fontFamily: "monospace", fontSize: 12 }}
                />
                <ReferenceLine y={0} stroke="#8b949e" />
                <Area dataKey="drawdown" name="Drawdown" stroke="#ff6b35" fill="url(#ddGrad)" strokeWidth={1.5} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Monthly returns heatmap */}
          <div className="stat-card">
            <p style={{ color: "#8b949e", fontSize: 11, letterSpacing: "0.08em", marginBottom: 16 }}>
              MONTHLY RETURNS HEATMAP
            </p>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, fontFamily: "monospace" }}>
                <thead>
                  <tr>
                    <th style={{ color: "#8b949e", textAlign: "left", padding: "6px 10px", borderBottom: "1px solid #1c2333" }}>YEAR</th>
                    {MONTHS.map(m => (
                      <th key={m} style={{ color: "#8b949e", textAlign: "right", padding: "6px 8px", borderBottom: "1px solid #1c2333", minWidth: 46 }}>{m}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.monthlyHeatmap.map(row => (
                    <tr key={row.year}>
                      <td style={{ color: "#c9d1d9", padding: "5px 10px", borderBottom: "1px solid #0d1117", fontWeight: 600 }}>{row.year}</td>
                      {MONTHS.map(m => {
                        const val = row[m];
                        const bg  = val === null ? "transparent"
                          : val > 5  ? "#00ff9d33"
                          : val > 0  ? "#00ff9d18"
                          : val > -5 ? "#ff6b3518"
                          :            "#ff6b3533";
                        const color = val === null ? "#8b949e"
                          : val >= 0 ? "#00ff9d" : "#ff6b35";
                        return (
                          <td key={m} style={{ textAlign: "right", padding: "5px 8px", background: bg, color, borderBottom: "1px solid #0d1117", borderRadius: 2 }}>
                            {val !== null ? `${val > 0 ? "+" : ""}${val}%` : "—"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {!result && !loading && !error && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#8b949e" }}>
          <p style={{ fontSize: 13, marginBottom: 8 }}>Select a lookback period and click RUN BACKTEST</p>
          <p style={{ fontSize: 11 }}>Fetches historical monthly prices from FMP and computes risk-adjusted performance vs S&P 500</p>
        </div>
      )}
    </div>
  );
}
