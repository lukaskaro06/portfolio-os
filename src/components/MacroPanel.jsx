// src/components/MacroPanel.jsx
// FRED API — all free, no key needed
// Yield curve, CPI, GDP, unemployment, M2, Fed balance sheet

import { useState, useEffect } from "react";
import { SectionLabel, Spinner } from "./UI";
import {
  ResponsiveContainer, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, Tooltip, ReferenceLine, CartesianGrid,
} from "recharts";

const PROXIES = [
  u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  u => `https://corsproxy.io/?${encodeURIComponent(u)}`,
];

async function fetchFRED(seriesId, limit = 120) {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${seriesId}`;
  for (const px of PROXIES) {
    try {
      const res = await fetch(px(url), { signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      const text = await res.text();
      const lines = text.trim().split("\n").slice(1);
      const data = lines.slice(-limit).map(l => {
        const [date, val] = l.split(",");
        return { date, value: parseFloat(val) };
      }).filter(d => !isNaN(d.value));
      if (data.length > 0) return data;
    } catch { /* try next */ }
  }
  return [];
}

const TS = { background: "#0d1117", border: "1px solid #1c2333", fontFamily: "monospace", fontSize: 11 };

// ── Single FRED chart card ─────────────────────────────────
function FREDCard({ title, seriesId, color, unit = "", limit = 120, description, fredUrl }) {
  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFRED(seriesId, limit).then(d => { setData(d); setLoading(false); });
  }, [seriesId, limit]);

  const latest  = data[data.length - 1];
  const prev    = data[data.length - 2];
  const change  = latest && prev ? latest.value - prev.value : null;
  const up      = change != null && change >= 0;

  return (
    <div style={{ background: "#0d1117", border: "1px solid #1c2333", borderRadius: 6, padding: "14px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <div style={{ color, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 2 }}>{title}</div>
          {description && <div style={{ color: "#8b949e", fontSize: 10 }}>{description}</div>}
        </div>
        <a href={fredUrl || `https://fred.stlouisfed.org/series/${seriesId}`} target="_blank" rel="noreferrer"
          style={{ color: "#8b949e44", fontSize: 9, fontFamily: "monospace" }}>FRED:{seriesId} →</a>
      </div>

      {loading ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, height: 80 }}><Spinner /><span style={{ color: "#8b949e", fontSize: 11 }}>Loading FRED data…</span></div>
      ) : data.length === 0 ? (
        <div style={{ color: "#8b949e44", fontSize: 11, height: 80, display: "flex", alignItems: "center" }}>Data unavailable — <a href={`https://fred.stlouisfed.org/series/${seriesId}`} target="_blank" rel="noreferrer" style={{ color: "#00c8ff", marginLeft: 4 }}>view on FRED →</a></div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
            <span style={{ color, fontSize: 22, fontWeight: 700, fontFamily: "monospace" }}>{latest?.value?.toFixed(2)}{unit}</span>
            {change != null && (
              <span style={{ color: up ? "#00ff9d" : "#ff6b35", fontSize: 11, fontFamily: "monospace" }}>
                {up ? "▲" : "▼"} {Math.abs(change).toFixed(3)} vs prev
              </span>
            )}
            <span style={{ color: "#8b949e44", fontSize: 10, marginLeft: "auto" }}>{latest?.date}</span>
          </div>
          <ResponsiveContainer width="100%" height={90}>
            <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`g${seriesId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" hide />
              <YAxis domain={["auto", "auto"]} hide />
              <Tooltip contentStyle={TS} formatter={v => [`${v?.toFixed(3)}${unit}`, title]} labelFormatter={l => l} />
              <Area type="monotone" dataKey="value" stroke={color} fill={`url(#g${seriesId})`} strokeWidth={1.5} dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <span style={{ color: "#8b949e44", fontSize: 9, fontFamily: "monospace" }}>{data[0]?.date}</span>
            <span style={{ color: "#8b949e44", fontSize: 9, fontFamily: "monospace" }}>{data.length} obs</span>
          </div>
        </>
      )}
    </div>
  );
}

// ── Yield curve snapshot ───────────────────────────────────
const YIELD_SERIES = [
  { label: "1M",  id: "DGS1MO" },
  { label: "3M",  id: "DGS3MO" },
  { label: "6M",  id: "DGS6MO" },
  { label: "1Y",  id: "DGS1"   },
  { label: "2Y",  id: "DGS2"   },
  { label: "5Y",  id: "DGS5"   },
  { label: "10Y", id: "DGS10"  },
  { label: "30Y", id: "DGS30"  },
];

function YieldCurve() {
  const [yields,  setYields]  = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const results = [];
      for (const s of YIELD_SERIES) {
        const data = await fetchFRED(s.id, 5);
        const latest = data[data.length - 1];
        results.push({ maturity: s.label, yield: latest?.value ?? null });
        await new Promise(r => setTimeout(r, 200));
      }
      setYields(results.filter(d => d.yield !== null));
      setLoading(false);
    };
    load();
  }, []);

  const spread = yields.find(d => d.maturity === "10Y")?.yield - yields.find(d => d.maturity === "2Y")?.yield;
  const inverted = spread != null && spread < 0;

  return (
    <div style={{ background: "#0d1117", border: "1px solid #1c2333", borderRadius: 6, padding: "14px 16px", gridColumn: "1 / -1" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div>
          <div style={{ color: "#00c8ff", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em" }}>US TREASURY YIELD CURVE</div>
          <div style={{ color: "#8b949e", fontSize: 10 }}>All maturities · Federal Reserve data (FRED)</div>
        </div>
        {!loading && spread != null && (
          <div style={{ textAlign: "right" }}>
            <div style={{ color: "#8b949e", fontSize: 9 }}>2Y/10Y SPREAD</div>
            <div style={{ color: inverted ? "#ff6b35" : "#00ff9d", fontSize: 16, fontWeight: 700, fontFamily: "monospace" }}>
              {spread >= 0 ? "+" : ""}{spread.toFixed(2)}%
            </div>
            {inverted && <div style={{ color: "#ff6b35", fontSize: 9 }}>⚠ INVERTED (recession signal)</div>}
          </div>
        )}
      </div>
      {loading ? (
        <div style={{ display: "flex", gap: 8, alignItems: "center", height: 120 }}><Spinner /><span style={{ color: "#8b949e", fontSize: 11 }}>Fetching yield curve from FRED…</span></div>
      ) : yields.length < 3 ? (
        <div style={{ color: "#8b949e", fontSize: 12 }}>
          Could not load yield curve. <a href="https://fred.stlouisfed.org/series/DGS10" target="_blank" rel="noreferrer" style={{ color: "#00c8ff" }}>View on FRED →</a>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={yields} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="#1c2333" strokeDasharray="3 3" />
            <XAxis dataKey="maturity" tick={{ fill: "#8b949e", fontSize: 10 }} axisLine={false} />
            <YAxis domain={["auto", "auto"]} tick={{ fill: "#8b949e", fontSize: 10 }} unit="%" axisLine={false} />
            <ReferenceLine y={0} stroke="#ff6b3566" strokeDasharray="4 2" />
            <Tooltip contentStyle={TS} formatter={v => [`${v?.toFixed(3)}%`, "Yield"]} />
            <Line type="monotone" dataKey="yield" stroke="#00c8ff" strokeWidth={2.5}
              dot={{ fill: "#00c8ff", r: 4, strokeWidth: 0 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────
const TABS = ["rates", "inflation", "growth", "labor", "money"];

const SERIES_MAP = {
  rates: [
    { title: "Fed Funds Rate",      id: "DFF",     color: "#ffd700", unit: "%",  description: "Overnight lending rate set by FOMC" },
    { title: "10Y Treasury Yield",  id: "DGS10",   color: "#00c8ff", unit: "%",  description: "Benchmark long-term rate" },
    { title: "2Y Treasury Yield",   id: "DGS2",    color: "#00ff9d", unit: "%",  description: "Short-term rate, tracks Fed expectations" },
    { title: "Real 10Y Yield",      id: "DFII10",  color: "#c084fc", unit: "%",  description: "Inflation-adjusted (TIPS)" },
    { title: "30Y Mortgage Rate",   id: "MORTGAGE30US", color: "#ff6b35", unit: "%", description: "30-year fixed mortgage" },
  ],
  inflation: [
    { title: "CPI YoY %",           id: "CPIAUCSL",  color: "#ff6b35", unit: "",  description: "Consumer Price Index (headline)", limit: 60 },
    { title: "Core CPI YoY %",      id: "CPILFESL",  color: "#ffd700", unit: "",  description: "CPI ex-food & energy", limit: 60 },
    { title: "PCE Inflation",        id: "PCEPI",     color: "#c084fc", unit: "",  description: "Fed's preferred inflation measure", limit: 60 },
    { title: "PPI Final Demand",     id: "PPIFIS",    color: "#00c8ff", unit: "",  description: "Producer prices (leading indicator)", limit: 60 },
    { title: "5Y Breakeven Inflation",id: "T5YIE",   color: "#00ff9d", unit: "%", description: "Market-implied inflation expectations" },
  ],
  growth: [
    { title: "US GDP (Quarterly)",   id: "GDP",      color: "#00ff9d", unit: "B", description: "Gross Domestic Product", limit: 40 },
    { title: "Real GDP Growth %",    id: "A191RL1Q225SBEA", color: "#00c8ff", unit: "%", description: "Annualised real GDP growth", limit: 40 },
    { title: "Industrial Production",id: "INDPRO",   color: "#ffd700", unit: "",  description: "Manufacturing & mining output", limit: 60 },
    { title: "Retail Sales",         id: "RSXFS",    color: "#c084fc", unit: "M", description: "Consumer spending ex-auto", limit: 60 },
    { title: "ISM Mfg PMI",          id: "MANEMP",   color: "#ff6b35", unit: "",  description: "Manufacturing employment proxy", limit: 60 },
  ],
  labor: [
    { title: "Unemployment Rate",    id: "UNRATE",   color: "#ff6b35", unit: "%", description: "U-3 headline unemployment" },
    { title: "U-6 Unemployment",     id: "U6RATE",   color: "#ffd700", unit: "%", description: "Broad unemployment (incl. underemployed)" },
    { title: "Nonfarm Payrolls",     id: "PAYEMS",   color: "#00ff9d", unit: "K", description: "Monthly jobs added (000s)", limit: 60 },
    { title: "Initial Jobless Claims",id: "ICSA",    color: "#00c8ff", unit: "",  description: "Weekly new unemployment claims", limit: 104 },
    { title: "Labor Force Participation", id: "CIVPART", color: "#c084fc", unit: "%", description: "% of working-age adults in workforce" },
  ],
  money: [
    { title: "M2 Money Supply",      id: "M2SL",     color: "#c084fc", unit: "B", description: "Broad money: deposits + savings + MM funds" },
    { title: "Fed Balance Sheet",    id: "WALCL",    color: "#ffd700", unit: "M", description: "Fed total assets (QE/QT indicator)" },
    { title: "VIX (Fear Index)",     id: "VIXCLS",   color: "#ff6b35", unit: "",  description: "S&P 500 implied volatility", limit: 260 },
    { title: "Credit Spread HY",     id: "BAMLH0A0HYM2", color: "#00c8ff", unit: "%", description: "High yield vs Treasury spread" },
    { title: "SOFR Rate",            id: "SOFR",     color: "#00ff9d", unit: "%", description: "Secured Overnight Financing Rate" },
  ],
};

export default function MacroPanel() {
  const [activeTab, setActiveTab] = useState("rates");

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
        <SectionLabel>Macro Dashboard</SectionLabel>
        <span style={{ color: "#8b949e", fontSize: 11 }}>
          Powered by <a href="https://fred.stlouisfed.org" target="_blank" rel="noreferrer" style={{ color: "#00c8ff" }}>St. Louis Federal Reserve (FRED)</a> · Free · 800,000+ series
        </span>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", borderBottom: "1px solid #1c2333", marginBottom: 20 }}>
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            background: "transparent", border: "none",
            borderBottom: `2px solid ${activeTab === tab ? "#00ff9d" : "transparent"}`,
            color: activeTab === tab ? "#00ff9d" : "#8b949e",
            padding: "8px 16px", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase",
            fontFamily: "inherit", cursor: "pointer", transition: "all 0.15s", marginBottom: -1,
          }}>{tab}</button>
        ))}
      </div>

      {/* Yield curve always shown in rates tab */}
      {activeTab === "rates" && (
        <div style={{ marginBottom: 20 }}>
          <YieldCurve />
        </div>
      )}

      {/* Series grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
        {(SERIES_MAP[activeTab] ?? []).map(s => (
          <FREDCard key={s.id} {...s} />
        ))}
      </div>

      <p style={{ color: "#8b949e33", fontSize: 10, marginTop: 20 }}>
        Data: Federal Reserve Economic Data (FRED) · Updated at source frequency · Not financial advice
      </p>
    </div>
  );
}
