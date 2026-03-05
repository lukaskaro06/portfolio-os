// src/components/MarketWatch.jsx
import { useState, useEffect, useCallback, useRef } from "react";
import { SectionLabel, Spinner } from "./UI";
import {
  ComposedChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, AreaChart, Area, Cell,
} from "recharts";
import { fetchCandles, fetchStockNews, searchTicker, resolveIntervalRange } from "../hooks/useStockData";

// ── Formatters ─────────────────────────────────────────────
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

// ── Range config ───────────────────────────────────────────
// Groups: Intraday | Short-term | Long-term
const RANGE_GROUPS = [
  {
    label: "INTRADAY",
    color: "#00c8ff",
    ranges: [
      { key: "1d-1m",  label: "1m",  desc: "Today · 1-min candles"  },
      { key: "1d",     label: "5m",  desc: "Today · 5-min candles"  },
      { key: "5d",     label: "5m·5d", desc: "5 days · 5-min candles" },
      { key: "5d-15m", label: "15m", desc: "5 days · 15-min candles" },
      { key: "1mo-1h", label: "1h",  desc: "1 month · 1-hr candles" },
    ],
  },
  {
    label: "DAILY",
    color: "#00ff9d",
    ranges: [
      { key: "1mo", label: "1M",  desc: "1 month · daily"  },
      { key: "3mo", label: "3M",  desc: "3 months · daily" },
      { key: "6mo", label: "6M",  desc: "6 months · daily" },
    ],
  },
  {
    label: "WEEKLY",
    color: "#ffd700",
    ranges: [
      { key: "1y", label: "1Y", desc: "1 year · weekly"  },
      { key: "2y", label: "2Y", desc: "2 years · weekly" },
      { key: "5y", label: "5Y", desc: "5 years · monthly"},
    ],
  },
];

// Flat list for easy lookup
const ALL_RANGES = RANGE_GROUPS.flatMap(g => g.ranges.map(r => ({ ...r, groupColor: g.color })));

// ── Candlestick Chart ──────────────────────────────────────
function CandleChart({ ticker, color = "#00ff9d" }) {
  const [candles,  setCandles]  = useState([]);
  const [range,    setRange]    = useState("1d");   // default: today 5m
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const [tooltip,  setTooltip]  = useState(null);

  const loadRange = useCallback(async (r) => {
    setRange(r); setLoading(true); setError(null);
    try   { setCandles(await fetchCandles(ticker, r)); }
    catch (e) { setError(e.message); setCandles([]); }
    finally { setLoading(false); }
  }, [ticker]);

  useEffect(() => { loadRange("1d"); }, [loadRange]);

  // Build stacked-bar data for candlestick rendering
  const data = candles.map(d => {
    const lo   = Math.min(d.open ?? d.close, d.close);
    const hi   = Math.max(d.open ?? d.close, d.close);
    return {
      ...d,
      isUp:       d.close >= (d.open ?? d.close),
      _base:      d.low,
      _lowerWick: lo - (d.low ?? lo),
      _body:      Math.max(hi - lo, 0.01),
      _upperWick: (d.high ?? hi) - hi,
    };
  });

  const wickShape = props => {
    const { x, width, y, height, payload } = props;
    if (!payload || height <= 0) return null;
    const mid = x + width / 2;
    return <line x1={mid} y1={y} x2={mid} y2={y + height} stroke={payload.isUp ? "#00ff9d" : "#ff6b35"} strokeWidth={1.5} />;
  };

  const bodyShape = props => {
    const { x, width, y, height, payload } = props;
    if (!payload) return null;
    const c = payload.isUp ? "#00ff9d" : "#ff6b35";
    return (
      <rect
        x={x + width * 0.12} y={y}
        width={Math.max(width * 0.76, 2)} height={Math.max(height, 1)}
        fill={c} opacity={0.88} stroke={c} strokeWidth={0.5}
      />
    );
  };

  const customTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    if (!d) return null;
    const chg = d.open != null ? d.close - d.open : null;
    const chgPct = d.open ? ((chg / d.open) * 100).toFixed(2) : null;
    return (
      <div style={{ background: "#0d1117", border: "1px solid #1c2333", padding: "8px 12px", fontSize: 11, fontFamily: "monospace", borderRadius: 4, minWidth: 140 }}>
        <div style={{ color: "#8b949e", marginBottom: 5, fontSize: 10, borderBottom: "1px solid #1c2333", paddingBottom: 4 }}>{d.date}</div>
        <div style={{ display: "grid", gridTemplateColumns: "auto auto", gap: "3px 14px" }}>
          {d.open  != null && <><span style={{ color: "#8b949e" }}>Open</span>  <span style={{ color: "#c9d1d9" }}>${d.open}</span></>}
          {d.high  != null && <><span style={{ color: "#8b949e" }}>High</span>  <span style={{ color: "#00ff9d" }}>${d.high}</span></>}
          {d.low   != null && <><span style={{ color: "#8b949e" }}>Low</span>   <span style={{ color: "#ff6b35" }}>${d.low}</span></>}
          {d.close != null && <><span style={{ color: "#8b949e" }}>Close</span> <span style={{ color: d.isUp ? "#00ff9d" : "#ff6b35", fontWeight: 700 }}>${d.close}</span></>}
          {chg     != null && <><span style={{ color: "#8b949e" }}>Chg</span>   <span style={{ color: d.isUp ? "#00ff9d" : "#ff6b35" }}>{d.isUp?"+":""}{chg.toFixed(2)} ({chgPct}%)</span></>}
          {d.volume!= null && <><span style={{ color: "#8b949e" }}>Vol</span>   <span style={{ color: "#8b949e" }}>{fmtVol(d.volume)}</span></>}
        </div>
      </div>
    );
  };

  // Active range info
  const activeRange = ALL_RANGES.find(r => r.key === range);
  const { interval } = resolveIntervalRange(range);

  return (
    <div>
      {/* Range group tabs */}
      <div style={{ marginBottom: 10 }}>
        {RANGE_GROUPS.map(group => (
          <div key={group.label} style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 5 }}>
            <span style={{ color: group.color, fontSize: 9, letterSpacing: "0.12em", minWidth: 52, fontWeight: 700 }}>{group.label}</span>
            <div style={{ display: "flex", gap: 3 }}>
              {group.ranges.map(r => {
                const active = range === r.key;
                return (
                  <button key={r.key} onClick={() => loadRange(r.key)} title={r.desc} style={{
                    background:  active ? group.color + "22" : "transparent",
                    color:       active ? group.color : "#8b949e",
                    border:      `1px solid ${active ? group.color + "55" : "#1c233366"}`,
                    padding: "2px 9px", borderRadius: 3, fontSize: 10,
                    cursor: "pointer", fontFamily: "monospace",
                    transition: "all 0.1s",
                  }}
                    onMouseEnter={e => { if (!active) { e.currentTarget.style.color = group.color; e.currentTarget.style.borderColor = group.color + "44"; }}}
                    onMouseLeave={e => { if (!active) { e.currentTarget.style.color = "#8b949e"; e.currentTarget.style.borderColor = "#1c233366"; }}}
                  >{r.label}</button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Active range info + loading */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
          {activeRange && (
            <span style={{ color: "#8b949e44", fontSize: 10 }}>
              {activeRange.desc} · <span style={{ color: "#8b949e" }}>{data.length} candles</span>
            </span>
          )}
          {loading && <Spinner />}
        </div>
      </div>

      {error && <p style={{ color: "#ff6b35", fontSize: 11, marginBottom: 8 }}>⚠ {error}</p>}

      {/* Candlestick */}
      {!loading && data.length > 0 && (
        <>
          <ResponsiveContainer width="100%" height={210}>
            <ComposedChart data={data} margin={{ right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="#1c2333" strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tick={{ fill: "#8b949e", fontSize: 9 }}
                interval={Math.max(0, Math.floor(data.length / 8) - 1)}
              />
              <YAxis
                domain={["auto", "auto"]}
                tick={{ fill: "#8b949e", fontSize: 9 }}
                tickFormatter={v => `$${v}`}
                width={58}
              />
              <Tooltip content={customTooltip} />
              {/* Stacked bars = candlestick */}
              <Bar dataKey="_base"      stackId="c" fill="transparent" stroke="none" legendType="none" />
              <Bar dataKey="_lowerWick" stackId="c" fill="transparent" stroke="none" legendType="none" shape={wickShape} />
              <Bar dataKey="_body"      stackId="c" fill="transparent" stroke="none" legendType="none" shape={bodyShape} />
              <Bar dataKey="_upperWick" stackId="c" fill="transparent" stroke="none" legendType="none" shape={wickShape} />
            </ComposedChart>
          </ResponsiveContainer>

          {/* Volume */}
          <ResponsiveContainer width="100%" height={36}>
            <ComposedChart data={data} margin={{ right: 8, left: 0 }}>
              <YAxis hide />
              <Bar dataKey="volume" fill={color} opacity={0.3}>
                {data.map((d, i) => <Cell key={i} fill={d.isUp ? "#00ff9d" : "#ff6b35"} opacity={0.32} />)}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        </>
      )}

      {!loading && data.length === 0 && !error && (
        <div style={{ height: 80, display: "flex", alignItems: "center", justifyContent: "center", color: "#8b949e44", fontSize: 11 }}>
          No data for this range
        </div>
      )}
    </div>
  );
}

// ── Mini sparkline ─────────────────────────────────────────
function Spark({ data, positive }) {
  const c = positive ? "#00ff9d" : "#ff6b35";
  if (!data?.length) return <div style={{ width: 80, height: 36 }} />;
  return (
    <ResponsiveContainer width={80} height={36}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id={`sg${positive?"u":"d"}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={c} stopOpacity={0.3} />
            <stop offset="95%" stopColor={c} stopOpacity={0}   />
          </linearGradient>
        </defs>
        <YAxis domain={["auto","auto"]} hide />
        <Area type="monotone" dataKey="v" stroke={c} fill={`url(#sg${positive?"u":"d"})`}
          strokeWidth={1.5} dot={false} isAnimationActive={false} />
        <Tooltip contentStyle={{ background:"#0d1117", border:"1px solid #1c2333", fontSize:10, fontFamily:"monospace" }}
          formatter={v => [`$${v}`, ""]} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── AI Analyst Note ────────────────────────────────────────
function AISummary({ ticker, quote, news }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const generate = async () => {
    setLoading(true); setError(null); setSummary(null);
    try {
      const headlines = (news ?? []).slice(0, 6).map(n => `- ${n.title}`).join("\n");
      const prompt =
        `You are a senior equity analyst at Goldman Sachs. Write a concise investment note on ${ticker}.\n\n` +
        `MARKET DATA:\nPrice: $${quote?.price ?? "N/A"} (${quote?.changePct >= 0 ? "+" : ""}${quote?.changePct?.toFixed(2) ?? "N/A"}% today)\n` +
        `52-Week Range: $${quote?.low52?.toFixed(2) ?? "N/A"} – $${quote?.high52?.toFixed(2) ?? "N/A"}\n` +
        `Market Cap: ${fmtMoney(quote?.marketCap)}\nVolume: ${fmtVol(quote?.volume)}\n\n` +
        `RECENT NEWS:\n${headlines || "No recent news."}\n\n` +
        `Write EXACTLY:\n1. INVESTMENT THESIS — 2-3 sentences\n2. KEY CATALYSTS — 3 bullet points\n3. RISKS — 2 bullet points\n4. VERDICT — BUY/HOLD/SELL in one sentence`;

      const res = await fetch("/api/claude", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 800, messages: [{ role: "user", content: prompt }] }),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const d = await res.json();
      setSummary(d.content?.[0]?.text ?? "No summary returned.");
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const render = text => text.split("\n").map((line, i) => {
    const t = line.trim();
    if (!t) return <div key={i} style={{ height: 4 }} />;
    if (/^[1-4]\.\s/.test(t)) return <div key={i} style={{ color: "#00ff9d", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", marginTop: 10, marginBottom: 3, borderBottom: "1px solid #00ff9d22", paddingBottom: 2 }}>{t.toUpperCase()}</div>;
    if (/^[-•▸]/.test(t))     return <div key={i} style={{ display:"flex", gap:6, marginBottom:3 }}><span style={{ color:"#00ff9d", flexShrink:0 }}>▸</span><span style={{ color:"#c9d1d9", fontSize:11, lineHeight:1.7 }}>{t.replace(/^[-•▸]\s*/,"")}</span></div>;
    return <p key={i} style={{ color:"#c9d1d9", fontSize:11, lineHeight:1.7, margin:"0 0 2px" }}>{t}</p>;
  });

  return (
    <div style={{ borderTop: "1px solid #1c2333", marginTop: 16, paddingTop: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width:5, height:5, borderRadius:"50%", background:"#00ff9d", display:"inline-block" }} />
          <span style={{ color:"#00ff9d", fontSize:10, fontWeight:700, letterSpacing:"0.1em" }}>AI ANALYST NOTE</span>
        </div>
        <button className="btn btn-primary" style={{ fontSize:10, padding:"3px 12px" }} onClick={generate} disabled={loading}>
          {loading ? "ANALYSING…" : summary ? "↻ REFRESH" : "▶ GENERATE"}
        </button>
      </div>
      {loading && <div style={{ display:"flex", gap:8, alignItems:"center" }}><Spinner /><span style={{ color:"#8b949e", fontSize:11 }}>Analysing {ticker}…</span></div>}
      {error   && <p style={{ color:"#ff6b35", fontSize:11 }}>⚠ {error}</p>}
      {!loading && !summary && !error && <p style={{ color:"#8b949e44", fontSize:11 }}>Click Generate for an AI investment note</p>}
      {!loading && summary && <div>{render(summary)}</div>}
    </div>
  );
}

// ── Expanded detail panel ──────────────────────────────────
function StockDetail({ quote, onClose, onAddToPortfolio, inPortfolio }) {
  const [news,  setNews]  = useState([]);
  const [nLoad, setNLoad] = useState(true);
  const c = quote.positive ? "#00ff9d" : "#ff6b35";

  useEffect(() => {
    fetchStockNews(quote.ticker)
      .then(n => { setNews(n); setNLoad(false); })
      .catch(() => setNLoad(false));
  }, [quote.ticker]);

  return (
    <div style={{ background:"#080c12", border:`1px solid ${c}44`, borderRadius:"0 0 8px 8px", padding:"18px 20px" }}>
      {/* Price header */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:16 }}>
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:3 }}>
            <span style={{ color:"#fff", fontSize:26, fontWeight:800 }}>${quote.price}</span>
            <span style={{ color:c, fontSize:13, fontWeight:600, background: quote.positive?"#00ff9d15":"#ff6b3515", padding:"2px 10px", borderRadius:3 }}>
              {quote.positive?"+":""}{quote.change} ({quote.positive?"+":""}{quote.changePct?.toFixed(2)}%)
            </span>
          </div>
          <div style={{ display:"flex", gap:14, fontSize:10, flexWrap:"wrap" }}>
            {quote.dayHigh && <span style={{ color:"#8b949e" }}>Day <b style={{ color:"#c9d1d9" }}>${quote.dayLow?.toFixed(2)}–${quote.dayHigh?.toFixed(2)}</b></span>}
            <span style={{ color:"#8b949e" }}>Vol <b style={{ color:"#c9d1d9" }}>{fmtVol(quote.volume)}</b></span>
            <span style={{ color:"#8b949e" }}>Cap <b style={{ color:"#c9d1d9" }}>{fmtMoney(quote.marketCap)}</b></span>
            {quote.high52 && <span style={{ color:"#8b949e" }}>52W <b style={{ color:"#c9d1d9" }}>${quote.low52?.toFixed(2)}–${quote.high52?.toFixed(2)}</b></span>}
            <span style={{ color:"#8b949e33" }}>Updated {new Date(quote.updated).toLocaleTimeString()}</span>
          </div>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          {!inPortfolio
            ? <button className="btn btn-primary" style={{ fontSize:11, padding:"6px 14px" }} onClick={() => onAddToPortfolio(quote)}>+ Add to Portfolio</button>
            : <span style={{ color:"#00ff9d", fontSize:11 }}>✓ IN PORTFOLIO</span>}
          <button onClick={onClose} style={{ background:"none", border:"1px solid #1c2333", color:"#8b949e", cursor:"pointer", borderRadius:4, width:28, height:28, fontSize:16, display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
        </div>
      </div>

      {/* Chart */}
      <div style={{ background:"#0d1117", border:"1px solid #1c2333", borderRadius:6, padding:"12px 14px", marginBottom:16 }}>
        <div style={{ color:"#8b949e", fontSize:10, letterSpacing:"0.08em", marginBottom:8 }}>PRICE CHART — {quote.ticker}</div>
        <CandleChart ticker={quote.ticker} color={c} />
      </div>

      {/* News */}
      <div style={{ marginBottom: 4 }}>
        <div style={{ color:"#8b949e", fontSize:10, letterSpacing:"0.1em", marginBottom:8 }}>LATEST NEWS</div>
        {nLoad && <div style={{ display:"flex", gap:8 }}><Spinner /><span style={{ color:"#8b949e", fontSize:11 }}>Loading…</span></div>}
        {news.map((n, i) => (
          <a key={i} href={n.url} target="_blank" rel="noreferrer" style={{ textDecoration:"none", display:"block" }}>
            <div style={{ padding:"7px 0", borderBottom:"1px solid #1c233344" }}
              onMouseEnter={e => e.currentTarget.style.opacity="0.7"}
              onMouseLeave={e => e.currentTarget.style.opacity="1"}>
              <div style={{ color:"#c9d1d9", fontSize:12, marginBottom:2 }}>{n.title}</div>
              <div style={{ display:"flex", gap:10, fontSize:10 }}>
                <span style={{ color:"#00ff9d77" }}>{n.source}</span>
                <span style={{ color:"#8b949e44" }}>{n.time}</span>
              </div>
            </div>
          </a>
        ))}
        {!nLoad && news.length === 0 && <p style={{ color:"#8b949e44", fontSize:11 }}>No recent news.</p>}
      </div>

      <AISummary ticker={quote.ticker} quote={quote} news={news} />
    </div>
  );
}

// ── Stock card (collapsed) ─────────────────────────────────
function StockCard({ quote, expanded, onToggle, onRemove, onAddToPortfolio, inPortfolio }) {
  const c = quote.positive ? "#00ff9d" : "#ff6b35";
  return (
    <div>
      <div onClick={onToggle} style={{
        background: expanded ? "#0a0e15" : "#0d1117",
        border: `1px solid ${expanded ? c+"55" : "#1c2333"}`,
        borderLeft: `3px solid ${c}`,
        borderRadius: expanded ? "6px 6px 0 0" : 6,
        padding: "11px 16px",
        display: "grid", gridTemplateColumns: "1fr auto auto",
        alignItems: "center", gap: 12, cursor: "pointer", transition: "all 0.15s",
      }}
        onMouseEnter={e => { if (!expanded) e.currentTarget.style.background="#ffffff05"; }}
        onMouseLeave={e => { if (!expanded) e.currentTarget.style.background="#0d1117"; }}
      >
        <div>
          <div style={{ display:"flex", alignItems:"baseline", gap:8, marginBottom:3 }}>
            <span style={{ color:"#fff", fontWeight:700, fontSize:14, letterSpacing:"0.05em" }}>{quote.ticker}</span>
            <span style={{ color:"#8b949e", fontSize:11, maxWidth:220, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{quote.name}</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
            <span style={{ color:"#fff", fontSize:17, fontWeight:600 }}>${quote.price}</span>
            <span style={{ color:c, fontSize:12, fontWeight:600, background:quote.positive?"#00ff9d15":"#ff6b3515", padding:"1px 7px", borderRadius:3 }}>
              {quote.positive?"+":""}{quote.change} ({quote.positive?"+":""}{quote.changePct?.toFixed(2)}%)
            </span>
            <span style={{ color:"#8b949e55", fontSize:10 }}>Vol <span style={{ color:"#8b949e" }}>{fmtVol(quote.volume)}</span></span>
            <span style={{ color:"#8b949e55", fontSize:10 }}>Cap <span style={{ color:"#8b949e" }}>{fmtMoney(quote.marketCap)}</span></span>
          </div>
        </div>
        <Spark data={quote.sparkline} positive={quote.positive} />
        <div style={{ display:"flex", flexDirection:"column", gap:4, alignItems:"flex-end" }}>
          <span style={{ color:"#8b949e", fontSize:14 }}>{expanded ? "▲" : "▼"}</span>
          <button onClick={e => { e.stopPropagation(); onRemove(quote.ticker); }}
            style={{ background:"none", border:"none", color:"#8b949e33", fontSize:14, cursor:"pointer", lineHeight:1, padding:0 }}>×</button>
        </div>
      </div>
      {expanded && (
        <StockDetail quote={quote} onClose={onToggle}
          onAddToPortfolio={onAddToPortfolio} inPortfolio={inPortfolio} />
      )}
    </div>
  );
}

// ── Search bar ─────────────────────────────────────────────
function SearchBar({ onAdd, watchlist }) {
  const [query,   setQuery]   = useState("");
  const [results, setResults] = useState([]);
  const [busy,    setBusy]    = useState(false);
  const [open,    setOpen]    = useState(false);
  const ref = useRef(); const timer = useRef();

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const doSearch = useCallback(q => {
    clearTimeout(timer.current);
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    timer.current = setTimeout(async () => {
      setBusy(true);
      try { setResults(await searchTicker(q)); setOpen(true); }
      catch { setResults([]); }
      finally { setBusy(false); }
    }, 380);
  }, []);

  return (
    <div ref={ref} style={{ position:"relative", flex:1, maxWidth:360 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, background:"#0d1117", border:"1px solid #1c2333", borderRadius:6, padding:"7px 12px" }}>
        {busy ? <Spinner /> : <span style={{ color:"#8b949e" }}>⌕</span>}
        <input className="input-dark"
          style={{ border:"none", background:"transparent", flex:1, fontSize:12, outline:"none", padding:0 }}
          placeholder="Search ticker or company…" value={query}
          onChange={e => { setQuery(e.target.value); doSearch(e.target.value); }}
          onFocus={() => results.length && setOpen(true)} />
        {query && <span style={{ color:"#8b949e", cursor:"pointer", fontSize:16 }} onClick={() => { setQuery(""); setResults([]); setOpen(false); }}>×</span>}
      </div>
      {open && results.length > 0 && (
        <div style={{ position:"absolute", top:"calc(100% + 6px)", left:0, right:0, background:"#12151c", border:"1px solid #1c2333", borderRadius:6, zIndex:200, overflow:"hidden", boxShadow:"0 8px 32px #00000088" }}>
          {results.map(r => {
            const already = watchlist.includes(r.symbol);
            return (
              <div key={r.symbol} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"9px 14px", borderBottom:"1px solid #1c233444" }}
                onMouseEnter={e => e.currentTarget.style.background="#ffffff06"}
                onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                <div>
                  <span style={{ color:"#00ff9d", fontWeight:700, fontSize:12, marginRight:8 }}>{r.symbol}</span>
                  <span style={{ color:"#8b949e", fontSize:11 }}>{r.shortname ?? r.longname ?? ""}</span>
                  <span style={{ color:"#8b949e44", fontSize:10, marginLeft:8 }}>{r.exchDisp}</span>
                </div>
                <button disabled={already} onClick={() => { onAdd(r.symbol); setQuery(""); setResults([]); setOpen(false); }}
                  className="btn btn-primary" style={{ fontSize:10, padding:"3px 10px", opacity: already ? 0.4 : 1 }}>
                  {already ? "Added" : "+ Add"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────
export default function MarketWatch({ holdings, stockData, watchlistTickers, setWatchlistTickers, onAddToPortfolio }) {
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    try { localStorage.setItem("mw_watchlist", JSON.stringify(watchlistTickers)); } catch {}
  }, [watchlistTickers]);

  const addTicker = useCallback(t => {
    const ticker = t.toUpperCase().trim();
    if (!ticker || watchlistTickers.includes(ticker)) return;
    setWatchlistTickers(prev => [...prev, ticker]);
  }, [watchlistTickers, setWatchlistTickers]);

  const removeTicker = useCallback(ticker => {
    setWatchlistTickers(prev => prev.filter(t => t !== ticker));
    if (expanded === ticker) setExpanded(null);
  }, [expanded, setWatchlistTickers]);

  const allQuotes = watchlistTickers.map(t => stockData.getQuote(t)).filter(Boolean);
  const gainers   = allQuotes.filter(q => q.changePct >= 0).length;
  const losers    = allQuotes.filter(q => q.changePct <  0).length;
  const avgChg    = allQuotes.length
    ? (allQuotes.reduce((s, q) => s + (q.changePct ?? 0), 0) / allQuotes.length).toFixed(2)
    : null;

  const portfolioSet = new Set(holdings.map(h => h.ticker));

  return (
    <div>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16, flexWrap:"wrap" }}>
        <SectionLabel>Market Watch</SectionLabel>
        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:10 }}>
          {stockData.lastUpdate && <span style={{ color:"#8b949e44", fontSize:10 }}>2s refresh · {stockData.lastUpdate.toLocaleTimeString()}</span>}
          {stockData.loading && <span style={{ display:"flex", gap:6, alignItems:"center", color:"#8b949e", fontSize:11 }}><Spinner /> Updating…</span>}
          <button onClick={() => stockData.refresh()} disabled={stockData.loading} className="btn btn-ghost" style={{ fontSize:11, padding:"5px 12px" }}>↻ REFRESH</button>
        </div>
      </div>

      {/* Summary bar */}
      {allQuotes.length > 0 && (
        <div style={{ display:"flex", gap:20, padding:"10px 18px", background:"#0d1117", border:"1px solid #1c2333", borderRadius:6, marginBottom:16, flexWrap:"wrap", alignItems:"center" }}>
          <div><span style={{ color:"#8b949e", fontSize:10 }}>WATCHING </span><span style={{ color:"#fff", fontWeight:700 }}>{allQuotes.length}</span></div>
          <div><span style={{ color:"#8b949e", fontSize:10 }}>GAINERS </span><span style={{ color:"#00ff9d", fontWeight:700 }}>{gainers}</span></div>
          <div><span style={{ color:"#8b949e", fontSize:10 }}>LOSERS </span><span style={{ color:"#ff6b35", fontWeight:700 }}>{losers}</span></div>
          {avgChg && <div><span style={{ color:"#8b949e", fontSize:10 }}>AVG </span><span style={{ color:parseFloat(avgChg)>=0?"#00ff9d":"#ff6b35", fontWeight:700 }}>{parseFloat(avgChg)>=0?"+":""}{avgChg}%</span></div>}
          <div style={{ flex:1, height:4, borderRadius:2, overflow:"hidden", display:"flex", minWidth:100 }}>
            <div style={{ width:`${allQuotes.length?(gainers/allQuotes.length)*100:0}%`, background:"#00ff9d", transition:"width 0.5s" }} />
            <div style={{ width:`${allQuotes.length?(losers/allQuotes.length)*100:0}%`,  background:"#ff6b35", transition:"width 0.5s" }} />
          </div>
        </div>
      )}

      {/* Search + manual add */}
      <div style={{ display:"flex", gap:10, marginBottom:20, alignItems:"center", flexWrap:"wrap" }}>
        <SearchBar onAdd={addTicker} watchlist={watchlistTickers} />
        <span style={{ color:"#8b949e44", fontSize:11 }}>or:</span>
        <div style={{ display:"flex", gap:6 }}>
          <input className="input-dark" style={{ width:90, fontSize:12 }} placeholder="e.g. TSLA"
            onKeyDown={e => { if (e.key==="Enter") { addTicker(e.target.value); e.target.value=""; } }} />
          <button className="btn btn-primary" style={{ fontSize:11 }}
            onClick={e => { const inp = e.currentTarget.previousSibling; addTicker(inp.value); inp.value=""; }}>+ ADD</button>
        </div>
      </div>

      {/* Cards */}
      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        {watchlistTickers.map(ticker => {
          const quote = stockData.getQuote(ticker);
          if (!quote) return (
            <div key={ticker} style={{ background:"#0d1117", border:"1px solid #1c2333", borderRadius:6, padding:16, display:"flex", gap:10, alignItems:"center" }}>
              <Spinner /><span style={{ color:"#8b949e", fontSize:12 }}>Loading {ticker}…</span>
              <button onClick={() => removeTicker(ticker)} style={{ marginLeft:"auto", background:"none", border:"none", color:"#8b949e44", fontSize:14, cursor:"pointer" }}>×</button>
            </div>
          );
          return (
            <StockCard key={ticker} quote={quote}
              expanded={expanded === ticker}
              onToggle={() => setExpanded(p => p === ticker ? null : ticker)}
              onRemove={removeTicker}
              onAddToPortfolio={onAddToPortfolio}
              inPortfolio={portfolioSet.has(ticker)}
            />
          );
        })}
      </div>

      {watchlistTickers.length === 0 && (
        <div style={{ textAlign:"center", padding:"60px 0", color:"#8b949e" }}>
          <p style={{ fontSize:24, marginBottom:8 }}>📈</p>
          <p style={{ fontSize:13 }}>Your watchlist is empty — search above to add stocks</p>
        </div>
      )}

      <p style={{ color:"#8b949e33", fontSize:10, marginTop:20 }}>
        Data via Yahoo Finance · Prices delayed ~15 min · Intraday candles: 1m/5m/15m/1h available · Not financial advice
      </p>
    </div>
  );
}
