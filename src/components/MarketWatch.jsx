// src/components/MarketWatch.jsx
import { useState, useEffect, useCallback, useRef } from "react";
import { SectionLabel, Spinner } from "./UI";
import { ResponsiveContainer, AreaChart, Area, YAxis, Tooltip } from "recharts";
import CandleChart from "./CandleChart";
import { fetchStockNews, searchTicker } from "../hooks/useStockData";

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

// ── Sparkline ──────────────────────────────────────────────
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

// ── AI Note ────────────────────────────────────────────────
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
        `52W: $${quote?.low52?.toFixed(2) ?? "N/A"}–$${quote?.high52?.toFixed(2) ?? "N/A"} · Cap: ${fmtMoney(quote?.marketCap)} · Vol: ${fmtVol(quote?.volume)}\n\n` +
        `NEWS:\n${headlines || "No recent news."}\n\n` +
        `Write EXACTLY:\n1. INVESTMENT THESIS — 2-3 sentences\n2. KEY CATALYSTS — 3 bullet points\n3. RISKS — 2 bullet points\n4. VERDICT — BUY/HOLD/SELL in one sentence`;
      const res = await fetch("/api/claude", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:800, messages:[{role:"user",content:prompt}] }),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const d = await res.json();
      setSummary(d.content?.[0]?.text ?? "No summary.");
    } catch (e) { setError(e.message); }
    finally     { setLoading(false); }
  };

  const render = text => text.split("\n").map((line, i) => {
    const t = line.trim();
    if (!t) return <div key={i} style={{ height:4 }} />;
    if (/^[1-4]\.\s/.test(t)) return <div key={i} style={{ color:"#00ff9d", fontSize:10, fontWeight:700, letterSpacing:"0.12em", marginTop:10, marginBottom:3, borderBottom:"1px solid #00ff9d22", paddingBottom:2 }}>{t.toUpperCase()}</div>;
    if (/^[-•▸]/.test(t))     return <div key={i} style={{ display:"flex", gap:6, marginBottom:3 }}><span style={{ color:"#00ff9d", flexShrink:0 }}>▸</span><span style={{ color:"#c9d1d9", fontSize:11, lineHeight:1.7 }}>{t.replace(/^[-•▸]\s*/,"")}</span></div>;
    return <p key={i} style={{ color:"#c9d1d9", fontSize:11, lineHeight:1.7, margin:"0 0 2px" }}>{t}</p>;
  });

  return (
    <div style={{ borderTop:"1px solid #1c2333", marginTop:16, paddingTop:12 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
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

// ── Expanded detail ────────────────────────────────────────
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
      {/* Price row */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:16 }}>
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:3 }}>
            <span style={{ color:"#fff", fontSize:26, fontWeight:800 }}>${quote.price}</span>
            <span style={{ color:c, fontSize:13, fontWeight:600, background:quote.positive?"#00ff9d15":"#ff6b3515", padding:"2px 10px", borderRadius:3 }}>
              {quote.positive?"+":""}{quote.change} ({quote.positive?"+":""}{quote.changePct?.toFixed(2)}%)
            </span>
          </div>
          <div style={{ display:"flex", gap:14, fontSize:10, flexWrap:"wrap" }}>
            {quote.dayHigh && <span style={{ color:"#8b949e" }}>Day <b style={{ color:"#c9d1d9" }}>${quote.dayLow?.toFixed(2)}–${quote.dayHigh?.toFixed(2)}</b></span>}
            <span style={{ color:"#8b949e" }}>Vol <b style={{ color:"#c9d1d9" }}>{fmtVol(quote.volume)}</b></span>
            <span style={{ color:"#8b949e" }}>Cap <b style={{ color:"#c9d1d9" }}>{fmtMoney(quote.marketCap)}</b></span>
            {quote.high52 && <span style={{ color:"#8b949e" }}>52W <b style={{ color:"#c9d1d9" }}>${quote.low52?.toFixed(2)}–${quote.high52?.toFixed(2)}</b></span>}
          </div>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          {!inPortfolio
            ? <button className="btn btn-primary" style={{ fontSize:11, padding:"6px 14px" }} onClick={() => onAddToPortfolio(quote)}>+ Add to Portfolio</button>
            : <span style={{ color:"#00ff9d", fontSize:11 }}>✓ IN PORTFOLIO</span>}
          <button onClick={onClose} style={{ background:"none", border:"1px solid #1c2333", color:"#8b949e", cursor:"pointer", borderRadius:4, width:28, height:28, fontSize:16, display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
        </div>
      </div>

      {/* ── NEW: Proper candlestick chart ── */}
      <div style={{ background:"#0d1117", border:"1px solid #1c2333", borderRadius:6, padding:"12px 14px", marginBottom:16 }}>
        <div style={{ color:"#8b949e", fontSize:10, letterSpacing:"0.08em", marginBottom:8 }}>PRICE CHART — {quote.ticker}</div>
        <CandleChart ticker={quote.ticker} height={220} volumeHeight={40} />
      </div>

      {/* News */}
      <div style={{ color:"#8b949e", fontSize:10, letterSpacing:"0.1em", marginBottom:8 }}>LATEST NEWS</div>
      {nLoad && <div style={{ display:"flex", gap:8 }}><Spinner /><span style={{ color:"#8b949e", fontSize:11 }}>Loading…</span></div>}
      {news.map((n, i) => (
        <a key={i} href={n.url} target="_blank" rel="noreferrer" style={{ textDecoration:"none", display:"block" }}>
          <div style={{ padding:"7px 0", borderBottom:"1px solid #1c233344", transition:"opacity 0.15s" }}
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
      <AISummary ticker={quote.ticker} quote={quote} news={news} />
    </div>
  );
}

// ── Stock card ─────────────────────────────────────────────
function StockCard({ quote, expanded, onToggle, onRemove, onAddToPortfolio, inPortfolio }) {
  const c = quote.positive ? "#00ff9d" : "#ff6b35";
  return (
    <div>
      <div onClick={onToggle} style={{
        background: expanded ? "#0a0e15" : "#0d1117",
        border: `1px solid ${expanded ? c+"55" : "#1c2333"}`,
        borderLeft: `3px solid ${c}`,
        borderRadius: expanded ? "6px 6px 0 0" : 6,
        padding:"11px 16px",
        display:"grid", gridTemplateColumns:"1fr auto auto",
        alignItems:"center", gap:12, cursor:"pointer", transition:"all 0.15s",
      }}
        onMouseEnter={e => { if (!expanded) e.currentTarget.style.background="#ffffff05"; }}
        onMouseLeave={e => { if (!expanded) e.currentTarget.style.background=expanded?"#0a0e15":"#0d1117"; }}
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
          <span style={{ color:"#8b949e", fontSize:14 }}>{expanded?"▲":"▼"}</span>
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

// ── Search ─────────────────────────────────────────────────
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

// ── Main ───────────────────────────────────────────────────
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
    ? (allQuotes.reduce((s, q) => s + (q.changePct ?? 0), 0) / allQuotes.length).toFixed(2) : null;
  const portfolioSet = new Set(holdings.map(h => h.ticker));

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16, flexWrap:"wrap" }}>
        <SectionLabel>Market Watch</SectionLabel>
        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:10 }}>
          {stockData.lastUpdate && <span style={{ color:"#8b949e44", fontSize:10 }}>2s refresh · {stockData.lastUpdate.toLocaleTimeString()}</span>}
          {stockData.loading && <span style={{ display:"flex", gap:6, alignItems:"center", color:"#8b949e", fontSize:11 }}><Spinner /> Updating…</span>}
          <button onClick={() => stockData.refresh()} disabled={stockData.loading} className="btn btn-ghost" style={{ fontSize:11, padding:"5px 12px" }}>↻ REFRESH</button>
        </div>
      </div>

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

      <div style={{ display:"flex", gap:10, marginBottom:20, alignItems:"center", flexWrap:"wrap" }}>
        <SearchBar onAdd={addTicker} watchlist={watchlistTickers} />
        <span style={{ color:"#8b949e44", fontSize:11 }}>or:</span>
        <div style={{ display:"flex", gap:6 }}>
          <input className="input-dark" style={{ width:90, fontSize:12 }} placeholder="e.g. TSLA"
            onKeyDown={e => { if (e.key==="Enter") { addTicker(e.target.value); e.target.value=""; } }} />
          <button className="btn btn-primary" style={{ fontSize:11 }}
            onClick={e => { const inp=e.currentTarget.previousSibling; addTicker(inp.value); inp.value=""; }}>+ ADD</button>
        </div>
      </div>

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
        Data via Yahoo Finance · Prices delayed ~15 min · Scroll to zoom · Drag to pan · Not financial advice
      </p>
    </div>
  );
}
