// src/components/ValuationScreen.jsx
import { useState, useMemo, useEffect } from "react";
import { STOCK_UNIVERSE } from "../data/stocks";
import { getValuationScore, getValuationLabel } from "../utils/finance";
import { SectionLabel, ValuationBadge, WeightBar, Spinner } from "./UI";
import CandleChart from "./CandleChart";
import { fetchStockNews } from "../hooks/useStockData";

const fmtMoney = n => {
  if (n == null) return "—";
  if (n >= 1e12) return `$${(n/1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n/1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `$${(n/1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
};
const fmtVol = n => {
  if (n == null) return "—";
  if (n >= 1e9) return `${(n/1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n/1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n/1e3).toFixed(0)}K`;
  return String(n);
};

// ── Expanded detail (chart + news) ────────────────────────
function ExpandedDetail({ stock, quote, onClose }) {
  const [news,  setNews]  = useState([]);
  const [nLoad, setNLoad] = useState(true);
  const c = quote?.positive ? "#00ff9d" : "#ff6b35";

  useEffect(() => {
    fetchStockNews(stock.ticker)
      .then(n => { setNews(n); setNLoad(false); })
      .catch(() => setNLoad(false));
  }, [stock.ticker]);

  return (
    <div style={{ borderTop: "1px solid #1c2333", marginTop: 14, paddingTop: 14 }}>

      {/* Live price strip */}
      {quote && (
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14, flexWrap: "wrap" }}>
          <span style={{ color: "#fff", fontSize: 22, fontWeight: 800 }}>${quote.price}</span>
          <span style={{
            color: c, fontSize: 13, fontWeight: 600,
            background: quote.positive ? "#00ff9d15" : "#ff6b3515",
            padding: "2px 10px", borderRadius: 3,
          }}>
            {quote.positive ? "+" : ""}{quote.change} ({quote.positive ? "+" : ""}{quote.changePct?.toFixed(2)}%)
          </span>
          {quote.dayHigh && <span style={{ color: "#8b949e", fontSize: 11 }}>Day <b style={{ color: "#c9d1d9" }}>${quote.dayLow?.toFixed(2)}–${quote.dayHigh?.toFixed(2)}</b></span>}
          {quote.high52  && <span style={{ color: "#8b949e", fontSize: 11 }}>52W <b style={{ color: "#c9d1d9" }}>${quote.low52?.toFixed(2)}–${quote.high52?.toFixed(2)}</b></span>}
          <span style={{ color: "#8b949e", fontSize: 11 }}>Vol <b style={{ color: "#c9d1d9" }}>{fmtVol(quote.volume)}</b></span>
          <span style={{ color: "#8b949e", fontSize: 11 }}>Cap <b style={{ color: "#c9d1d9" }}>{fmtMoney(quote.marketCap)}</b></span>
        </div>
      )}

      {/* Proper candlestick chart with zoom/pan */}
      <div style={{ background: "#0d1117", border: "1px solid #1c2333", borderRadius: 6, padding: "12px 14px", marginBottom: 14 }}>
        <div style={{ color: "#8b949e", fontSize: 10, letterSpacing: "0.08em", marginBottom: 8 }}>
          PRICE CHART — {stock.ticker}
        </div>
        <CandleChart ticker={stock.ticker} height={200} volumeHeight={36} />
      </div>

      {/* News */}
      <div style={{ color: "#8b949e", fontSize: 10, letterSpacing: "0.1em", marginBottom: 8 }}>LATEST NEWS</div>
      {nLoad && <div style={{ display: "flex", gap: 8, alignItems: "center" }}><Spinner /><span style={{ color: "#8b949e", fontSize: 11 }}>Loading…</span></div>}
      {news.map((n, i) => (
        <a key={i} href={n.url} target="_blank" rel="noreferrer" style={{ textDecoration: "none", display: "block" }}>
          <div style={{ padding: "6px 0", borderBottom: "1px solid #1c233333", transition: "opacity 0.15s" }}
            onMouseEnter={e => e.currentTarget.style.opacity = "0.7"}
            onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
            <div style={{ color: "#c9d1d9", fontSize: 12, marginBottom: 2 }}>{n.title}</div>
            <div style={{ display: "flex", gap: 10, fontSize: 10 }}>
              <span style={{ color: "#00ff9d77" }}>{n.source}</span>
              <span style={{ color: "#8b949e44" }}>{n.time}</span>
            </div>
          </div>
        </a>
      ))}
      {!nLoad && news.length === 0 && <p style={{ color: "#8b949e44", fontSize: 11 }}>No recent news.</p>}

      <button onClick={onClose} style={{ marginTop: 12, background: "none", border: "1px solid #1c2333", color: "#8b949e", padding: "4px 14px", borderRadius: 4, cursor: "pointer", fontSize: 11 }}>
        ▲ Collapse
      </button>
    </div>
  );
}

// ── Stock card ─────────────────────────────────────────────
function StockCard({ stock, inPortfolio, quote, expanded, onToggle }) {
  const score = getValuationScore(stock);
  const vl    = getValuationLabel(score);
  const c     = quote?.positive ? "#00ff9d" : "#ff6b35";

  return (
    <div
      className="stat-card"
      onClick={onToggle}
      style={{
        borderColor: expanded ? vl.color + "55" : inPortfolio ? "#00ff9d33" : "#1c2333",
        position: "relative", cursor: "pointer", transition: "all 0.15s",
      }}
      onMouseEnter={e => { if (!expanded) e.currentTarget.style.background = "#ffffff04"; }}
      onMouseLeave={e => { e.currentTarget.style.background = ""; }}
    >
      {/* Portfolio badge */}
      {inPortfolio && (
        <span style={{ position: "absolute", top: 10, right: 10, fontSize: 9, color: "#00ff9d", letterSpacing: "0.08em", background: "#00ff9d12", border: "1px solid #00ff9d33", padding: "1px 6px", borderRadius: 3 }}>
          IN PORTFOLIO
        </span>
      )}

      {/* Header row */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
        <span className="ticker-tag" style={{ fontSize: 13, padding: "3px 10px", flexShrink: 0 }}>{stock.ticker}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: "#c9d1d9", fontSize: 12 }}>{stock.name}</div>
          <div style={{ color: "#8b949e", fontSize: 11 }}>{stock.sector}</div>
        </div>
        {/* Live price */}
        {quote ? (
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ color: "#fff", fontSize: 15, fontWeight: 700 }}>${quote.price}</div>
            <div style={{ color: c, fontSize: 11, fontWeight: 600 }}>
              {quote.positive ? "+" : ""}{quote.changePct?.toFixed(2)}%
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Spinner />
            <span style={{ color: "#8b949e44", fontSize: 10 }}>loading</span>
          </div>
        )}
      </div>

      {/* Valuation score */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
          <span style={{ color: "#8b949e", fontSize: 11 }}>VALUATION SCORE</span>
          <span style={{ color: vl.color, fontSize: 13, fontWeight: 600 }}>{score} / 100</span>
        </div>
        <WeightBar value={score} color={vl.color} />
        <div style={{ textAlign: "right", marginTop: 4 }}>
          <ValuationBadge label={vl.label} color={vl.color} />
        </div>
      </div>

      {/* Multiples */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
        {[
          { label: "P/E",     val: stock.pe,       thresh: 30 },
          { label: "P/B",     val: stock.pb,       thresh: 5  },
          { label: "EV/EBIT", val: stock.evEbitda, thresh: 18 },
        ].map(({ label, val, thresh }) => (
          <div key={label} style={{ background: "#161b22", borderRadius: 4, padding: "7px 8px", textAlign: "center" }}>
            <div style={{ color: "#8b949e", fontSize: 10, marginBottom: 4 }}>{label}</div>
            <div style={{ color: val > thresh ? "#ff6b35" : "#00ff9d", fontWeight: 600, fontSize: 13 }}>{val ?? "—"}</div>
          </div>
        ))}
      </div>

      {/* Footer stats */}
      <div style={{ display: "flex", justifyContent: "space-between", color: "#8b949e", fontSize: 11, borderTop: "1px solid #1c2333", paddingTop: 10 }}>
        <span>β <span style={{ color: "#c9d1d9" }}>{stock.beta}</span></span>
        <span>Ret <span style={{ color: "#00ff9d" }}>{stock.expectedReturn}%</span></span>
        <span>Vol <span style={{ color: "#ffd700" }}>{stock.volatility}%</span></span>
        <span>Div <span style={{ color: "#c084fc" }}>{stock.dividend}%</span></span>
      </div>

      {/* Expand hint */}
      <div style={{ textAlign: "center", color: "#8b949e44", fontSize: 10, marginTop: 8 }}>
        {expanded ? "▲ click to collapse" : "▼ click for chart & news"}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <ExpandedDetail
          stock={stock}
          quote={quote}
          onClose={e => { e.stopPropagation(); onToggle(); }}
        />
      )}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────
export default function ValuationScreen({ holdings, stockData }) {
  const [view,     setView]     = useState("all");
  const [search,   setSearch]   = useState("");
  const [sortBy,   setSortBy]   = useState("score");
  const [expanded, setExpanded] = useState(null);

  const inPortfolioSet = new Set(holdings.map(h => h.ticker));

  const stocks = useMemo(() => {
    const base = view === "portfolio"
      ? STOCK_UNIVERSE.filter(s => inPortfolioSet.has(s.ticker))
      : STOCK_UNIVERSE;

    return base
      .filter(s => {
        if (!search) return true;
        const q = search.toLowerCase();
        return s.ticker.toLowerCase().includes(q) || s.name.toLowerCase().includes(q);
      })
      .map(s => ({ ...s, _quote: stockData?.getQuote(s.ticker) ?? null, _score: getValuationScore(s) }))
      .sort((a, b) => {
        if (sortBy === "score")  return b._score - a._score;
        if (sortBy === "pe")     return (a.pe ?? 999) - (b.pe ?? 999);
        if (sortBy === "price")  return (b._quote?.price ?? 0) - (a._quote?.price ?? 0);
        if (sortBy === "change") return (b._quote?.changePct ?? 0) - (a._quote?.changePct ?? 0);
        return 0;
      });
  // eslint-disable-next-line
  }, [view, search, sortBy, holdings, stockData?.quotes]);

  const undervalued = stocks.filter(s => s._score >= 60).length;
  const overvalued  = stocks.filter(s => s._score <  40).length;

  return (
    <div>
      {/* Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <SectionLabel>Valuation Screen</SectionLabel>

        {/* View toggle */}
        <div style={{ display: "flex", background: "#0d1117", border: "1px solid #1c2333", borderRadius: 6, overflow: "hidden" }}>
          {[["all", "ALL SECURITIES"], ["portfolio", "MY PORTFOLIO"]].map(([v, label]) => (
            <button key={v} onClick={() => setView(v)} style={{
              background:    view === v ? "#00ff9d15" : "transparent",
              color:         view === v ? "#00ff9d"   : "#8b949e",
              border:        "none", borderRight: "1px solid #1c2333",
              padding:       "6px 14px", cursor: "pointer",
              fontSize:      11, fontFamily: "inherit", letterSpacing: "0.06em",
            }}>{label}</button>
          ))}
        </div>

        {/* Search */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#0d1117", border: "1px solid #1c2333", borderRadius: 6, padding: "6px 12px", flex: 1, maxWidth: 260 }}>
          <span style={{ color: "#8b949e" }}>⌕</span>
          <input className="input-dark"
            style={{ border: "none", background: "transparent", flex: 1, fontSize: 12, outline: "none", padding: 0 }}
            placeholder="Filter by ticker or name…"
            value={search} onChange={e => setSearch(e.target.value)} />
          {search && <span style={{ color: "#8b949e", cursor: "pointer" }} onClick={() => setSearch("")}>×</span>}
        </div>

        {/* Sort */}
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}
          style={{ background: "#0d1117", border: "1px solid #1c2333", color: "#c9d1d9", padding: "6px 10px", borderRadius: 6, fontSize: 11, fontFamily: "inherit", cursor: "pointer" }}>
          <option value="score">Sort: Value Score</option>
          <option value="pe">Sort: P/E (low→high)</option>
          <option value="change">Sort: Today's Change</option>
          <option value="price">Sort: Price</option>
        </select>
      </div>

      {/* Summary bar */}
      <div style={{ display: "flex", gap: 20, padding: "10px 18px", background: "#0d1117", border: "1px solid #1c2333", borderRadius: 6, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <div><span style={{ color: "#8b949e", fontSize: 10 }}>SHOWING </span><span style={{ color: "#fff", fontWeight: 700 }}>{stocks.length}</span></div>
        <div><span style={{ color: "#8b949e", fontSize: 10 }}>UNDERVALUED </span><span style={{ color: "#00ff9d", fontWeight: 700 }}>{undervalued}</span></div>
        <div><span style={{ color: "#8b949e", fontSize: 10 }}>OVERVALUED </span><span style={{ color: "#ff6b35", fontWeight: 700 }}>{overvalued}</span></div>
        <div style={{ flex: 1, height: 4, borderRadius: 2, overflow: "hidden", display: "flex", minWidth: 100 }}>
          <div style={{ width: `${stocks.length ? (undervalued/stocks.length)*100 : 0}%`, background: "#00ff9d", transition: "width 0.4s" }} />
          <div style={{ width: `${stocks.length ? (overvalued /stocks.length)*100 : 0}%`, background: "#ff6b35", transition: "width 0.4s" }} />
        </div>
        {[["UNDERVALUED","#00ff9d"],["FAIR VALUE","#ffd700"],["OVERVALUED","#ff6b35"]].map(([label, color]) => (
          <span key={label} style={{ display: "flex", alignItems: "center", gap: 5, color: "#8b949e", fontSize: 11 }}>
            <span style={{ width: 8, height: 8, background: color, borderRadius: 2, display: "inline-block" }} />{label}
          </span>
        ))}
      </div>

      {/* Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
        {stocks.map(stock => (
          <StockCard key={stock.ticker} stock={stock}
            quote={stock._quote}
            inPortfolio={inPortfolioSet.has(stock.ticker)}
            expanded={expanded === stock.ticker}
            onToggle={() => setExpanded(p => p === stock.ticker ? null : stock.ticker)}
          />
        ))}
      </div>

      {stocks.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#8b949e" }}>
          <p style={{ fontSize: 20, marginBottom: 8 }}>🔍</p>
          <p>No securities match your filter.</p>
        </div>
      )}

      <p style={{ color: "#8b949e33", fontSize: 10, marginTop: 20 }}>
        Scores: P/E · P/B · EV/EBITDA · Click any card for chart & news · Scroll to zoom · Drag to pan
      </p>
    </div>
  );
}
