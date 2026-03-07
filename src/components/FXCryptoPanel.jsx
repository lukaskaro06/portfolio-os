// src/components/FXCryptoPanel.jsx
// Forex: Yahoo Finance pairs
// Crypto: CoinGecko (no API key needed)
// Fear & Greed: alternative.me (free)

import { useState, useEffect, useCallback } from "react";
import { SectionLabel, Spinner } from "./UI";
import { proxyUrl } from "../hooks/useStockData";
import { ResponsiveContainer, AreaChart, Area, YAxis, Tooltip } from "recharts";

const fmtN = (n, d = 4) => (n == null ? "—" : (+n).toFixed(d));

// ── Forex pairs ────────────────────────────────────────────
const FX_PAIRS = [
  { pair: "EURUSD=X", label: "EUR/USD", desc: "Euro / US Dollar" },
  { pair: "GBPUSD=X", label: "GBP/USD", desc: "British Pound / US Dollar" },
  { pair: "USDJPY=X", label: "USD/JPY", desc: "US Dollar / Japanese Yen" },
  { pair: "USDCHF=X", label: "USD/CHF", desc: "US Dollar / Swiss Franc" },
  { pair: "AUDUSD=X", label: "AUD/USD", desc: "Australian Dollar / US Dollar" },
  { pair: "USDCAD=X", label: "USD/CAD", desc: "US Dollar / Canadian Dollar" },
  { pair: "NZDUSD=X", label: "NZD/USD", desc: "New Zealand Dollar / US Dollar" },
  { pair: "USDCNH=X", label: "USD/CNH", desc: "US Dollar / Chinese Yuan" },
  { pair: "EURGBP=X", label: "EUR/GBP", desc: "Euro / British Pound" },
  { pair: "EURJPY=X", label: "EUR/JPY", desc: "Euro / Japanese Yen" },
  { pair: "GBPJPY=X", label: "GBP/JPY", desc: "British Pound / Japanese Yen" },
  { pair: "USDMXN=X", label: "USD/MXN", desc: "US Dollar / Mexican Peso" },
  { pair: "USDINR=X", label: "USD/INR", desc: "US Dollar / Indian Rupee" },
  { pair: "USDKRW=X", label: "USD/KRW", desc: "US Dollar / South Korean Won" },
  { pair: "DX-Y.NYB", label: "DXY",     desc: "US Dollar Index" },
];

async function fetchFXQuote(pair) {
  try {
    const url  = `https://query1.finance.yahoo.com/v8/finance/chart/${pair}?interval=1d&range=1d`;
    const res  = await fetch(proxyUrl(url));
    if (!res.ok) return null;
    const json = await res.json();
    const meta = json?.chart?.result?.[0]?.meta;
    if (!meta) return null;
    const price = meta.regularMarketPrice;
    const prev  = meta.chartPreviousClose || price;
    const chg   = price - prev;
    return { pair, price: +price, change: +chg.toFixed(5), changePct: +((chg/prev)*100).toFixed(3), positive: chg >= 0 };
  } catch { return null; }
}

// ── CoinGecko ──────────────────────────────────────────────
async function fetchCryptoMarkets(page = 1) {
  try {
    const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=${page}&sparkline=true&price_change_percentage=1h,24h,7d`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("CoinGecko rate limit");
    return await res.json();
  } catch { return []; }
}

async function fetchGlobalCrypto() {
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/global");
    if (!res.ok) return null;
    return (await res.json())?.data;
  } catch { return null; }
}

async function fetchFearGreed() {
  try {
    const res = await fetch("https://api.alternative.me/fng/?limit=1");
    if (!res.ok) return null;
    return (await res.json())?.data?.[0];
  } catch { return null; }
}

// ── Mini spark for crypto ──────────────────────────────────
function CryptoSpark({ data, positive }) {
  const c = positive ? "#00ff9d" : "#ff6b35";
  if (!data?.length) return <div style={{ width: 70, height: 28 }} />;
  const chartData = data.map((v, i) => ({ v, i }));
  return (
    <ResponsiveContainer width={70} height={28}>
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id={`cs${positive?"u":"d"}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={c} stopOpacity={0.3} />
            <stop offset="95%" stopColor={c} stopOpacity={0}   />
          </linearGradient>
        </defs>
        <YAxis domain={["auto","auto"]} hide />
        <Area type="monotone" dataKey="v" stroke={c} fill={`url(#cs${positive?"u":"d"})`} strokeWidth={1.2} dot={false} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── Main ───────────────────────────────────────────────────
export default function FXCryptoPanel() {
  const [activeTab, setActiveTab] = useState("crypto");
  const [fxQuotes,  setFxQuotes]  = useState({});
  const [fxLoading, setFxLoading] = useState(false);
  const [crypto,    setCrypto]    = useState([]);
  const [global,    setGlobal]    = useState(null);
  const [fearGreed, setFearGreed] = useState(null);
  const [cryptoLoading, setCryptoLoading] = useState(false);
  const [sortBy,    setSortBy]    = useState("market_cap");
  const [search,    setSearch]    = useState("");

  // Load crypto on mount
  useEffect(() => {
    const load = async () => {
      setCryptoLoading(true);
      const [coins, g, fg] = await Promise.all([
        fetchCryptoMarkets(1),
        fetchGlobalCrypto(),
        fetchFearGreed(),
      ]);
      setCrypto(coins);
      setGlobal(g);
      setFearGreed(fg);
      setCryptoLoading(false);
    };
    load();
  }, []);

  // Load FX when tab switches
  useEffect(() => {
    if (activeTab !== "forex") return;
    if (Object.keys(fxQuotes).length > 0) return; // already loaded
    const load = async () => {
      setFxLoading(true);
      for (const fx of FX_PAIRS) {
        const q = await fetchFXQuote(fx.pair);
        if (q) setFxQuotes(prev => ({ ...prev, [fx.pair]: q }));
        await new Promise(r => setTimeout(r, 200));
      }
      setFxLoading(false);
    };
    load();
  }, [activeTab]);

  const fgVal   = fearGreed ? parseInt(fearGreed.value) : 50;
  const fgColor = fgVal > 65 ? "#00ff9d" : fgVal > 45 ? "#ffd700" : fgVal > 25 ? "#ff6b35" : "#ff2d2d";

  const totalMarketCap = global?.total_market_cap?.usd;
  const btcDominance   = global?.market_cap_percentage?.btc;
  const ethDominance   = global?.market_cap_percentage?.eth;

  const fmt$ = n => {
    if (!n) return "—";
    if (n >= 1e12) return `$${(n/1e12).toFixed(2)}T`;
    if (n >= 1e9)  return `$${(n/1e9).toFixed(2)}B`;
    if (n >= 1e6)  return `$${(n/1e6).toFixed(2)}M`;
    return `$${n.toFixed(2)}`;
  };

  const filteredCrypto = crypto
    .filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.symbol.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "market_cap") return b.market_cap - a.market_cap;
      if (sortBy === "price")      return b.current_price - a.current_price;
      if (sortBy === "change_24h") return b.price_change_percentage_24h - a.price_change_percentage_24h;
      if (sortBy === "volume")     return b.total_volume - a.total_volume;
      return 0;
    });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
        <SectionLabel>FX & Crypto</SectionLabel>

        {/* Global stats */}
        {totalMarketCap && (
          <>
            <div style={{ background: "#0d1117", border: "1px solid #1c2333", borderRadius: 4, padding: "4px 12px", fontSize: 11 }}>
              <span style={{ color: "#8b949e" }}>Total Crypto Cap </span>
              <span style={{ color: "#fff", fontFamily: "monospace", fontWeight: 700 }}>{fmt$(totalMarketCap)}</span>
            </div>
            <div style={{ background: "#0d1117", border: "1px solid #1c2333", borderRadius: 4, padding: "4px 12px", fontSize: 11 }}>
              <span style={{ color: "#f7931a" }}>BTC </span>
              <span style={{ color: "#fff", fontFamily: "monospace", fontWeight: 700 }}>{btcDominance?.toFixed(1)}%</span>
            </div>
            <div style={{ background: "#0d1117", border: "1px solid #1c2333", borderRadius: 4, padding: "4px 12px", fontSize: 11 }}>
              <span style={{ color: "#627eea" }}>ETH </span>
              <span style={{ color: "#fff", fontFamily: "monospace", fontWeight: 700 }}>{ethDominance?.toFixed(1)}%</span>
            </div>
          </>
        )}

        {/* Fear & Greed */}
        {fearGreed && (
          <div style={{ background: "#0d1117", border: `1px solid ${fgColor}44`, borderRadius: 4, padding: "4px 12px" }}>
            <span style={{ color: "#8b949e", fontSize: 10 }}>CRYPTO F&G </span>
            <span style={{ color: fgColor, fontFamily: "monospace", fontWeight: 700, fontSize: 14 }}>{fearGreed.value}</span>
            <span style={{ color: fgColor, fontSize: 10, marginLeft: 6 }}>{fearGreed.value_classification}</span>
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", borderBottom: "1px solid #1c2333", marginBottom: 16 }}>
        {["crypto", "forex"].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            background: "transparent", border: "none",
            borderBottom: `2px solid ${activeTab === tab ? "#00ff9d" : "transparent"}`,
            color: activeTab === tab ? "#00ff9d" : "#8b949e",
            padding: "8px 16px", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase",
            fontFamily: "inherit", cursor: "pointer", transition: "all 0.15s", marginBottom: -1,
          }}>{tab}</button>
        ))}
      </div>

      {/* ── CRYPTO TAB ─────────────────────────────────────── */}
      {activeTab === "crypto" && (
        <>
          {/* Controls */}
          <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#0d1117", border: "1px solid #1c2333", borderRadius: 6, padding: "6px 12px" }}>
              <span style={{ color: "#8b949e" }}>⌕</span>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search coin…"
                style={{ background: "transparent", border: "none", color: "#c9d1d9", fontSize: 12, outline: "none", width: 140 }} />
            </div>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}
              style={{ background: "#0d1117", border: "1px solid #1c2333", color: "#c9d1d9", padding: "6px 10px", borderRadius: 6, fontSize: 11, fontFamily: "inherit" }}>
              <option value="market_cap">Sort: Market Cap</option>
              <option value="change_24h">Sort: 24h Change</option>
              <option value="volume">Sort: Volume</option>
              <option value="price">Sort: Price</option>
            </select>
            {cryptoLoading && <Spinner />}
            <span style={{ color: "#8b949e44", fontSize: 10, marginLeft: "auto" }}>via CoinGecko · no API key</span>
          </div>

          {/* Table header */}
          <div style={{ background: "#060a0f", border: "1px solid #1c2333", borderRadius: "6px 6px 0 0" }}>
            <div style={{ display: "grid", gridTemplateColumns: "36px 1fr 110px 90px 90px 90px 120px 90px", padding: "8px 14px", borderBottom: "1px solid #1c2333" }}>
              {["#","NAME","PRICE","1H","24H","7D","MARKET CAP","7D CHART"].map(h => (
                <span key={h} style={{ color: "#8b949e", fontSize: 10, fontWeight: 700, letterSpacing: "0.07em" }}>{h}</span>
              ))}
            </div>
          </div>

          <div style={{ border: "1px solid #1c2333", borderTop: "none", borderRadius: "0 0 6px 6px", overflow: "hidden" }}>
            {filteredCrypto.length === 0 && !cryptoLoading ? (
              <div style={{ padding: "32px 14px", textAlign: "center", color: "#8b949e" }}>
                {search ? `No coins match "${search}"` : "Loading…"}
              </div>
            ) : filteredCrypto.map((coin, i) => {
              const c24  = coin.price_change_percentage_24h ?? 0;
              const c1h  = coin.price_change_percentage_1h_in_currency ?? 0;
              const c7d  = coin.price_change_percentage_7d_in_currency ?? 0;
              const clr  = v => v >= 0 ? "#00ff9d" : "#ff6b35";
              const pct  = v => <span style={{ color: clr(v), fontFamily: "monospace", fontSize: 11, fontWeight: v >= 0 ? 600 : 400 }}>{v >= 0 ? "▲" : "▼"} {Math.abs(v).toFixed(2)}%</span>;
              return (
                <div key={coin.id} style={{ display: "grid", gridTemplateColumns: "36px 1fr 110px 90px 90px 90px 120px 90px", padding: "10px 14px", borderBottom: "1px solid #1c233333", alignItems: "center", transition: "background 0.1s" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#ffffff04"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <span style={{ color: "#8b949e44", fontSize: 11 }}>{i + 1}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <img src={coin.image} alt={coin.name} width={22} height={22} style={{ borderRadius: "50%" }} onError={e => e.target.style.display = "none"} />
                    <div>
                      <div style={{ color: "#c9d1d9", fontSize: 12, fontWeight: 600 }}>{coin.name}</div>
                      <div style={{ color: "#8b949e", fontSize: 10, fontFamily: "monospace" }}>{coin.symbol?.toUpperCase()}</div>
                    </div>
                  </div>
                  <span style={{ color: "#fff", fontFamily: "monospace", fontSize: 12, fontWeight: 700 }}>
                    ${coin.current_price?.toLocaleString(undefined, { minimumFractionDigits: coin.current_price > 1 ? 2 : 6, maximumFractionDigits: coin.current_price > 1 ? 2 : 8 })}
                  </span>
                  {pct(c1h)}
                  {pct(c24)}
                  {pct(c7d)}
                  <span style={{ color: "#8b949e", fontFamily: "monospace", fontSize: 11 }}>{fmt$(coin.market_cap)}</span>
                  <CryptoSpark data={coin.sparkline_in_7d?.price} positive={c7d >= 0} />
                </div>
              );
            })}
          </div>
          {crypto.length === 0 && !cryptoLoading && (
            <div style={{ padding: "24px", textAlign: "center", color: "#8b949e", fontSize: 12 }}>
              CoinGecko rate limit reached. <a href="https://www.coingecko.com" target="_blank" rel="noreferrer" style={{ color: "#00c8ff" }}>View on CoinGecko →</a>
            </div>
          )}
        </>
      )}

      {/* ── FOREX TAB ──────────────────────────────────────── */}
      {activeTab === "forex" && (
        <>
          <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "center" }}>
            {fxLoading && <><Spinner /><span style={{ color: "#8b949e", fontSize: 11 }}>Loading FX quotes…</span></>}
            <span style={{ color: "#8b949e44", fontSize: 10, marginLeft: "auto" }}>via Yahoo Finance · ~15min delay</span>
          </div>

          <div style={{ background: "#060a0f", border: "1px solid #1c2333", borderRadius: 6, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 130px 100px 100px", padding: "8px 16px", borderBottom: "1px solid #1c2333" }}>
              {["PAIR","DESCRIPTION","RATE","CHANGE","CHG %"].map(h => (
                <span key={h} style={{ color: "#8b949e", fontSize: 10, fontWeight: 700, letterSpacing: "0.07em" }}>{h}</span>
              ))}
            </div>
            {FX_PAIRS.map(fx => {
              const q = fxQuotes[fx.pair];
              return (
                <div key={fx.pair} style={{ display: "grid", gridTemplateColumns: "120px 1fr 130px 100px 100px", padding: "11px 16px", borderBottom: "1px solid #1c233333", alignItems: "center", transition: "background 0.1s" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#ffffff04"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <span style={{ color: "#00ff9d", fontFamily: "monospace", fontSize: 13, fontWeight: 800 }}>{fx.label}</span>
                  <span style={{ color: "#8b949e", fontSize: 11 }}>{fx.desc}</span>
                  {q ? (
                    <>
                      <span style={{ color: "#fff", fontFamily: "monospace", fontSize: 13, fontWeight: 600 }}>{fmtN(q.price, fx.pair.includes("JPY") || fx.pair.includes("KRW") ? 2 : 4)}</span>
                      <span style={{ color: q.positive ? "#00ff9d" : "#ff6b35", fontFamily: "monospace", fontSize: 11 }}>
                        {q.positive ? "+" : ""}{fmtN(q.change, 5)}
                      </span>
                      <span style={{ color: q.positive ? "#00ff9d" : "#ff6b35", fontFamily: "monospace", fontSize: 11, fontWeight: 700 }}>
                        {q.positive ? "▲" : "▼"} {Math.abs(q.changePct).toFixed(3)}%
                      </span>
                    </>
                  ) : (
                    <><span style={{ color: "#8b949e" }}><Spinner /></span><span /><span /></>
                  )}
                </div>
              );
            })}
          </div>

          {/* Central bank reference */}
          <div style={{ background: "#0d1117", border: "1px solid #1c2333", borderRadius: 6, padding: "14px 16px", marginTop: 16 }}>
            <div style={{ color: "#8b949e", fontSize: 10, letterSpacing: "0.08em", marginBottom: 10 }}>CENTRAL BANK RATES (REFERENCE)</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
              {[
                ["Fed (USD)",  "4.25–4.50%", "#ffd700"],
                ["ECB (EUR)",  "3.15%",       "#00c8ff"],
                ["BOE (GBP)",  "4.50%",       "#c084fc"],
                ["BOJ (JPY)",  "0.50%",       "#ff6b35"],
                ["SNB (CHF)",  "0.50%",       "#00ff9d"],
                ["RBA (AUD)",  "4.10%",       "#f97316"],
                ["BOC (CAD)",  "3.00%",       "#ef4444"],
                ["PBOC (CNY)", "3.10%",       "#fbbf24"],
              ].map(([bank, rate, color]) => (
                <div key={bank} style={{ textAlign: "center", padding: "8px", background: "#060a0f", borderRadius: 4, border: "1px solid #1c2333" }}>
                  <div style={{ color: "#8b949e", fontSize: 9 }}>{bank}</div>
                  <div style={{ color, fontFamily: "monospace", fontWeight: 700, fontSize: 14 }}>{rate}</div>
                </div>
              ))}
            </div>
            <div style={{ color: "#8b949e33", fontSize: 9, marginTop: 8 }}>Rates as of early 2025 — verify current rates from central bank websites</div>
          </div>
        </>
      )}

      <p style={{ color: "#8b949e33", fontSize: 10, marginTop: 20 }}>
        Crypto: CoinGecko · FX: Yahoo Finance · Not financial advice
      </p>
    </div>
  );
}
