// src/components/Analytics.jsx — live prices wired in via stockData prop
import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, ReferenceLine, LineChart, Line,
} from "recharts";
import { CHART_COLORS } from "../data/stocks";
import { getValuationScore } from "../utils/finance";
import { SectionLabel, ChartTooltip } from "./UI";

const TS = { background: "#0d1117", border: "1px solid #1c2333", fontFamily: "monospace", fontSize: 12 };

export default function AnalyticsTab({ holdings, sectorBreakdown, stockData }) {
  if (!holdings.length)
    return <p style={{ color: "#8b949e", padding: 40, textAlign: "center" }}>Add holdings to view analytics.</p>;

  // Enrich holdings with live price data for charts
  const enriched = holdings.map(h => {
    const q = stockData?.getQuote(h.ticker);
    return {
      ...h,
      livePrice:     q?.price     ?? h.livePrice ?? h.price ?? null,
      liveChangePct: q?.changePct ?? h.liveChangePct ?? null,
      livePositive:  q?.positive  ?? true,
    };
  });

  // Radar: normalise each metric to 0-100 scale
  const radarData = [
    { metric: "VALUE SCORE",  value: avg(holdings, h => getValuationScore(h)) },
    { metric: "RETURN",       value: avg(holdings, h => h.expectedReturn) * 5 },
    { metric: "LOW VOL",      value: 100 - avg(holdings, h => h.volatility) * 1.5 },
    { metric: "LOW BETA",     value: Math.max(0, 100 - avg(holdings, h => h.beta) * 60) },
    { metric: "DIVIDEND",     value: avg(holdings, h => h.dividend) * 20 },
    { metric: "EV/EBIT INV",  value: Math.max(0, 100 - avg(holdings, h => h.evEbitda) * 2) },
  ];

  // Live performance chart data
  const perfData = enriched
    .filter(h => h.liveChangePct != null)
    .map(h => ({ ticker: h.ticker, change: h.liveChangePct, positive: h.livePositive }))
    .sort((a, b) => b.change - a.change);

  return (
    <div>
      <SectionLabel>Portfolio Analytics</SectionLabel>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>

        {/* 1. Allocation donut */}
        <div className="stat-card">
          <p style={{ color: "#8b949e", fontSize: 11, letterSpacing: "0.08em", marginBottom: 16 }}>ALLOCATION BREAKDOWN</p>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={holdings} dataKey="weight" nameKey="ticker"
                cx="50%" cy="50%" outerRadius={95} innerRadius={50} paddingAngle={2}>
                {holdings.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="#0d1117" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip formatter={(v, n) => [`${Number(v).toFixed(1)}%`, n]} contentStyle={TS} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", marginTop: 8 }}>
            {holdings.map((h, i) => (
              <span key={h.ticker} style={{ fontSize: 11, color: CHART_COLORS[i % CHART_COLORS.length], display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 8, height: 8, background: CHART_COLORS[i % CHART_COLORS.length], display: "inline-block", borderRadius: 2 }} />
                {h.ticker} {h.weight.toFixed(1)}%
              </span>
            ))}
          </div>
        </div>

        {/* 2. Sector exposure */}
        <div className="stat-card">
          <p style={{ color: "#8b949e", fontSize: 11, letterSpacing: "0.08em", marginBottom: 16 }}>SECTOR EXPOSURE</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={sectorBreakdown} layout="vertical" margin={{ left: 10, right: 20, bottom: 0 }}>
              <CartesianGrid stroke="#1c2333" horizontal={false} />
              <XAxis type="number" tick={{ fill: "#8b949e", fontSize: 10 }} unit="%" domain={[0, 100]} />
              <YAxis type="category" dataKey="name" tick={{ fill: "#c9d1d9", fontSize: 11 }} width={95} />
              <Tooltip formatter={v => [`${v}%`]} contentStyle={TS} />
              <Bar dataKey="value" name="Weight" radius={[0, 4, 4, 0]}>
                {sectorBreakdown.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3. Live today's performance */}
      {perfData.length > 0 && (
        <div className="stat-card" style={{ marginBottom: 20 }}>
          <p style={{ color: "#8b949e", fontSize: 11, letterSpacing: "0.08em", marginBottom: 16 }}>TODAY'S PERFORMANCE — LIVE PRICE CHANGE %</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={perfData} margin={{ bottom: 20 }}>
              <CartesianGrid stroke="#1c2333" vertical={false} />
              <XAxis dataKey="ticker" tick={{ fill: "#c9d1d9", fontSize: 11 }} />
              <YAxis tick={{ fill: "#8b949e", fontSize: 10 }} unit="%" />
              <Tooltip formatter={v => [`${v.toFixed(2)}%`, "Change"]} contentStyle={TS} />
              <ReferenceLine y={0} stroke="#8b949e" />
              <Bar dataKey="change" name="Change %" radius={[3,3,0,0]}>
                {perfData.map((d, i) => <Cell key={i} fill={d.positive ? "#00ff9d" : "#ff6b35"} opacity={0.85} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>

        {/* 4. Valuation multiples */}
        <div className="stat-card">
          <p style={{ color: "#8b949e", fontSize: 11, letterSpacing: "0.08em", marginBottom: 16 }}>VALUATION MULTIPLES</p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={holdings} margin={{ bottom: 20 }}>
              <CartesianGrid stroke="#1c2333" vertical={false} />
              <XAxis dataKey="ticker" tick={{ fill: "#c9d1d9", fontSize: 11 }} />
              <YAxis tick={{ fill: "#8b949e", fontSize: 10 }} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="pe"       name="P/E"       fill="#00ff9d" opacity={0.85} radius={[2,2,0,0]} />
              <Bar dataKey="pb"       name="P/B"       fill="#00c8ff" opacity={0.85} radius={[2,2,0,0]} />
              <Bar dataKey="evEbitda" name="EV/EBITDA" fill="#ffd700" opacity={0.85} radius={[2,2,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 5. Risk vs return */}
        <div className="stat-card">
          <p style={{ color: "#8b949e", fontSize: 11, letterSpacing: "0.08em", marginBottom: 16 }}>RISK vs. EXPECTED RETURN</p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={holdings} margin={{ bottom: 20 }}>
              <CartesianGrid stroke="#1c2333" vertical={false} />
              <XAxis dataKey="ticker" tick={{ fill: "#c9d1d9", fontSize: 11 }} />
              <YAxis tick={{ fill: "#8b949e", fontSize: 10 }} unit="%" />
              <Tooltip content={<ChartTooltip />} />
              <ReferenceLine y={0} stroke="#1c2333" />
              <Bar dataKey="expectedReturn" name="Exp. Return %" fill="#00ff9d" opacity={0.85} radius={[2,2,0,0]} />
              <Bar dataKey="volatility"     name="Volatility %"  fill="#ff6b35" opacity={0.70} radius={[2,2,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 6. Live price table */}
      {enriched.some(h => h.livePrice) && (
        <div className="stat-card" style={{ marginBottom: 20 }}>
          <p style={{ color: "#8b949e", fontSize: 11, letterSpacing: "0.08em", marginBottom: 14 }}>LIVE MARKET PRICES</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
            {enriched.map((h, i) => (
              <div key={h.ticker} style={{ background: "#0d1117", border: `1px solid ${CHART_COLORS[i % CHART_COLORS.length]}33`, borderRadius: 6, padding: "10px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <span className="ticker-tag" style={{ fontSize: 12 }}>{h.ticker}</span>
                  <span style={{ color: h.livePositive ? "#00ff9d" : "#ff6b35", fontSize: 11, fontWeight: 600 }}>
                    {h.livePositive ? "+" : ""}{h.liveChangePct?.toFixed(2) ?? "—"}%
                  </span>
                </div>
                <div style={{ color: "#fff", fontSize: 18, fontWeight: 700 }}>{h.livePrice ? `$${h.livePrice}` : "—"}</div>
                <div style={{ color: "#8b949e", fontSize: 10, marginTop: 2 }}>Weight {h.weight.toFixed(1)}%</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. Radar */}
      <div className="stat-card">
        <p style={{ color: "#8b949e", fontSize: 11, letterSpacing: "0.08em", marginBottom: 8 }}>PORTFOLIO QUALITY RADAR</p>
        <p style={{ color: "#8b949e", fontSize: 11, marginBottom: 16 }}>Normalised scores — outer edge = best possible profile</p>
        <ResponsiveContainer width="100%" height={280}>
          <RadarChart cx="50%" cy="50%" outerRadius={110} data={radarData}>
            <PolarGrid stroke="#1c2333" />
            <PolarAngleAxis dataKey="metric" tick={{ fill: "#8b949e", fontSize: 11 }} />
            <Radar name="Portfolio" dataKey="value" stroke="#00ff9d" fill="#00ff9d" fillOpacity={0.15} strokeWidth={2} />
            <Tooltip formatter={v => [v.toFixed(1), "Score"]} contentStyle={TS} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function avg(arr, fn) {
  if (!arr.length) return 0;
  return arr.reduce((s, x) => s + fn(x), 0) / arr.length;
}
