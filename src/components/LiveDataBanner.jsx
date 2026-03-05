import { Spinner } from "./UI";

// ── LiveDataBanner ─────────────────────────────────────────
// Sits just below the header. Shows one of four states:
//   1. No API key configured  → yellow warning + instructions
//   2. Fetching live data      → spinner + "Loading..."
//   3. Some tickers errored    → orange warning with list
//   4. All data fresh          → green "LIVE" indicator + timestamp
export default function LiveDataBanner({
  hasApiKey, loading, errors, lastFetch, onRefresh,
}) {
  // ── No API key ─────────────────────────────────────────
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

  // ── Fetching ────────────────────────────────────────────
  if (loading) {
    return (
      <div style={banner("#00ff9d0a", "#00ff9d22")}>
        <Spinner />
        <span style={{ color: "#8b949e", fontSize: 11, marginLeft: 10 }}>
          Fetching live market data…
        </span>
      </div>
    );
  }

  // ── Partial errors ─────────────────────────────────────
  if (errors.length > 0) {
    return (
      <div style={banner("#ff6b3518", "#ff6b3533")}>
        <span style={{ color: "#ff6b35", fontSize: 11, letterSpacing: "0.08em" }}>
          ⚠ LIVE DATA PARTIAL
        </span>
        <span style={{ color: "#8b949e", fontSize: 11, marginLeft: 12 }}>
          Could not fetch: {errors.join(", ")} — showing static fallback values for those tickers.
        </span>
        <button
          onClick={onRefresh}
          style={{
            marginLeft: "auto", cursor: "pointer",
            background: "transparent", border: "1px solid #ff6b3544",
            color: "#ff6b35", padding: "3px 12px", borderRadius: 3,
            fontFamily: "inherit", fontSize: 11,
          }}
        >
          RETRY
        </button>
      </div>
    );
  }

  // ── All good ────────────────────────────────────────────
  if (lastFetch) {
    return (
      <div style={banner("#00ff9d0a", "#00ff9d1a")}>
        <span style={{
          width: 7, height: 7, borderRadius: "50%",
          background: "#00ff9d", boxShadow: "0 0 6px #00ff9d",
          display: "inline-block",
        }} />
        <span style={{ color: "#00ff9d", fontSize: 11, marginLeft: 8, letterSpacing: "0.08em" }}>
          LIVE DATA
        </span>
        <span style={{ color: "#8b949e", fontSize: 11, marginLeft: 12 }}>
          Last updated {lastFetch.toLocaleTimeString()}
        </span>
        <button
          onClick={onRefresh}
          style={{
            marginLeft: "auto", cursor: "pointer",
            background: "transparent", border: "1px solid #00ff9d33",
            color: "#8b949e", padding: "3px 12px", borderRadius: 3,
            fontFamily: "inherit", fontSize: 11,
            transition: "all 0.15s",
          }}
          onMouseEnter={e => e.currentTarget.style.color = "#00ff9d"}
          onMouseLeave={e => e.currentTarget.style.color = "#8b949e"}
        >
          ↻ REFRESH
        </button>
      </div>
    );
  }

  return null;
}

// ── Helpers ────────────────────────────────────────────────
const banner = (bg, border) => ({
  display: "flex",
  alignItems: "center",
  padding: "7px 24px",
  background: bg,
  borderBottom: `1px solid ${border}`,
  gap: 8,
  minHeight: 36,
});

const code = {
  background: "#161b22",
  color: "#c9d1d9",
  padding: "1px 5px",
  borderRadius: 3,
  fontSize: 11,
  fontFamily: "inherit",
};
