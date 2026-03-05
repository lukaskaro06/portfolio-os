import { useState, useEffect, useCallback, useRef } from "react";
import { SectionLabel, Spinner } from "./UI";
import {
  LineChart, Line, ResponsiveContainer, Tooltip, YAxis,
} from "recharts";

// ── Helpers ────────────────────────────────────────────────

function proxyUrl(url) {
  return `/api/proxy?url=${encodeURIComponent(url)}`;
}

async function fetchQuote(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=7d`;
  const res = await fetch(proxyUrl(url));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error("No data");

  const meta = result.meta;
  const closes = result.indicators?.adjclose?.[0]?.adjclose
    ?? result.indicators?.quote?.[0]?.close ?? [];
  const timestamps = result.timestamp ?? [];

  const price = meta.regularMarketPrice ?? closes[closes.length - 1];
  const prev  = meta.chartPreviousClose ?? meta.previousClose ?? closes[closes.length - 2];
  const change    = price - prev;
  const changePct = prev ? ((change / prev) * 100) : 0;

  const sparkline = timestamps.map((ts, i) => ({
    t: new Date(ts * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    v: closes[i] ?? null,
  })).filter(d => d.v !== null);

  return {
    ticker,
    name:      meta.longName ?? meta.shortName ?? ticker,
    price:     price?.toFixed(2),
    change:    change?.toFixed(2),
    changePct: changePct?.toFixed(2),
    volume:    meta.regularMarketVolume,
    marketCap: meta.marketCap,
    currency:  meta.currency ?? "USD",
    sparkline,
    positive:  changePct >= 0,
    updated:   new Date().toLocaleTimeString(),
  };
}

async function searchTicker(query) {
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=6&newsCount=0`;
  const res = await fetch(proxyUrl(url));
  if (!res.ok) throw new Error("Search failed");
  const json = await res.json();
  return (json?.quotes ?? []).filter(q => q.quoteType === "EQUITY" || q.quoteType === "ETF").slice(0, 6);
}

function fmt(n) {
  if (!n) return "—";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
}

function fmtVol(n) {
  if (!n) return "—";
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toString();
}

const DEFAULT_WATCHLIST = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "SPY", "QQQ", "BTC-USD"];

// ── Sparkline ──────────────────────────────────────────────
function Spark({ data, positive }) {
  const color = positive ? "#00ff9d" : "#ff6b35";
  return (
    <ResponsiveContainer width={80} height={36}>
      <LineChart data={data}>
        <YAxis domain={["auto", "auto"]} hide />
        <Line
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
        <Tooltip
          contentStyle={{ background: "#0d1117", border: "1px solid #1c2333", fontSize: 10, fontFamily: "monospace" }}
          formatter={v => [`$${v?.toFixed(2)}`, ""]}
          labelFormatter={l => l}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Stock Card ─────────────────────────────────────────────
function StockCard({ quote, onRemove, onAddToPortfolio, inPortfolio }) {
  const c = quote.positive ? "#00ff9d" : "#ff6b35";
  return (
    <div style={{
      background: "#0d1117",
      border: `1px solid #1c2333`,
      borderLeft: `3px solid ${c}`,
      borderRadius: 6,
      padding: "12px 16px",
      display: "grid",
      gridTemplateColumns: "1fr auto auto",
      alignItems: "center",
      gap: 12,
      transition: "border-color 0.2s",
    }}
      onMouseEnter={e => e.currentTarget.style.borderColor = c}
      onMouseLeave={e => e.currentTarget.style.borderColor = "#1c2333"}
    >
      {/* Left: info */}
      <div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 3 }}>
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 14, letterSpacing: "0.05em" }}>{quote.ticker}</span>
          <span style={{ color: "#8b949e", fontSize: 11, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{quote.name}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ color: "#fff", fontSize: 18, fontWeight: 600 }}>${quote.price}</span>
          <span style={{
            color: c, fontSize: 12, fontWeight: 600,
            background: quote.positive ? "#00ff9d15" : "#ff6b3515",
            padding: "2px 7px", borderRadius: 3,
          }}>
            {quote.positive ? "+" : ""}{quote.change} ({quote.positive ? "+" : ""}{quote.changePct}%)
          </span>
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 5 }}>
          <span style={{ color: "#8b949e55", fontSize: 10 }}>VOL <span style={{ color: "#8b949e" }}>{fmtVol(quote.volume)}</span></span>
          <span style={{ color: "#8b949e55", fontSize: 10 }}>CAP <span style={{ color: "#8b949e" }}>{fmt(quote.marketCap)}</span></span>
          <span style={{ color: "#8b949e33", fontSize: 10 }}>Updated {quote.updated}</span>
        </div>
      </div>

      {/* Middle: sparkline */}
      <div style={{ opacity: 0.9 }}>
        <Spark data={quote.sparkline} positive={quote.positive} />
        <div style={{ textAlign: "center", color: "#8b949e44", fontSize: 9, marginTop: 2 }}>7D</div>
      </div>

      {/* Right: actions */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
        {!inPortfolio && (
          <button
            onClick={() => onAddToPortfolio(quote)}
            className="btn btn-primary"
            style={{ fontSize: 10, padding: "4px 10px", whiteSpace: "nowrap" }}
          >
            + Portfolio
          </button>
        )}
        {inPortfolio && (
          <span style={{ color: "#00ff9d", fontSize: 10, letterSpacing: "0.05em" }}>✓ IN PORTFOLIO</span>
        )}
        <button
          onClick={() => onRemove(quote.ticker)}
          style={{ background: "none", border: "none", color: "#8b949e44", fontSize: 16, cursor: "pointer", lineHeight: 1 }}
          title="Remove from watchlist"
        >×</button>
      </div>
    </div>
  );
}

// ── Search Bar ─────────────────────────────────────────────
function SearchBar({ onAdd, watchlist }) {
  const [query,   setQuery]   = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open,    setOpen]    = useState(false);
  const ref = useRef();
  const timer = useRef();

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const search = useCallback((q) => {
    clearTimeout(timer.current);
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await searchTicker(q);
        setResults(r);
        setOpen(true);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 400);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative", flex: 1, maxWidth: 340 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#0d1117", border: "1px solid #1c2333", borderRadius: 6, padding: "7px 12px" }}>
        {loading ? <Spinner /> : <span style={{ color: "#8b949e" }}>⌕</span>}
        <input
          className="input-dark"
          style={{ border: "none", background: "transparent", flex: 1, fontSize: 12, outline: "none", padding: 0 }}
          placeholder="Search ticker or company…"
          value={query}
          onChange={e => { setQuery(e.target.value); search(e.target.value); }}
          onFocus={() => results.length && setOpen(true)}
        />
        {query && <span style={{ color: "#8b949e", cursor: "pointer", fontSize: 16 }} onClick={() => { setQuery(""); setResults([]); setOpen(false); }}>×</span>}
      </div>

      {open && results.length > 0 && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0,
          background: "#12151c", border: "1px solid #1c2333", borderRadius: 6,
          zIndex: 100, overflow: "hidden", boxShadow: "0 8px 32px #00000088",
        }}>
          {results.map(r => {
            const already = watchlist.includes(r.symbol);
            return (
              <div
                key={r.symbol}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "9px 14px", borderBottom: "1px solid #1c233344", cursor: "pointer",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "#ffffff05"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <div>
                  <span style={{ color: "#00ff9d", fontWeight: 700, fontSize: 12, marginRight: 8 }}>{r.symbol}</span>
                  <span style={{ color: "#8b949e", fontSize: 11 }}>{r.shortname ?? r.longname ?? ""}</span>
                  <span style={{ color: "#8b949e44", fontSize: 10, marginLeft: 8 }}>{r.exchDisp}</span>
                </div>
                <button
                  disabled={already}
                  onClick={() => { onAdd(r.symbol); setQuery(""); setResults([]); setOpen(false); }}
                  className="btn btn-primary"
                  style={{ fontSize: 10, padding: "3px 10px", opacity: already ? 0.4 : 1 }}
                >
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

// ── Main Component ─────────────────────────────────────────
export default function MarketWatch({ holdings, onAddToPortfolio }) {
  const [watchlist, setWatchlist] = useState(() => {
    try {
      const saved = localStorage.getItem("mw_watchlist");
      return saved ? JSON.parse(saved) : DEFAULT_WATCHLIST;
    } catch { return DEFAULT_WATCHLIST; }
  });

  const [quotes,    setQuotes]    = useState({});
  const [errors,    setErrors]    = useState({});
  const [loading,   setLoading]   = useState(false);
  const [lastUpdate,setLastUpdate]= useState(null);
  const intervalRef = useRef();

  // Persist watchlist
  useEffect(() => {
    try { localStorage.setItem("mw_watchlist", JSON.stringify(watchlist)); } catch {}
  }, [watchlist]);

  const fetchAll = useCallback(async (tickers) => {
    setLoading(true);
    const newQuotes = { ...quotes };
    const newErrors = {};

    await Promise.allSettled(
      tickers.map(async t => {
        try {
          newQuotes[t] = await fetchQuote(t);
          delete newErrors[t];
        } catch (e) {
          newErrors[t] = e.message;
        }
      })
    );

    setQuotes({ ...newQuotes });
    setErrors(newErrors);
    setLoading(false);
    setLastUpdate(new Date().toLocaleTimeString());
  }, [quotes]);

  // Initial fetch + auto-refresh every 1s
  useEffect(() => {
    fetchAll(watchlist);
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => fetchAll(watchlist), 1000);
    return () => clearInterval(intervalRef.current);
  // eslint-disable-next-line
  }, [watchlist]);

  const addTicker = useCallback((ticker) => {
    const t = ticker.toUpperCase().trim();
    if (!t || watchlist.includes(t)) return;
    setWatchlist(prev => [...prev, t]);
  }, [watchlist]);

  const removeTicker = useCallback((ticker) => {
    setWatchlist(prev => prev.filter(t => t !== ticker));
    setQuotes(prev => { const n = { ...prev }; delete n[ticker]; return n; });
  }, []);

  const portfolioTickers = new Set(holdings.map(h => h.ticker));

  // Summary stats
  const allQuotes = Object.values(quotes);
  const gainers   = allQuotes.filter(q => parseFloat(q.changePct) > 0).length;
  const losers    = allQuotes.filter(q => parseFloat(q.changePct) < 0).length;
  const avgChange = allQuotes.length
    ? (allQuotes.reduce((s, q) => s + parseFloat(q.changePct ?? 0), 0) / allQuotes.length).toFixed(2)
    : null;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <SectionLabel>Market Watch</SectionLabel>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {lastUpdate && (
            <span style={{ color: "#8b949e44", fontSize: 10 }}>
              Auto-refresh 1s · Last: {lastUpdate}
            </span>
          )}
          {loading && <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#8b949e", fontSize: 11 }}><Spinner /> Updating…</span>}
          <button onClick={() => fetchAll(watchlist)} disabled={loading} className="btn btn-ghost" style={{ fontSize: 11, padding: "5px 12px" }}>
            ↻ REFRESH
          </button>
        </div>
      </div>

      {/* Market summary bar */}
      {allQuotes.length > 0 && (
        <div style={{
          display: "flex", gap: 20, padding: "10px 18px",
          background: "#0d1117", border: "1px solid #1c2333",
          borderRadius: 6, marginBottom: 16, flexWrap: "wrap",
        }}>
          <div>
            <span style={{ color: "#8b949e", fontSize: 10 }}>WATCHING </span>
            <span style={{ color: "#fff", fontWeight: 700 }}>{allQuotes.length}</span>
          </div>
          <div>
            <span style={{ color: "#8b949e", fontSize: 10 }}>GAINERS </span>
            <span style={{ color: "#00ff9d", fontWeight: 700 }}>{gainers}</span>
          </div>
          <div>
            <span style={{ color: "#8b949e", fontSize: 10 }}>LOSERS </span>
            <span style={{ color: "#ff6b35", fontWeight: 700 }}>{losers}</span>
          </div>
          {avgChange !== null && (
            <div>
              <span style={{ color: "#8b949e", fontSize: 10 }}>AVG CHANGE </span>
              <span style={{ color: parseFloat(avgChange) >= 0 ? "#00ff9d" : "#ff6b35", fontWeight: 700 }}>
                {parseFloat(avgChange) >= 0 ? "+" : ""}{avgChange}%
              </span>
            </div>
          )}
          {/* mini sentiment bar */}
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, minWidth: 120 }}>
            <div style={{ flex: 1, height: 4, borderRadius: 2, overflow: "hidden", display: "flex" }}>
              <div style={{ width: `${(gainers / allQuotes.length) * 100}%`, background: "#00ff9d", transition: "width 0.5s" }} />
              <div style={{ width: `${(losers  / allQuotes.length) * 100}%`, background: "#ff6b35", transition: "width 0.5s" }} />
            </div>
          </div>
        </div>
      )}

      {/* Search + add */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, alignItems: "center" }}>
        <SearchBar onAdd={addTicker} watchlist={watchlist} />
        <span style={{ color: "#8b949e44", fontSize: 11 }}>or type ticker:</span>
        <div style={{ display: "flex", gap: 6 }}>
          <input
            className="input-dark"
            style={{ width: 90, fontSize: 12 }}
            placeholder="e.g. TSLA"
            onKeyDown={e => { if (e.key === "Enter") { addTicker(e.target.value); e.target.value = ""; } }}
          />
          <button className="btn btn-primary" style={{ fontSize: 11 }}
            onClick={e => {
              const input = e.currentTarget.previousSibling;
              addTicker(input.value);
              input.value = "";
            }}>
            + ADD
          </button>
        </div>
      </div>

      {/* Stock cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {watchlist.map(ticker => {
          const quote = quotes[ticker];
          const err   = errors[ticker];

          if (!quote && !err) {
            return (
              <div key={ticker} style={{ background: "#0d1117", border: "1px solid #1c2333", borderRadius: 6, padding: "16px", display: "flex", alignItems: "center", gap: 12 }}>
                <Spinner />
                <span style={{ color: "#8b949e", fontSize: 12 }}>Loading {ticker}…</span>
              </div>
            );
          }

          if (err) {
            return (
              <div key={ticker} style={{ background: "#0d1117", border: "1px solid #ff6b3533", borderRadius: 6, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ color: "#ff6b35", fontSize: 12 }}>⚠ {ticker} — {err}</span>
                <button onClick={() => removeTicker(ticker)} style={{ background: "none", border: "none", color: "#8b949e", cursor: "pointer" }}>× Remove</button>
              </div>
            );
          }

          return (
            <StockCard
              key={ticker}
              quote={quote}
              onRemove={removeTicker}
              onAddToPortfolio={onAddToPortfolio}
              inPortfolio={portfolioTickers.has(ticker)}
            />
          );
        })}
      </div>

      {watchlist.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#8b949e" }}>
          <p style={{ fontSize: 20, marginBottom: 8 }}>📈</p>
          <p style={{ fontSize: 13, marginBottom: 4 }}>Your watchlist is empty</p>
          <p style={{ fontSize: 11 }}>Search for a stock above to get started</p>
        </div>
      )}

      <p style={{ color: "#8b949e33", fontSize: 10, marginTop: 16 }}>
        Data via Yahoo Finance · Prices delayed ~15min · Auto-refreshes every 30s · Not financial advice
      </p>
    </div>
  );
}
