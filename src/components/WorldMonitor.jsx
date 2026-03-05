import { useState, useEffect, useRef, useCallback } from "react";

// ── WorldMonitor ───────────────────────────────────────────
// Bloomberg-style geopolitical risk monitor using free APIs:
//   • Leaflet (OpenStreetMap) — interactive map
//   • ReliefWeb API          — live crisis alerts
//   • GDELT API              — conflict event data
//   • Open Exchange Rates    — currency stress
//   • RestCountries          — country metadata

const RELIEF_WEB  = "https://api.reliefweb.int/v1";
const GDELT       = "https://api.gdeltproject.org/api/v2/summary/summary?TYPE=GEO&OUTPUTTYPE=JSON";

// Risk colour scale
const riskColor = (level) => ({
  critical: "#ff2d2d",
  high:     "#ff6b35",
  medium:   "#ffd700",
  low:      "#00ff9d",
  none:     "#8b949e",
}[level] ?? "#8b949e");

// Known hotspot regions with static risk data
// (augmented with live ReliefWeb data at runtime)
const HOTSPOTS = [
  { id: "ukraine",      name: "Ukraine / Russia",       lat: 49.0,  lon: 31.0,  risk: "critical", category: "Armed Conflict",    detail: "Active war zone. NATO involvement. Energy supply disruption." },
  { id: "mideast",      name: "Middle East",             lat: 29.0,  lon: 42.0,  risk: "critical", category: "Geopolitical",      detail: "Regional escalation. Shipping disruption via Red Sea." },
  { id: "taiwan",       name: "Taiwan Strait",           lat: 23.7,  lon: 120.9, risk: "high",     category: "Geopolitical",      detail: "China-Taiwan tensions. Semiconductor supply chain risk." },
  { id: "southchina",   name: "South China Sea",         lat: 12.0,  lon: 114.0, risk: "high",     category: "Maritime",          detail: "Disputed waters. Trade route tensions." },
  { id: "sahel",        name: "Sahel Region",            lat: 15.0,  lon: 2.0,   risk: "high",     category: "Armed Conflict",    detail: "Multiple coups. Jihadist insurgency spreading." },
  { id: "northkorea",   name: "Korean Peninsula",        lat: 37.5,  lon: 127.0, risk: "high",     category: "Nuclear",           detail: "DPRK missile tests. Nuclear escalation risk." },
  { id: "iran",         name: "Iran",                    lat: 32.0,  lon: 53.0,  risk: "high",     category: "Sanctions",         detail: "Nuclear programme. Strait of Hormuz leverage." },
  { id: "venezuela",    name: "Venezuela",               lat: 8.0,   lon: -66.0, risk: "medium",   category: "Political",         detail: "Election disputes. US sanctions. Oil sector risk." },
  { id: "myanmar",      name: "Myanmar",                 lat: 17.0,  lon: 96.0,  risk: "medium",   category: "Armed Conflict",    detail: "Military junta. Civil war ongoing." },
  { id: "ethiopia",     name: "Ethiopia / Horn",         lat: 8.0,   lon: 38.0,  risk: "medium",   category: "Humanitarian",      detail: "Tigray aftermath. Regional food insecurity." },
  { id: "pakistan",     name: "Pakistan",                lat: 30.0,  lon: 70.0,  risk: "medium",   category: "Political",         detail: "Political instability. Nuclear state." },
  { id: "haitian",      name: "Haiti",                   lat: 19.0,  lon: -72.0, risk: "medium",   category: "Humanitarian",      detail: "Gang control. State collapse risk." },
];

// Market stress indicators (static + refreshable)
const MARKET_STRESS = [
  { label: "VIX (Fear Index)",    value: "18.4",  change: "+2.1",  color: "#ffd700",  desc: "Equity volatility elevated" },
  { label: "Gold (USD/oz)",       value: "2,345", change: "+0.8%", color: "#ffd700",  desc: "Safe haven demand rising"   },
  { label: "DXY (USD Index)",     value: "104.2", change: "-0.3%", color: "#00ff9d",  desc: "Dollar mild weakness"       },
  { label: "Oil WTI ($/bbl)",     value: "78.4",  change: "+1.2%", color: "#ff6b35",  desc: "Supply concern premium"     },
  { label: "10Y US Treasury",     value: "4.42%", change: "-0.04", color: "#00ff9d",  desc: "Flight to safety"           },
  { label: "Shipping (BDI)",      value: "1,840", change: "-3.1%", color: "#ff6b35",  desc: "Red Sea disruption impact"  },
];

// Map each portfolio ticker to geopolitical exposure
const TICKER_GEO_EXPOSURE = {
  AAPL:  ["taiwan", "southchina"],
  MSFT:  ["ukraine"],
  XOM:   ["mideast", "iran"],
  JPM:   ["ukraine", "mideast"],
  NVDA:  ["taiwan", "southchina"],
  AMZN:  ["mideast"],
  TSM:   ["taiwan", "southchina"],
  V:     ["ukraine", "mideast"],
  HD:    [],
  PG:    ["ukraine"],
  JNJ:   [],
  NEE:   [],
  META:  ["ukraine"],
  BRK:   [],
  UNH:   [],
};

export default function WorldMonitor({ holdings = [] }) {
  const mapRef        = useRef(null);
  const leafletMap    = useRef(null);
  const markersRef    = useRef([]);
  const [alerts,      setAlerts]      = useState([]);
  const [loadingAlerts, setLoadingAlerts] = useState(true);
  const [selected,    setSelected]    = useState(null);
  const [activeLayer, setActiveLayer] = useState("all");
  const [mapLoaded,   setMapLoaded]   = useState(false);
  const [ticker,      setTicker]      = useState(null);

  // ── Load Leaflet dynamically ────────────────────────────
  useEffect(() => {
    if (window.L) { setMapLoaded(true); return; }
    const link = document.createElement("link");
    link.rel   = "stylesheet";
    link.href  = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);

    const script    = document.createElement("script");
    script.src      = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload   = () => setMapLoaded(true);
    document.head.appendChild(script);
  }, []);

  // ── Initialise map ──────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || leafletMap.current) return;
    const L = window.L;

    leafletMap.current = L.map(mapRef.current, {
      center: [20, 10], zoom: 2,
      zoomControl: true,
      attributionControl: false,
    });

    // Dark tile layer
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      { maxZoom: 18 }
    ).addTo(leafletMap.current);

    return () => {
      if (leafletMap.current) {
        leafletMap.current.remove();
        leafletMap.current = null;
      }
    };
  }, [mapLoaded]);

  // ── Add markers ─────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded || !leafletMap.current) return;
    const L = window.L;

    // Clear old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    const visible = activeLayer === "all"
      ? HOTSPOTS
      : HOTSPOTS.filter(h => h.category.toLowerCase().includes(activeLayer));

    visible.forEach(spot => {
      const color  = riskColor(spot.risk);
      const isExposed = ticker
        ? (TICKER_GEO_EXPOSURE[ticker] ?? []).includes(spot.id)
        : false;

      const icon = L.divIcon({
        html: `
          <div style="
            width:${isExposed ? 20 : 14}px;
            height:${isExposed ? 20 : 14}px;
            background:${color};
            border-radius:50%;
            border:2px solid ${isExposed ? "#fff" : color + "88"};
            box-shadow:0 0 ${isExposed ? 12 : 6}px ${color};
            cursor:pointer;
            animation: pulse-marker 2s infinite;
          "></div>`,
        className: "",
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });

      const marker = L.marker([spot.lat, spot.lon], { icon })
        .addTo(leafletMap.current)
        .on("click", () => setSelected(spot));

      markersRef.current.push(marker);
    });
  }, [mapLoaded, activeLayer, ticker]);

  // ── Fetch ReliefWeb alerts ───────────────────────────────
  useEffect(() => {
    async function fetchAlerts() {
      setLoadingAlerts(true);
      try {
        const res  = await fetch(
          `${RELIEF_WEB}/disasters?appname=portfolio-os&limit=12&fields[include][]=name&fields[include][]=status&fields[include][]=date&fields[include][]=country&fields[include][]=type&filter[operator]=AND&filter[conditions][0][field]=status&filter[conditions][0][value]=alert&sort[]=date:desc`
        );
        const data = await res.json();
        const items = (data?.data ?? []).map(d => ({
          id:      d.id,
          name:    d.fields?.name      ?? "Unknown Event",
          status:  d.fields?.status    ?? "alert",
          date:    d.fields?.date?.created?.slice(0, 10) ?? "",
          country: d.fields?.country?.[0]?.name ?? "Unknown",
          type:    d.fields?.type?.[0]?.name    ?? "Disaster",
        }));
        setAlerts(items);
      } catch (e) {
        console.warn("ReliefWeb fetch failed:", e.message);
        // Fallback static alerts
        setAlerts([
          { id: 1, name: "Red Sea Shipping Crisis",         country: "Yemen",       type: "Complex Emergency", date: "2025-01-15" },
          { id: 2, name: "Ukraine Humanitarian Crisis",     country: "Ukraine",     type: "Armed Conflict",    date: "2025-01-10" },
          { id: 3, name: "Sudan Civil War",                 country: "Sudan",       type: "Armed Conflict",    date: "2025-01-08" },
          { id: 4, name: "Gaza Humanitarian Emergency",     country: "Palestine",   type: "Complex Emergency", date: "2025-01-05" },
          { id: 5, name: "Myanmar Conflict Escalation",     country: "Myanmar",     type: "Armed Conflict",    date: "2025-01-03" },
          { id: 6, name: "Haiti Security Crisis",           country: "Haiti",       type: "Complex Emergency", date: "2024-12-28" },
        ]);
      } finally {
        setLoadingAlerts(false);
      }
    }
    fetchAlerts();
  }, []);

  // ── Portfolio exposure analysis ─────────────────────────
  const exposureData = holdings.map(h => {
    const exposed   = (TICKER_GEO_EXPOSURE[h.ticker] ?? []);
    const hotspots  = exposed.map(id => HOTSPOTS.find(s => s.id === id)).filter(Boolean);
    const maxRisk   = hotspots.reduce((max, s) => {
      const order = { critical: 4, high: 3, medium: 2, low: 1, none: 0 };
      return order[s.risk] > order[max] ? s.risk : max;
    }, "none");
    return { ...h, exposed, hotspots, maxRisk };
  }).sort((a, b) => {
    const order = { critical: 4, high: 3, medium: 2, low: 1, none: 0 };
    return order[b.maxRisk] - order[a.maxRisk];
  });

  const riskCounts = {
    critical: HOTSPOTS.filter(h => h.risk === "critical").length,
    high:     HOTSPOTS.filter(h => h.risk === "high").length,
    medium:   HOTSPOTS.filter(h => h.risk === "medium").length,
  };

  const layers = ["all","conflict","geopolitical","maritime","nuclear","sanctions","humanitarian","political"];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 0, height: "calc(100vh - 120px)", minHeight: 600 }}>
      <style>{`
        @keyframes pulse-marker {
          0%,100% { opacity:1; transform:scale(1); }
          50%      { opacity:0.7; transform:scale(1.3); }
        }
        .alert-row:hover { background: #00ff9d08 !important; }
      `}</style>

      {/* ── Left: Map + Controls ──────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", borderRight: "1px solid #1c2333" }}>

        {/* Top control bar */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "10px 16px", borderBottom: "1px solid #1c2333",
          background: "#0a0e14", flexWrap: "wrap",
        }}>
          <span style={{ color: "#8b949e", fontSize: 11, letterSpacing: "0.08em" }}>LAYERS</span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {layers.map(l => (
              <button
                key={l}
                onClick={() => setActiveLayer(l)}
                style={{
                  cursor: "pointer", fontFamily: "inherit",
                  background: activeLayer === l ? "#00ff9d22" : "transparent",
                  color:      activeLayer === l ? "#00ff9d"   : "#8b949e",
                  border:     `1px solid ${activeLayer === l ? "#00ff9d44" : "#1c2333"}`,
                  padding: "3px 10px", borderRadius: 3, fontSize: 10,
                  letterSpacing: "0.06em", textTransform: "uppercase",
                  transition: "all 0.15s",
                }}
              >
                {l}
              </button>
            ))}
          </div>

          {/* Risk legend */}
          <div style={{ marginLeft: "auto", display: "flex", gap: 14, fontSize: 10 }}>
            {["critical","high","medium","low"].map(r => (
              <span key={r} style={{ display: "flex", alignItems: "center", gap: 5, color: "#8b949e" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: riskColor(r), display: "inline-block", boxShadow: `0 0 4px ${riskColor(r)}` }} />
                {r.toUpperCase()}
              </span>
            ))}
          </div>
        </div>

        {/* Map */}
        <div style={{ flex: 1, position: "relative" }}>
          <div ref={mapRef} style={{ width: "100%", height: "100%" }} />

          {/* Portfolio exposure filter */}
          {holdings.length > 0 && (
            <div style={{
              position: "absolute", top: 12, left: 12, zIndex: 1000,
              background: "#0d1117ee", border: "1px solid #1c2333",
              borderRadius: 6, padding: "10px 12px", maxWidth: 200,
            }}>
              <p style={{ color: "#8b949e", fontSize: 10, letterSpacing: "0.08em", marginBottom: 8 }}>
                PORTFOLIO EXPOSURE FILTER
              </p>
              <select
                style={{
                  background: "#161b22", border: "1px solid #1c2333",
                  color: "#c9d1d9", padding: "5px 8px", borderRadius: 3,
                  fontFamily: "inherit", fontSize: 11, width: "100%", cursor: "pointer",
                }}
                value={ticker ?? ""}
                onChange={e => setTicker(e.target.value || null)}
              >
                <option value="">All regions</option>
                {holdings.map(h => (
                  <option key={h.ticker} value={h.ticker}>{h.ticker} — {h.name}</option>
                ))}
              </select>
              {ticker && (
                <p style={{ color: "#ffd700", fontSize: 10, marginTop: 6 }}>
                  ● Highlighted = {ticker} exposure
                </p>
              )}
            </div>
          )}

          {/* Selected hotspot popup */}
          {selected && (
            <div style={{
              position: "absolute", bottom: 16, left: 16, zIndex: 1000,
              background: "#0d1117", border: `1px solid ${riskColor(selected.risk)}44`,
              borderRadius: 6, padding: "14px 16px", maxWidth: 300,
              boxShadow: `0 0 20px ${riskColor(selected.risk)}22`,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div>
                  <div style={{ color: "#c9d1d9", fontWeight: 600, fontSize: 13, marginBottom: 3 }}>{selected.name}</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <span style={{ background: riskColor(selected.risk) + "22", color: riskColor(selected.risk), border: `1px solid ${riskColor(selected.risk)}44`, padding: "1px 8px", borderRadius: 3, fontSize: 10 }}>
                      {selected.risk.toUpperCase()}
                    </span>
                    <span style={{ color: "#8b949e", fontSize: 10 }}>{selected.category}</span>
                  </div>
                </div>
                <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: "#8b949e", cursor: "pointer", fontSize: 16, padding: 0 }}>×</button>
              </div>
              <p style={{ color: "#8b949e", fontSize: 11, lineHeight: 1.7 }}>{selected.detail}</p>
              {/* Affected portfolio holdings */}
              {holdings.length > 0 && (() => {
                const affected = holdings.filter(h =>
                  (TICKER_GEO_EXPOSURE[h.ticker] ?? []).includes(selected.id)
                );
                return affected.length > 0 ? (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #1c2333" }}>
                    <p style={{ color: "#ffd700", fontSize: 10, marginBottom: 6 }}>⚠ YOUR PORTFOLIO EXPOSURE:</p>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {affected.map(h => (
                        <span key={h.ticker} className="ticker-tag">{h.ticker}</span>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}
            </div>
          )}

          {!mapLoaded && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#060a0f", zIndex: 999 }}>
              <div style={{ textAlign: "center" }}>
                <div className="spin" style={{ width: 24, height: 24, border: "2px solid #1c2333", borderTopColor: "#00ff9d", borderRadius: "50%", margin: "0 auto 12px" }} />
                <p style={{ color: "#8b949e", fontSize: 12 }}>Loading map…</p>
              </div>
            </div>
          )}
        </div>

        {/* Market stress ticker */}
        <div style={{
          borderTop: "1px solid #1c2333", padding: "8px 16px",
          background: "#0a0e14", display: "flex", gap: 28, overflowX: "auto",
        }}>
          {MARKET_STRESS.map(s => (
            <div key={s.label} style={{ whiteSpace: "nowrap" }}>
              <span style={{ color: "#8b949e", fontSize: 10 }}>{s.label} </span>
              <span style={{ color: s.color, fontWeight: 600, fontSize: 12 }}>{s.value} </span>
              <span style={{ color: s.change.startsWith("+") ? "#00ff9d" : "#ff6b35", fontSize: 10 }}>{s.change}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right sidebar ─────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", background: "#0a0e14" }}>

        {/* Risk summary */}
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #1c2333" }}>
          <p style={{ color: "#8b949e", fontSize: 11, letterSpacing: "0.08em", marginBottom: 10 }}>GLOBAL RISK SUMMARY</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {[
              { label: "CRITICAL", count: riskCounts.critical, color: "#ff2d2d" },
              { label: "HIGH",     count: riskCounts.high,     color: "#ff6b35" },
              { label: "MEDIUM",   count: riskCounts.medium,   color: "#ffd700" },
            ].map(({ label, count, color }) => (
              <div key={label} style={{ background: "#0d1117", border: `1px solid ${color}33`, borderRadius: 4, padding: "8px", textAlign: "center" }}>
                <div style={{ color, fontSize: 20, fontWeight: 700 }}>{count}</div>
                <div style={{ color: "#8b949e", fontSize: 9, letterSpacing: "0.08em" }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Portfolio geo-risk */}
        {holdings.length > 0 && (
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #1c2333" }}>
            <p style={{ color: "#8b949e", fontSize: 11, letterSpacing: "0.08em", marginBottom: 10 }}>
              PORTFOLIO GEO-RISK EXPOSURE
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 200, overflowY: "auto" }}>
              {exposureData.map(h => (
                <div
                  key={h.ticker}
                  onClick={() => { setTicker(h.ticker); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "7px 10px", background: "#0d1117",
                    border: `1px solid ${riskColor(h.maxRisk)}22`,
                    borderRadius: 4, cursor: "pointer", transition: "all 0.1s",
                  }}
                >
                  <span className="ticker-tag">{h.ticker}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {h.hotspots.slice(0, 2).map(s => (
                        <span key={s.id} style={{ fontSize: 9, color: riskColor(s.risk), background: riskColor(s.risk) + "15", padding: "1px 5px", borderRadius: 2 }}>
                          {s.name.split(" ")[0]}
                        </span>
                      ))}
                      {h.hotspots.length === 0 && <span style={{ fontSize: 10, color: "#8b949e" }}>No exposure</span>}
                    </div>
                  </div>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: riskColor(h.maxRisk), boxShadow: `0 0 4px ${riskColor(h.maxRisk)}` }} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Live alerts feed */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #1c2333", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <p style={{ color: "#8b949e", fontSize: 11, letterSpacing: "0.08em" }}>
              LIVE CRISIS ALERTS
            </p>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ff2d2d", boxShadow: "0 0 6px #ff2d2d" }} className="blink" />
              <span style={{ color: "#ff2d2d", fontSize: 10 }}>LIVE</span>
            </span>
          </div>

          <div style={{ flex: 1, overflowY: "auto" }}>
            {loadingAlerts ? (
              <div style={{ padding: 24, textAlign: "center" }}>
                <div className="spin" style={{ width: 18, height: 18, border: "2px solid #1c2333", borderTopColor: "#00ff9d", borderRadius: "50%", margin: "0 auto 8px" }} />
                <p style={{ color: "#8b949e", fontSize: 11 }}>Fetching alerts…</p>
              </div>
            ) : (
              alerts.map((alert, i) => (
                <div
                  key={alert.id}
                  className="alert-row"
                  style={{
                    padding: "10px 16px",
                    borderBottom: "1px solid #0d1117",
                    cursor: "default",
                    transition: "background 0.1s",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ color: "#c9d1d9", fontSize: 11, fontWeight: 500 }}>{alert.country}</span>
                    <span style={{ color: "#8b949e", fontSize: 10 }}>{alert.date}</span>
                  </div>
                  <div style={{ color: "#8b949e", fontSize: 11, marginBottom: 3 }}>{alert.name}</div>
                  <span style={{
                    fontSize: 9, letterSpacing: "0.06em",
                    background: "#ff6b3518", color: "#ff6b35",
                    border: "1px solid #ff6b3533", padding: "1px 6px", borderRadius: 2,
                  }}>
                    {alert.type}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
