// src/components/Screener.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Bloomberg-style stock screener
// • Filter by 12+ metrics with range sliders + dropdowns
// • Live prices merged from stockData prop
// • Sort by any column
// • Click any row → CompanyDeepDive
// • Export results to CSV
// • Preset screens: Deep Value, High Growth, Dividend, Low Vol, Quality
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useMemo, useCallback, useRef } from "react";
import { STOCK_UNIVERSE, CHART_COLORS } from "../data/stocks";
import { getValuationScore, getValuationLabel } from "../utils/finance";
import { Spinner, ValuationBadge } from "./UI";
import CompanyDeepDive from "./CompanyDeepDive";

// ── Formatters ────────────────────────────────────────────
const fmt$ = n => {
  if (n == null || isNaN(n)) return "—";
  if (Math.abs(n) >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (Math.abs(n) >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6)  return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
};
const fmtN = (n, d = 1) => (n == null || isNaN(n)) ? "—" : (+n).toFixed(d);

// ── Sectors derived from universe ─────────────────────────
const ALL_SECTORS = ["All", ...Array.from(new Set(STOCK_UNIVERSE.map(s => s.sector))).sort()];

// ── Filter definitions ────────────────────────────────────
const FILTERS = [
  { key: "pe",             label: "P/E Ratio",         min: 0,   max: 100, step: 1,   unit: "x",  decimals: 0 },
  { key: "pb",             label: "P/B Ratio",         min: 0,   max: 60,  step: 0.5, unit: "x",  decimals: 1 },
  { key: "evEbitda",       label: "EV/EBITDA",         min: 0,   max: 60,  step: 1,   unit: "x",  decimals: 0 },
  { key: "beta",           label: "Beta",              min: 0,   max: 2.5, step: 0.1, unit: "",   decimals: 1 },
  { key: "expectedReturn", label: "Exp. Return",       min: 0,   max: 25,  step: 0.5, unit: "%",  decimals: 1 },
  { key: "volatility",     label: "Volatility",        min: 0,   max: 60,  step: 1,   unit: "%",  decimals: 0 },
  { key: "dividend",       label: "Dividend Yield",    min: 0,   max: 8,   step: 0.1, unit: "%",  decimals: 1 },
];

// ── Default filter state (no filters active = show all) ───
const defaultFilters = () => ({
  sector:        "All",
  pe:            [0,   100],
  pb:            [0,   60],
  evEbitda:      [0,   60],
  beta:          [0,   2.5],
  expectedReturn:[0,   25],
  volatility:    [0,   60],
  dividend:      [0,   8],
  minScore:      0,
  search:        "",
});

// ── Preset screens ────────────────────────────────────────
const PRESETS = [
  {
    id: "deep_value",
    label: "💎 Deep Value",
    desc: "Low multiples, undervalued composite score",
    filters: { ...defaultFilters(), pe: [0, 18], pb: [0, 4], evEbitda: [0, 12], minScore: 60 },
  },
  {
    id: "high_growth",
    label: "🚀 High Growth",
    desc: "High expected return, willing to take vol",
    filters: { ...defaultFilters(), expectedReturn: [14, 25], volatility: [0, 60] },
  },
  {
    id: "dividend",
    label: "💰 Dividend Income",
    desc: "Yield > 2%, low beta defensive names",
    filters: { ...defaultFilters(), dividend: [2, 8], beta: [0, 1.2] },
  },
  {
    id: "low_vol",
    label: "🛡 Low Volatility",
    desc: "Defensive, low beta, low drawdown risk",
    filters: { ...defaultFilters(), volatility: [0, 20], beta: [0, 0.8] },
  },
  {
    id: "quality",
    label: "⭐ Quality",
    desc: "Strong return, moderate risk, fair value",
    filters: { ...defaultFilters(), expectedReturn: [10, 25], volatility: [0, 30], beta: [0, 1.3] },
  },
];

// ── Column definitions ────────────────────────────────────
const COLUMNS = [
  { key: "ticker",         label: "TICKER",      width: 80,  align: "left"  },
  { key: "name",           label: "COMPANY",     width: 190, align: "left"  },
  { key: "sector",         label: "SECTOR",      width: 130, align: "left"  },
  { key: "livePrice",      label: "PRICE",       width: 80,  align: "right" },
  { key: "liveChangePct",  label: "CHG%",        width: 75,  align: "right" },
  { key: "marketCap",      label: "MKT CAP",     width: 90,  align: "right" },
  { key: "_score",         label: "VAL SCORE",   width: 90,  align: "right" },
  { key: "pe",             label: "P/E",         width: 60,  align: "right" },
  { key: "pb",             label: "P/B",         width: 60,  align: "right" },
  { key: "evEbitda",       label: "EV/EBIT",     width: 75,  align: "right" },
  { key: "beta",           label: "BETA",        width: 58,  align: "right" },
  { key: "expectedReturn", label: "EXP RET%",    width: 80,  align: "right" },
  { key: "volatility",     label: "VOL%",        width: 58,  align: "right" },
  { key: "dividend",       label: "DIV%",        width: 60,  align: "right" },
];

// ─────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────

function RangeFilter({ def, value, onChange, active }) {
  const [lo, hi] = value;
  const pct = v => ((v - def.min) / (def.max - def.min)) * 100;

  return (
    <div style={{
      background: active ? "#00ff9d08" : "#0d1117",
      border: `1px solid ${active ? "#00ff9d33" : "#1c2333"}`,
      borderRadius: 6,
      padding: "10px 12px",
      transition: "all 0.15s",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ color: active ? "#00ff9d" : "#8b949e", fontSize: 10, letterSpacing: "0.08em", fontWeight: active ? 700 : 400 }}>
          {def.label}
        </span>
        <span style={{ color: "#c9d1d9", fontSize: 10, fontFamily: "monospace" }}>
          {lo.toFixed(def.decimals)}{def.unit} — {hi.toFixed(def.decimals)}{def.unit}
        </span>
      </div>

      {/* Dual range slider — rendered as two overlapping inputs */}
      <div style={{ position: "relative", height: 20, marginBottom: 4 }}>
        {/* Track fill */}
        <div style={{
          position: "absolute", top: "50%", transform: "translateY(-50%)",
          left: `${pct(lo)}%`, width: `${pct(hi) - pct(lo)}%`,
          height: 3, background: active ? "#00ff9d" : "#1c2333",
          borderRadius: 2, pointerEvents: "none", transition: "background 0.15s",
        }} />
        {/* Full track bg */}
        <div style={{
          position: "absolute", top: "50%", transform: "translateY(-50%)",
          left: 0, right: 0, height: 3, background: "#1c2333",
          borderRadius: 2, pointerEvents: "none", zIndex: 0,
        }} />
        <input
          type="range" min={def.min} max={def.max} step={def.step}
          value={lo}
          onChange={e => {
            const v = Math.min(+e.target.value, hi - def.step);
            onChange([v, hi]);
          }}
          style={{
            position: "absolute", width: "100%", top: 0, left: 0,
            height: "100%", opacity: 0, cursor: "pointer", zIndex: 2,
            WebkitAppearance: "none",
          }}
        />
        <input
          type="range" min={def.min} max={def.max} step={def.step}
          value={hi}
          onChange={e => {
            const v = Math.max(+e.target.value, lo + def.step);
            onChange([lo, v]);
          }}
          style={{
            position: "absolute", width: "100%", top: 0, left: 0,
            height: "100%", opacity: 0, cursor: "pointer", zIndex: 2,
            WebkitAppearance: "none",
          }}
        />
        {/* Visual thumbs */}
        <div style={{
          position: "absolute", top: "50%", transform: "translate(-50%, -50%)",
          left: `${pct(lo)}%`, width: 12, height: 12,
          background: active ? "#00ff9d" : "#8b949e",
          borderRadius: "50%", pointerEvents: "none",
          boxShadow: active ? "0 0 6px #00ff9d88" : "none",
          transition: "all 0.1s", zIndex: 1,
        }} />
        <div style={{
          position: "absolute", top: "50%", transform: "translate(-50%, -50%)",
          left: `${pct(hi)}%`, width: 12, height: 12,
          background: active ? "#00ff9d" : "#8b949e",
          borderRadius: "50%", pointerEvents: "none",
          boxShadow: active ? "0 0 6px #00ff9d88" : "none",
          transition: "all 0.1s", zIndex: 1,
        }} />
      </div>

      {/* Min/max labels */}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#8b949e44" }}>
        <span>{def.min}{def.unit}</span>
        <span>{def.max}{def.unit}</span>
      </div>

      {/* Reset button */}
      {active && (
        <button onClick={() => onChange([def.min, def.max])} style={{
          marginTop: 6, background: "none", border: "1px solid #00ff9d33",
          color: "#00ff9d", fontSize: 9, padding: "2px 8px", borderRadius: 3,
          cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.06em",
        }}>RESET</button>
      )}
    </div>
  );
}

function SortIcon({ col, sortCol, sortDir }) {
  if (sortCol !== col) return <span style={{ color: "#1c2333", marginLeft: 4 }}>⇅</span>;
  return <span style={{ color: "#00ff9d", marginLeft: 4 }}>{sortDir === "asc" ? "↑" : "↓"}</span>;
}

function ScoreBar({ score, color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ width: 42, height: 3, background: "#1c2333", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${score}%`, height: "100%", background: color, borderRadius: 2 }} />
      </div>
      <span style={{ color, fontFamily: "monospace", fontSize: 11, fontWeight: 600, minWidth: 22, textAlign: "right" }}>{score}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────
export default function Screener({ stockData, holdings, onAddToPortfolio }) {
  const [filters,      setFilters]      = useState(defaultFilters());
  const [sortCol,      setSortCol]      = useState("_score");
  const [sortDir,      setSortDir]      = useState("desc");
  const [expanded,     setExpanded]     = useState(null);
  const [activePreset, setActivePreset] = useState(null);
  const [showFilters,  setShowFilters]  = useState(true);

  const portfolioSet = new Set((holdings ?? []).map(h => h.ticker));

  // ── Merge live data into universe ──────────────────────
  const enriched = useMemo(() => {
    return STOCK_UNIVERSE.map(s => {
      const q     = stockData?.getQuote(s.ticker);
      const score = getValuationScore(s);
      return {
        ...s,
        livePrice:     q?.price     ?? null,
        liveChangePct: q?.changePct ?? null,
        livePositive:  q?.positive  ?? true,
        marketCap:     q?.marketCap ?? null,
        _score:        score,
        _vl:           getValuationLabel(score),
      };
    });
  // eslint-disable-next-line
  }, [stockData?.quotes]);

  // ── Apply filters ──────────────────────────────────────
  const results = useMemo(() => {
    const isActive = (key) => {
      const def = FILTERS.find(f => f.key === key);
      if (!def) return false;
      const [lo, hi] = filters[key];
      return lo > def.min || hi < def.max;
    };

    return enriched.filter(s => {
      // Search
      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (!s.ticker.toLowerCase().includes(q) && !s.name.toLowerCase().includes(q)) return false;
      }
      // Sector
      if (filters.sector !== "All" && s.sector !== filters.sector) return false;
      // Numeric ranges — skip nulls only if filter is active
      for (const def of FILTERS) {
        const [lo, hi] = filters[def.key];
        const val = s[def.key];
        if (val == null) {
          if (lo > def.min || hi < def.max) return false; // active filter, null = exclude
          continue;
        }
        if (val < lo || val > hi) return false;
      }
      // Min valuation score
      if (s._score < filters.minScore) return false;
      return true;
    });
  }, [enriched, filters]);

  // ── Sort ───────────────────────────────────────────────
  const sorted = useMemo(() => {
    return [...results].sort((a, b) => {
      const av = a[sortCol] ?? (sortDir === "asc" ? Infinity : -Infinity);
      const bv = b[sortCol] ?? (sortDir === "asc" ? Infinity : -Infinity);
      if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [results, sortCol, sortDir]);

  // ── Handlers ───────────────────────────────────────────
  const handleSort = useCallback(col => {
    setSortCol(prev => {
      if (prev === col) { setSortDir(d => d === "asc" ? "desc" : "asc"); return col; }
      setSortDir(col === "ticker" || col === "name" || col === "sector" ? "asc" : "desc");
      return col;
    });
  }, []);

  const applyPreset = useCallback(preset => {
    setFilters(preset.filters);
    setActivePreset(preset.id);
  }, []);

  const resetAll = useCallback(() => {
    setFilters(defaultFilters());
    setActivePreset(null);
  }, []);

  const updateFilter = useCallback((key, val) => {
    setFilters(prev => ({ ...prev, [key]: val }));
    setActivePreset(null);
  }, []);

  // ── CSV export ─────────────────────────────────────────
  const exportCSV = useCallback(() => {
    const headers = COLUMNS.map(c => c.label).join(",");
    const rows = sorted.map(s =>
      COLUMNS.map(c => {
        const v = s[c.key];
        if (v == null) return "—";
        if (c.key === "livePrice")     return `$${v}`;
        if (c.key === "liveChangePct") return `${v > 0 ? "+" : ""}${v?.toFixed(2)}%`;
        if (c.key === "marketCap")     return fmt$(v);
        if (c.key === "_score")        return v;
        return v;
      }).join(",")
    );
    const csv = [headers, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `screener_${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }, [sorted]);

  // ── Active filter count ────────────────────────────────
  const activeCount = useMemo(() => {
    let n = 0;
    if (filters.sector !== "All") n++;
    if (filters.search)           n++;
    if (filters.minScore > 0)     n++;
    for (const def of FILTERS) {
      const [lo, hi] = filters[def.key];
      if (lo > def.min || hi < def.max) n++;
    }
    return n;
  }, [filters]);

  // ── Cell renderer ──────────────────────────────────────
  const renderCell = (col, stock) => {
    const v = stock[col.key];
    switch (col.key) {
      case "ticker":
        return (
          <span style={{
            color: "#00ff9d", fontWeight: 700, fontSize: 12,
            background: "#00ff9d12", border: "1px solid #00ff9d33",
            padding: "1px 7px", borderRadius: 3, letterSpacing: "0.04em",
          }}>{v}</span>
        );
      case "name":
        return (
          <span style={{ color: "#c9d1d9", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 185, display: "block" }}>
            {v}
          </span>
        );
      case "sector":
        return <span style={{ color: "#8b949e", fontSize: 10, letterSpacing: "0.04em" }}>{v}</span>;
      case "livePrice":
        return v
          ? <span style={{ color: "#fff", fontFamily: "monospace", fontWeight: 600 }}>${v}</span>
          : <span style={{ color: "#8b949e33" }}><Spinner /></span>;
      case "liveChangePct":
        return v != null
          ? <span style={{ color: stock.livePositive ? "#00ff9d" : "#ff6b35", fontFamily: "monospace", fontWeight: 600, fontSize: 11 }}>
              {stock.livePositive ? "+" : ""}{v?.toFixed(2)}%
            </span>
          : <span style={{ color: "#8b949e33" }}>—</span>;
      case "marketCap":
        return <span style={{ color: "#8b949e", fontFamily: "monospace", fontSize: 11 }}>{fmt$(v)}</span>;
      case "_score": {
        const { color } = stock._vl;
        return <ScoreBar score={v} color={color} />;
      }
      case "pe":
      case "pb":
      case "evEbitda": {
        const thresh = col.key === "pe" ? 30 : col.key === "pb" ? 5 : 18;
        const color  = v == null ? "#8b949e" : v > thresh ? "#ff6b35" : v < thresh * 0.6 ? "#00ff9d" : "#ffd700";
        return <span style={{ color, fontFamily: "monospace", fontSize: 11 }}>{fmtN(v, 1)}</span>;
      }
      case "beta":
        return <span style={{ color: v != null && v < 0.8 ? "#00ff9d" : v > 1.3 ? "#ff6b35" : "#c9d1d9", fontFamily: "monospace", fontSize: 11 }}>{fmtN(v, 2)}</span>;
      case "expectedReturn":
        return <span style={{ color: v >= 14 ? "#00ff9d" : v >= 10 ? "#ffd700" : "#ff6b35", fontFamily: "monospace", fontSize: 11 }}>{fmtN(v, 1)}%</span>;
      case "volatility":
        return <span style={{ color: v <= 18 ? "#00ff9d" : v <= 30 ? "#ffd700" : "#ff6b35", fontFamily: "monospace", fontSize: 11 }}>{fmtN(v, 0)}%</span>;
      case "dividend":
        return <span style={{ color: v >= 3 ? "#c084fc" : v >= 1 ? "#ffd700" : "#8b949e", fontFamily: "monospace", fontSize: 11 }}>{fmtN(v, 1)}%</span>;
      default:
        return <span style={{ color: "#8b949e", fontFamily: "monospace", fontSize: 11 }}>{v ?? "—"}</span>;
    }
  };

  return (
    <div style={{ fontFamily: "'IBM Plex Mono', monospace" }}>

      {/* ── Top bar ─────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "#8b949e", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase" }}>
            Stock Screener
          </span>
          <span style={{
            background: results.length < STOCK_UNIVERSE.length ? "#00ff9d18" : "#1c2333",
            color: results.length < STOCK_UNIVERSE.length ? "#00ff9d" : "#8b949e",
            fontSize: 10, padding: "2px 8px", borderRadius: 3, fontWeight: 600,
          }}>
            {results.length} / {STOCK_UNIVERSE.length} RESULTS
          </span>
          {activeCount > 0 && (
            <span style={{ background: "#ffd70018", color: "#ffd700", fontSize: 10, padding: "2px 8px", borderRadius: 3, fontWeight: 600 }}>
              {activeCount} FILTER{activeCount !== 1 ? "S" : ""} ACTIVE
            </span>
          )}
        </div>

        <div style={{ flex: 1 }} />

        {/* Search */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#0d1117", border: "1px solid #1c2333", borderRadius: 6, padding: "6px 12px", width: 220 }}>
          <span style={{ color: "#8b949e" }}>⌕</span>
          <input
            style={{ border: "none", background: "transparent", flex: 1, fontSize: 12, outline: "none", color: "#c9d1d9", fontFamily: "inherit" }}
            placeholder="Search ticker or name…"
            value={filters.search}
            onChange={e => updateFilter("search", e.target.value)}
          />
          {filters.search && (
            <span style={{ color: "#8b949e", cursor: "pointer" }} onClick={() => updateFilter("search", "")}>×</span>
          )}
        </div>

        <button onClick={() => setShowFilters(p => !p)} style={{
          background: showFilters ? "#00ff9d15" : "#0d1117",
          border: `1px solid ${showFilters ? "#00ff9d44" : "#1c2333"}`,
          color: showFilters ? "#00ff9d" : "#8b949e",
          padding: "6px 14px", borderRadius: 6, cursor: "pointer",
          fontFamily: "inherit", fontSize: 11, letterSpacing: "0.06em",
        }}>
          {showFilters ? "▲ HIDE FILTERS" : "▼ SHOW FILTERS"}
        </button>

        {activeCount > 0 && (
          <button onClick={resetAll} style={{
            background: "none", border: "1px solid #ff6b3533", color: "#ff6b35",
            padding: "6px 12px", borderRadius: 6, cursor: "pointer",
            fontFamily: "inherit", fontSize: 11,
          }}>RESET ALL</button>
        )}

        <button onClick={exportCSV} style={{
          background: "#0d1117", border: "1px solid #1c2333", color: "#8b949e",
          padding: "6px 12px", borderRadius: 6, cursor: "pointer",
          fontFamily: "inherit", fontSize: 11,
        }}>↓ CSV</button>
      </div>

      {/* ── Preset screens ───────────────────────────────── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <span style={{ color: "#8b949e44", fontSize: 10, alignSelf: "center", marginRight: 4, letterSpacing: "0.08em" }}>PRESETS</span>
        {PRESETS.map(p => (
          <button key={p.id} onClick={() => applyPreset(p)} title={p.desc} style={{
            background: activePreset === p.id ? "#00ff9d18" : "#0d1117",
            border: `1px solid ${activePreset === p.id ? "#00ff9d44" : "#1c2333"}`,
            color: activePreset === p.id ? "#00ff9d" : "#c9d1d9",
            padding: "5px 14px", borderRadius: 4, cursor: "pointer",
            fontFamily: "inherit", fontSize: 11, transition: "all 0.15s",
            whiteSpace: "nowrap",
          }}
            onMouseEnter={e => { if (activePreset !== p.id) e.currentTarget.style.borderColor = "#00ff9d44"; }}
            onMouseLeave={e => { if (activePreset !== p.id) e.currentTarget.style.borderColor = "#1c2333"; }}
          >{p.label}</button>
        ))}
      </div>

      {/* ── Filter panel ─────────────────────────────────── */}
      {showFilters && (
        <div style={{
          background: "#080c12", border: "1px solid #1c2333", borderRadius: 8,
          padding: "16px 18px", marginBottom: 18,
          animation: "fadeIn 0.2s ease",
        }}>
          {/* Sector + Score row */}
          <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ minWidth: 180 }}>
              <div style={{ color: "#8b949e", fontSize: 10, letterSpacing: "0.08em", marginBottom: 6 }}>SECTOR</div>
              <select
                value={filters.sector}
                onChange={e => updateFilter("sector", e.target.value)}
                style={{
                  background: filters.sector !== "All" ? "#00ff9d12" : "#0d1117",
                  border: `1px solid ${filters.sector !== "All" ? "#00ff9d44" : "#1c2333"}`,
                  color: "#c9d1d9", padding: "6px 10px", borderRadius: 4,
                  fontFamily: "inherit", fontSize: 11, cursor: "pointer", width: "100%",
                }}
              >
                {ALL_SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div style={{ minWidth: 220 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ color: filters.minScore > 0 ? "#00ff9d" : "#8b949e", fontSize: 10, letterSpacing: "0.08em", fontWeight: filters.minScore > 0 ? 700 : 400 }}>
                  MIN VALUATION SCORE
                </span>
                <span style={{ color: "#c9d1d9", fontSize: 10, fontFamily: "monospace" }}>{filters.minScore}+</span>
              </div>
              <input
                type="range" min={0} max={80} step={5} value={filters.minScore}
                onChange={e => updateFilter("minScore", +e.target.value)}
                style={{ width: "100%" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#8b949e44", marginTop: 2 }}>
                <span>0 (all)</span>
                <span style={{ color: "#00ff9d44" }}>60+ = undervalued</span>
                <span>80</span>
              </div>
            </div>
          </div>

          {/* Metric range filters */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
            {FILTERS.map(def => {
              const [lo, hi] = filters[def.key];
              const active   = lo > def.min || hi < def.max;
              return (
                <RangeFilter
                  key={def.key}
                  def={def}
                  value={filters[def.key]}
                  onChange={v => updateFilter(def.key, v)}
                  active={active}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* ── Results summary bar ───────────────────────────── */}
      {results.length > 0 && (
        <div style={{
          display: "flex", gap: 20, padding: "8px 16px",
          background: "#0d1117", border: "1px solid #1c2333",
          borderRadius: 6, marginBottom: 12, flexWrap: "wrap", alignItems: "center",
        }}>
          {[
            { label: "UNDERVALUED", count: results.filter(s => s._score >= 65).length, color: "#00ff9d" },
            { label: "FAIR VALUE",  count: results.filter(s => s._score >= 40 && s._score < 65).length, color: "#ffd700" },
            { label: "OVERVALUED",  count: results.filter(s => s._score < 40).length,  color: "#ff6b35" },
          ].map(({ label, count, color }) => (
            <div key={label}>
              <span style={{ color: "#8b949e", fontSize: 10 }}>{label} </span>
              <span style={{ color, fontWeight: 700 }}>{count}</span>
            </div>
          ))}
          <div style={{ flex: 1, height: 3, borderRadius: 2, overflow: "hidden", display: "flex", minWidth: 80 }}>
            {[
              { val: results.filter(s => s._score >= 65).length, c: "#00ff9d" },
              { val: results.filter(s => s._score >= 40 && s._score < 65).length, c: "#ffd700" },
              { val: results.filter(s => s._score < 40).length, c: "#ff6b35" },
            ].map(({ val, c }) => (
              <div key={c} style={{ width: `${(val / results.length) * 100}%`, background: c, transition: "width 0.4s" }} />
            ))}
          </div>
          <span style={{ color: "#8b949e44", fontSize: 10, marginLeft: "auto" }}>
            avg P/E {fmtN(results.reduce((s, r) => s + (r.pe ?? 0), 0) / results.filter(r => r.pe).length, 1)}x ·
            avg div {fmtN(results.reduce((s, r) => s + (r.dividend ?? 0), 0) / results.length, 1)}% ·
            avg β {fmtN(results.reduce((s, r) => s + (r.beta ?? 0), 0) / results.length, 2)}
          </span>
        </div>
      )}

      {/* ── Results table ─────────────────────────────────── */}
      <div style={{ background: "#060a0f", border: "1px solid #1c2333", borderRadius: 8, overflow: "hidden" }}>

        {/* Table header */}
        <div style={{
          display: "flex", alignItems: "center",
          padding: "8px 16px",
          background: "#080c12",
          borderBottom: "1px solid #1c2333",
          position: "sticky", top: 0, zIndex: 10,
          gap: 0,
          overflowX: "auto",
        }}>
          {COLUMNS.map(col => (
            <div
              key={col.key}
              onClick={() => handleSort(col.key)}
              style={{
                minWidth: col.width, width: col.width,
                textAlign: col.align, cursor: "pointer",
                color: sortCol === col.key ? "#00ff9d" : "#8b949e",
                fontSize: 9, letterSpacing: "0.1em", fontWeight: 700,
                padding: "0 6px", userSelect: "none",
                transition: "color 0.1s",
                flexShrink: 0,
              }}
              onMouseEnter={e => { if (sortCol !== col.key) e.currentTarget.style.color = "#c9d1d9"; }}
              onMouseLeave={e => { if (sortCol !== col.key) e.currentTarget.style.color = "#8b949e"; }}
            >
              {col.label}<SortIcon col={col.key} sortCol={sortCol} sortDir={sortDir} />
            </div>
          ))}
          <div style={{ minWidth: 90, flexShrink: 0 }} /> {/* Actions column */}
        </div>

        {/* Rows */}
        {sorted.length === 0 ? (
          <div style={{ padding: "60px 0", textAlign: "center", color: "#8b949e" }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🔍</div>
            <div style={{ fontSize: 13, marginBottom: 6 }}>No stocks match your current filters</div>
            <button onClick={resetAll} style={{
              background: "#00ff9d15", border: "1px solid #00ff9d44", color: "#00ff9d",
              padding: "6px 18px", borderRadius: 4, cursor: "pointer",
              fontFamily: "inherit", fontSize: 11,
            }}>CLEAR FILTERS</button>
          </div>
        ) : (
          sorted.map((stock, idx) => (
            <div key={stock.ticker}>
              {/* Main row */}
              <div
                onClick={() => setExpanded(p => p === stock.ticker ? null : stock.ticker)}
                style={{
                  display: "flex", alignItems: "center",
                  padding: "10px 16px",
                  borderBottom: "1px solid #1c233322",
                  cursor: "pointer",
                  background: expanded === stock.ticker ? "#00ff9d06"
                    : idx % 2 === 0 ? "transparent" : "#0d111744",
                  borderLeft: `3px solid ${expanded === stock.ticker ? "#00ff9d" : "transparent"}`,
                  transition: "all 0.1s",
                  gap: 0,
                  overflowX: "auto",
                }}
                onMouseEnter={e => { if (expanded !== stock.ticker) e.currentTarget.style.background = "#ffffff04"; }}
                onMouseLeave={e => { if (expanded !== stock.ticker) e.currentTarget.style.background = idx % 2 === 0 ? "transparent" : "#0d111744"; }}
              >
                {COLUMNS.map(col => (
                  <div key={col.key} style={{
                    minWidth: col.width, width: col.width,
                    textAlign: col.align, padding: "0 6px",
                    flexShrink: 0, overflow: "hidden",
                  }}>
                    {renderCell(col, stock)}
                  </div>
                ))}

                {/* Action buttons */}
                <div style={{ minWidth: 90, flexShrink: 0, display: "flex", gap: 6, justifyContent: "flex-end", padding: "0 0 0 6px" }}>
                  {onAddToPortfolio && (
                    <button
                      disabled={portfolioSet.has(stock.ticker)}
                      onClick={e => { e.stopPropagation(); onAddToPortfolio(stock); }}
                      style={{
                        background: portfolioSet.has(stock.ticker) ? "#1c2333" : "#00ff9d18",
                        border: `1px solid ${portfolioSet.has(stock.ticker) ? "#1c2333" : "#00ff9d44"}`,
                        color: portfolioSet.has(stock.ticker) ? "#8b949e44" : "#00ff9d",
                        padding: "3px 8px", borderRadius: 3,
                        cursor: portfolioSet.has(stock.ticker) ? "default" : "pointer",
                        fontFamily: "inherit", fontSize: 9, letterSpacing: "0.04em",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {portfolioSet.has(stock.ticker) ? "✓ IN PTF" : "+ ADD"}
                    </button>
                  )}
                  <span style={{ color: "#8b949e44", fontSize: 12, alignSelf: "center" }}>
                    {expanded === stock.ticker ? "▲" : "▼"}
                  </span>
                </div>
              </div>

              {/* Expanded deep dive */}
              {expanded === stock.ticker && (
                <div style={{ borderBottom: "1px solid #1c2333" }}>
                  <CompanyDeepDive
                    ticker={stock.ticker}
                    quote={stockData?.getQuote(stock.ticker) ?? null}
                    onClose={() => setExpanded(null)}
                  />
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {sorted.length > 0 && (
        <p style={{ color: "#8b949e33", fontSize: 10, marginTop: 12 }}>
          {sorted.length} results · Click any row to expand full company deep dive ·
          Live prices via Yahoo Finance · Fundamentals updated periodically · Not financial advice
        </p>
      )}
    </div>
  );
}
