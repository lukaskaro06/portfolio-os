// src/components/CommoditiesPanel.jsx
// Yahoo Finance futures via existing proxy
import { useState, useEffect } from "react";
import { SectionLabel, Spinner } from "./UI";
import { proxyUrl } from "../hooks/useStockData";

const COMMODITIES = [
  // Energy
  { ticker: "CL=F",  label: "WTI Crude Oil",   unit: "$/bbl",  group: "Energy" },
  { ticker: "BZ=F",  label: "Brent Crude",      unit: "$/bbl",  group: "Energy" },
  { ticker: "NG=F",  label: "Natural Gas",       unit: "$/MMBtu",group: "Energy" },
  { ticker: "HO=F",  label: "Heating Oil",       unit: "$/gal",  group: "Energy" },
  { ticker: "RB=F",  label: "RBOB Gasoline",     unit: "$/gal",  group: "Energy" },
  // Metals
  { ticker: "GC=F",  label: "Gold",              unit: "$/oz",   group: "Metals" },
  { ticker: "SI=F",  label: "Silver",            unit: "$/oz",   group: "Metals" },
  { ticker: "PL=F",  label: "Platinum",          unit: "$/oz",   group: "Metals" },
  { ticker: "PA=F",  label: "Palladium",         unit: "$/oz",   group: "Metals" },
  { ticker: "HG=F",  label: "Copper",            unit: "$/lb",   group: "Metals" },
  // Ags
  { ticker: "ZW=F",  label: "Wheat",             unit: "¢/bu",   group: "Agriculture" },
  { ticker: "ZC=F",  label: "Corn",              unit: "¢/bu",   group: "Agriculture" },
  { ticker: "ZS=F",  label: "Soybeans",          unit: "¢/bu",   group: "Agriculture" },
  { ticker: "KC=F",  label: "Coffee",            unit: "¢/lb",   group: "Agriculture" },
  { ticker: "CT=F",  label: "Cotton",            unit: "¢/lb",   group: "Agriculture" },
  { ticker: "SB=F",  label: "Sugar #11",         unit: "¢/lb",   group: "Agriculture" },
  { ticker: "CC=F",  label: "Cocoa",             unit: "$/MT",   group: "Agriculture" },
  { ticker: "LB=F",  label: "Lumber",            unit: "$/MBF",  group: "Agriculture" },
  // Livestock
  { ticker: "LE=F",  label: "Live Cattle",       unit: "¢/lb",   group: "Livestock" },
  { ticker: "HE=F",  label: "Lean Hogs",         unit: "¢/lb",   group: "Livestock" },
];

async function fetchFuturesQuote(ticker) {
  try {
    const url  = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`;
    const res  = await fetch(proxyUrl(url));
    if (!res.ok) return null;
    const json = await res.json();
    const meta = json?.chart?.result?.[0]?.meta;
    if (!meta) return null;
    const price = meta.regularMarketPrice;
    const prev  = meta.chartPreviousClose || price;
    const chg   = price - prev;
    const pct   = prev ? (chg / prev) * 100 : 0;
    return {
      price:     +price.toFixed(3),
      change:    +chg.toFixed(3),
      changePct: +pct.toFixed(2),
      positive:  chg >= 0,
      high:      meta.regularMarketDayHigh,
      low:       meta.regularMarketDayLow,
      open:      meta.regularMarketOpen,
    };
  } catch { return null; }
}

const GROUP_COLORS = {
  Energy:      "#ff6b35",
  Metals:      "#ffd700",
  Agriculture: "#00ff9d",
  Livestock:   "#c084fc",
};

export default function CommoditiesPanel() {
  const [quotes,   setQuotes]   = useState({});
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState("All");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      for (const c of COMMODITIES) {
        const q = await fetchFuturesQuote(c.ticker);
        if (q) setQuotes(prev => ({ ...prev, [c.ticker]: q }));
        await new Promise(r => setTimeout(r, 150));
      }
      setLoading(false);
    };
    load();
  }, []);

  const groups  = ["All", "Energy", "Metals", "Agriculture", "Livestock"];
  const visible = COMMODITIES.filter(c => filter === "All" || c.group === filter);
  const loaded  = Object.keys(quotes).length;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <SectionLabel>Commodities</SectionLabel>
        <span style={{ color: "#8b949e", fontSize: 11 }}>Live futures · Yahoo Finance · {loaded}/{COMMODITIES.length} loaded</span>
        {loading && <Spinner />}
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          {groups.map(g => (
            <button key={g} onClick={() => setFilter(g)} style={{
              background:  filter === g ? `${GROUP_COLORS[g] ?? "#00ff9d"}15` : "#0d1117",
              border:      `1px solid ${filter === g ? (GROUP_COLORS[g] ?? "#00ff9d") + "55" : "#1c2333"}`,
              color:       filter === g ? (GROUP_COLORS[g] ?? "#00ff9d") : "#8b949e",
              padding:     "4px 12px", borderRadius: 4, fontSize: 10,
              cursor:      "pointer", fontFamily: "inherit",
            }}>{g}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ background: "#060a0f", border: "1px solid #1c2333", borderRadius: 6, overflow: "hidden" }}>
        {/* Header */}
        <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 70px 110px 110px 100px 100px", padding: "8px 16px", borderBottom: "1px solid #1c2333" }}>
          {["GROUP","COMMODITY","UNIT","PRICE","CHANGE","DAY LOW","DAY HIGH"].map(h => (
            <span key={h} style={{ color: "#8b949e", fontSize: 10, fontWeight: 700, letterSpacing: "0.07em" }}>{h}</span>
          ))}
        </div>

        {/* Group-separated rows */}
        {groups.filter(g => g !== "All" && (filter === "All" || filter === g)).map(group => {
          const items = visible.filter(c => c.group === group);
          if (!items.length) return null;
          const gc = GROUP_COLORS[group];
          return (
            <div key={group}>
              {/* Group header */}
              <div style={{ padding: "6px 16px", background: `${gc}0a`, borderBottom: "1px solid #1c233344", borderTop: "1px solid #1c233344" }}>
                <span style={{ color: gc, fontSize: 10, fontWeight: 800, letterSpacing: "0.1em" }}>◆ {group.toUpperCase()}</span>
              </div>
              {items.map(c => {
                const q = quotes[c.ticker];
                return (
                  <div key={c.ticker}
                    style={{ display: "grid", gridTemplateColumns: "120px 1fr 70px 110px 110px 100px 100px", padding: "11px 16px", borderBottom: "1px solid #1c233322", alignItems: "center", transition: "background 0.1s" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#ffffff04"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <span style={{ color: "#8b949e44", fontSize: 10, fontFamily: "monospace" }}>{c.ticker}</span>
                    <span style={{ color: "#c9d1d9", fontSize: 12, fontWeight: 500 }}>{c.label}</span>
                    <span style={{ color: "#8b949e", fontSize: 10 }}>{c.unit}</span>
                    {q ? (
                      <>
                        <span style={{ color: "#fff", fontFamily: "monospace", fontSize: 13, fontWeight: 700 }}>{q.price?.toLocaleString(undefined, { maximumFractionDigits: 3 })}</span>
                        <span style={{ color: q.positive ? "#00ff9d" : "#ff6b35", fontFamily: "monospace", fontSize: 11, fontWeight: 700 }}>
                          {q.positive ? "▲" : "▼"} {Math.abs(q.change).toFixed(3)} ({Math.abs(q.changePct).toFixed(2)}%)
                        </span>
                        <span style={{ color: "#8b949e", fontFamily: "monospace", fontSize: 11 }}>{q.low?.toFixed(2) ?? "—"}</span>
                        <span style={{ color: "#8b949e", fontFamily: "monospace", fontSize: 11 }}>{q.high?.toFixed(2) ?? "—"}</span>
                      </>
                    ) : (
                      <><span style={{ color: "#8b949e" }}><Spinner /></span><span /><span /><span /></>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Useful links */}
      <div style={{ display: "flex", gap: 16, marginTop: 16, flexWrap: "wrap" }}>
        {[
          ["EIA Oil Report",      "https://www.eia.gov/petroleum/supply/weekly/"],
          ["CME Group Futures",   "https://www.cmegroup.com/markets/commodities.html"],
          ["USDA Crop Reports",   "https://www.usda.gov/topics/farming/crops"],
          ["Gold Council",        "https://www.gold.org/goldhub/data/gold-prices"],
          ["LME Metals",          "https://www.lme.com/en/metals"],
        ].map(([label, url]) => (
          <a key={label} href={url} target="_blank" rel="noreferrer"
            style={{ color: "#00c8ff", fontSize: 11, textDecoration: "none", background: "#0d1117", border: "1px solid #1c2333", padding: "4px 10px", borderRadius: 4 }}>
            {label} →
          </a>
        ))}
      </div>

      <p style={{ color: "#8b949e33", fontSize: 10, marginTop: 16 }}>
        Futures data via Yahoo Finance · Prices delayed ~15 min · Not financial advice
      </p>
    </div>
  );
}
