import { useState, useEffect } from "react";
import { Spinner } from "./UI";

export default function LiveDataBanner({
  hasApiKey, loading, errors, lastFetch, onRefresh,
}) {
  const [secsAgo, setSecsAgo] = useState(0);

  // Tick every 500ms so the "X s ago" counter stays fresh
  useEffect(() => {
    const t = setInterval(() => {
      setSecsAgo(lastFetch ? Math.round((Date.now() - lastFetch.getTime()) / 1000) : 0);
    }, 500);
    return () => clearInterval(t);
  }, [lastFetch]);

  // ── No API key ────────────────────────────────────────
  if (!hasApiKey) {
    return (
      <div style={banner("#ffd70018", "#ffd70044")}>
        <span style={{ color: "#ffd700", fontSize: 11, letterSpacing: "0.08em" }}>
          ⚠ STATIC DATA MODE
        </span>
        <span style={{ color: "#8b949e", fontSize: 11, marginLeft: 12 }}>
          Add <code style={code}>REACT_APP_FMP_KEY=your_key</code> to a{" "}
          <code style={code}>.env</code> file in the project root, then restart{" "}
          <code style={code}>npm start</code> to enable live market data.
        </span>
        <a
          href="https://financialmodelingprep.com/register"
          target="_blank"
          rel="noreferrer"
          style={{ marginLeft: "auto", color: "#ffd700", fontSize: 11 }}
        >
          Get free API key →
        </a>
      </div>
    );
  }

  // ── Loading / first fetch ─────────────────────────────
  if (loading && !lastFetch) {
    return (
      <div style={banner("#00ff9d0a", "#00ff9d22")}>
        <Spinner />
        <span style={{ color: "#8b949e", fontSize: 11, marginLeft: 10 }}>
          Fetching live market data…
        </span>
      </div>
    );
  }

  // ── Partial errors ────────────────────────────────────
  if (errors && errors.length > 0) {
    return (
      <div style={banner("#ff6b3518", "#ff6b3533")}>
        <span style={{ color: "#ff6b35", fontSize: 11, letterSpacing: "0.08em" }}>
          ⚠ LIVE DATA PARTIAL
        </span>
        <span style={{ color: "#8b949e", fontSize: 11, marginLeft: 12 }}>
          Could not fetch: {errors.join(", ")} — showing static fallback values.
        </span>
        <button onClick={onRefresh} style={refreshBtn("#ff6b3544", "#ff6b35")}>
          RETRY
        </button>
      </div>
    );
  }

  // ── Live + refreshing ─────────────────────────────────
  return (
    <div style={banner("#00ff9d0a", "#00ff9d1a")}>

      {/* Pulse dot */}
      <span style={{
        width: 7, height: 7, borderRadius: "50%",
        background: loading ? "#ffd700" : "#00ff9d",
        boxShadow: loading ? "0 0 5px #ffd700" : "0 0 6px #00ff9d99",
        display: "inline-block",
        flexShrink: 0,
      }} />

      <span style={{
        color: loading ? "#ffd700" : "#00ff9d",
        fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
      }}>
        {loading ? "UPDATING…" : "LIVE"}
      </span>

      <span style={{ color: "#8b949e", fontSize: 11 }}>
        Yahoo Finance · refreshes every{" "}
        <span style={{ color: "#00ff9d", fontWeight: 600 }}>2 s</span>
      </span>

      <span style={{ color: "#8b949e55", fontSize: 11 }}>
        Prices delayed ~15 min (Yahoo free tier)
      </span>

      {lastFetch && (
        <span style={{ color: "#8b949e44", fontSize: 10 }}>
          Last sync {secsAgo}s ago
        </span>
      )}

      <button
        onClick={onRefresh}
        disabled={loading}
        style={{
          ...refreshBtn("#00ff9d33", "#8b949e"),
          marginLeft: "auto",
          display: "flex", alignItems: "center", gap: 6,
          opacity: loading ? 0.5 : 1,
          cursor: loading ? "default" : "pointer",
        }}
        onMouseEnter={e => { if (!loading) e.currentTarget.style.color = "#00ff9d"; }}
        onMouseLeave={e => { e.currentTarget.style.color = "#8b949e"; }}
      >
        {loading ? <><Spinner /> Refreshing</> : "↻ REFRESH"}
      </button>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────
const banner = (bg, border) => ({
  display: "flex",
  alignItems: "center",
  padding: "6px 24px",
  background: bg,
  borderBottom: `1px solid ${border}`,
  gap: 12,
  minHeight: 34,
  flexWrap: "wrap",
});

const refreshBtn = (borderColor, color) => ({
  background: "transparent",
  border: `1px solid ${borderColor}`,
  color,
  padding: "3px 12px",
  borderRadius: 3,
  fontFamily: "inherit",
  fontSize: 11,
  transition: "color 0.15s",
});

const code = {
  background: "#161b22",
  color: "#c9d1d9",
  padding: "1px 5px",
  borderRadius: 3,
  fontSize: 11,
  fontFamily: "inherit",
};
