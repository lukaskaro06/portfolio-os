import { useState, useEffect, useCallback } from "react";
import { SectionLabel, Spinner } from "./UI";

const POS = ["beat","surge","rally","growth","profit","record","upgrade","buy","strong",
  "gain","rise","higher","outperform","bullish","positive","exceed","revenue","earnings",
  "dividend","acquisition","expansion","partnership","breakthrough","optimistic","recovery",
  "rebound","boom","jumped","soared","climbed","lifted","boosted","improved","upgraded"];
const NEG = ["miss","drop","fall","loss","decline","downgrade","sell","weak","lower",
  "underperform","bearish","negative","warning","risk","debt","lawsuit","investigation",
  "recall","layoff","cut","bankruptcy","fraud","concern","disappointing","shortfall",
  "headwind","volatile","crash","plunge","slump","tumble","sank","collapsed","crisis",
  "conflict","war","attack","sanction","recession","inflation","default"];

function scoreSentiment(text) {
  const l = (text || "").toLowerCase();
  let s = 0;
  POS.forEach(w => { if (l.includes(w)) s += 1; });
  NEG.forEach(w => { if (l.includes(w)) s -= 1; });
  if (s >  1) return { label: "POSITIVE", color: "#00ff9d" };
  if (s < -1) return { label: "NEGATIVE", color: "#ff6b35" };
  return               { label: "NEUTRAL",  color: "#ffd700" };
}

// Multiple CORS proxies — tried in order until one works
const PROXIES = [
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  (url) => `https://thingproxy.freeboard.io/fetch/${url}`,
];

async function fetchWithFallback(url) {
  for (const proxy of PROXIES) {
    try {
      const res = await fetch(proxy(url), { signal: AbortSignal.timeout(7000) });
      if (res.ok) {
        const text = await res.text();
        if (text.length > 100) return text;
      }
    } catch { /* try next */ }
  }
  throw new Error("All proxies failed");
}

function normaliseTitle(t) {
  return t.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim().slice(0, 80);
}
function dedup(articles) {
  const seen = new Set();
  return articles.filter(a => {
    const k = normaliseTitle(a.title);
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });
}

function parseRSS(xml, label, cat, feedId) {
  try {
    const doc   = new DOMParser().parseFromString(xml, "text/xml");
    const items = Array.from(doc.querySelectorAll("item, entry")).slice(0, 15);
    return items.map((item, i) => {
      const title   = item.querySelector("title")?.textContent?.trim() ?? "";
      const link    = item.querySelector("link")?.textContent?.trim()
                   ?? item.querySelector("link")?.getAttribute("href")
                   ?? item.querySelector("guid")?.textContent?.trim() ?? "#";
      const desc    = (item.querySelector("description,summary,content")?.textContent ?? "")
                        .replace(/<[^>]+>/g, "").trim();
      const pubDate = item.querySelector("pubDate,published,updated")?.textContent?.trim() ?? "";
      return {
        id: `${feedId}-${i}-${Date.now()}`, title,
        summary: desc.slice(0, 220), source: label, feedId, cat,
        url: link.startsWith("http") ? link : "#",
        time: pubDate ? new Date(pubDate).toLocaleString() : "",
        rawDate: pubDate ? new Date(pubDate).getTime() : 0,
      };
    }).filter(a => a.title.length > 8);
  } catch { return []; }
}

// Feeds — mix of direct RSS + RSSHub mirrors for blocked ones
const FEEDS = [
  // Finance — direct RSS
  { id: "economist-fin", label: "The Economist",        cat: "Finance",      url: "https://www.economist.com/finance-and-economics/rss.xml" },
  { id: "economist-wk",  label: "Economist World",      cat: "Finance",      url: "https://www.economist.com/the-world-this-week/rss.xml"   },
  { id: "investing",     label: "Investing.com",        cat: "Finance",      url: "https://www.investing.com/rss/news.rss"                  },
  { id: "yahoo-fin",     label: "Yahoo Finance",        cat: "Finance",      url: "https://finance.yahoo.com/news/rssindex"                 },
  { id: "marketwatch",   label: "MarketWatch",          cat: "Finance",      url: "https://feeds.marketwatch.com/marketwatch/topstories/"   },
  // Finance — via RSSHub (more reliable on Vercel)
  { id: "cnbc-hub",      label: "CNBC Markets",         cat: "Finance",      url: "https://rsshub.app/cnbc/money"                          },
  { id: "bloomberg-hub", label: "Bloomberg",            cat: "Finance",      url: "https://rsshub.app/bloomberg/markets"                   },
  { id: "ft-hub",        label: "Financial Times",      cat: "Finance",      url: "https://rsshub.app/ft/myft/following"                   },
  { id: "wsj-hub",       label: "WSJ",                  cat: "Finance",      url: "https://rsshub.app/wsj/news/latest"                     },
  { id: "seekingalpha",  label: "Seeking Alpha",        cat: "Finance",      url: "https://rsshub.app/seekingalpha/market-news"            },

  // Geopolitical — direct RSS
  { id: "bbc-world",     label: "BBC World",            cat: "Geopolitical", url: "https://feeds.bbci.co.uk/news/world/rss.xml"            },
  { id: "bbc-biz",       label: "BBC Business",         cat: "Geopolitical", url: "https://feeds.bbci.co.uk/news/business/rss.xml"         },
  { id: "guardian-world",label: "Guardian World",       cat: "Geopolitical", url: "https://www.theguardian.com/world/rss"                  },
  { id: "guardian-biz",  label: "Guardian Business",    cat: "Geopolitical", url: "https://www.theguardian.com/business/rss"               },
  { id: "aljazeera",     label: "Al Jazeera",           cat: "Geopolitical", url: "https://www.aljazeera.com/xml/rss/all.xml"              },
  { id: "foreignpolicy", label: "Foreign Policy",       cat: "Geopolitical", url: "https://foreignpolicy.com/feed/"                       },
  // Geopolitical — via RSSHub
  { id: "reuters-w-hub", label: "Reuters World",        cat: "Geopolitical", url: "https://rsshub.app/reuters/world"                      },
  { id: "ap-hub",        label: "AP News",              cat: "Geopolitical", url: "https://rsshub.app/apnews/topics/apf-topnews"          },
  { id: "nyt-world",     label: "NYT World",            cat: "Geopolitical", url: "https://rsshub.app/nytimes/world"                      },

  // Macro
  { id: "fed",           label: "Federal Reserve",      cat: "Macro",        url: "https://www.federalreserve.gov/feeds/press_all.xml"     },
  { id: "imf",           label: "IMF",                  cat: "Macro",        url: "https://www.imf.org/en/News/rss?language=eng"           },
  { id: "ecb",           label: "ECB",                  cat: "Macro",        url: "https://www.ecb.europa.eu/rss/press.html"               },
  { id: "worldbank",     label: "World Bank",           cat: "Macro",        url: "https://feeds.worldbank.org/en/news/rss"                },
  { id: "bis-hub",       label: "BIS",                  cat: "Macro",        url: "https://rsshub.app/bis/speeches"                       },

  // Tech
  { id: "techcrunch",    label: "TechCrunch",           cat: "Tech",         url: "https://techcrunch.com/feed/"                          },
  { id: "verge",         label: "The Verge",            cat: "Tech",         url: "https://www.theverge.com/rss/index.xml"                },
  { id: "ars",           label: "Ars Technica",         cat: "Tech",         url: "https://feeds.arstechnica.com/arstechnica/index"        },
  { id: "wired",         label: "Wired",                cat: "Tech",         url: "https://www.wired.com/feed/category/business/latest/rss"},
];

const CATEGORIES = ["All", "Finance", "Geopolitical", "Macro", "Tech"];

async function fetchFeed(feed) {
  const text = await fetchWithFallback(feed.url);
  return parseRSS(text, feed.label, feed.cat, feed.id);
}

function articleMentionsTicker(article, ticker, name) {
  const text = `${article.title} ${article.summary}`.toLowerCase();
  return text.includes(ticker.toLowerCase()) ||
    (name && name.split(" ")[0].length > 3 && text.includes(name.split(" ")[0].toLowerCase()));
}

async function generateSummary(articles, context) {
  const headlines = articles.slice(0, 25).map(a => `[${a.source}] ${a.title}`).join("\n");
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [{ role: "user", content: "You are a Managing Director at Goldman Sachs writing a detailed morning market intelligence briefing.\n\nContext: " + context + "\n\nToday's Headlines (" + articles.length + " sources):\n" + headlines + "\n\nWrite a comprehensive briefing with these sections:\n\n1. EXECUTIVE SUMMARY\n- 3-4 sentences on the key market narrative.\n\n2. MARKET OVERVIEW & KEY INDICES\n- Overall market direction and momentum.\n- Equity, fixed income, FX, commodity moves.\n- Risk-on or risk-off environment and why.\n\n3. SECTOR BREAKDOWN\n- Tech, Energy, Financials, Consumer, Healthcare, Industrials.\n- For each: what is happening, why it matters, bullish/bearish/neutral.\n\n4. GEOPOLITICAL & MACRO RISKS\n- All geopolitical flashpoints visible in headlines.\n- Rate each: HIGH / MEDIUM / LOW impact.\n- Transmission mechanism to markets.\n\n5. CENTRAL BANK & POLICY WATCH\n- Fed, ECB, BOJ signals.\n- Implications for rates, yield curve, USD.\n\n6. PORTFOLIO IMPLICATIONS\n- Actionable insights for a portfolio manager.\n- Sectors to overweight / underweight.\n- Key hedging considerations.\n\n7. RISKS TO THE NARRATIVE\n- What could invalidate the thesis?\n- Key events to watch in next 48-72 hours.\n\nWrite at least 600 words. Be specific and professional." }],
    }),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const data = await res.json();
  return data.content?.[0]?.text ?? "No summary returned.";
}

function SummaryPanel({ articles, category, ticker, holdings }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [open,    setOpen]    = useState(true);
  const stock   = holdings.find(h => h.ticker === ticker);
  const context = ticker ? `Stock: ${ticker} — ${stock?.name ?? ""}` : `Category: ${category} (${articles.length} articles)`;

  const run = async () => {
    if (!articles.length) return;
    setLoading(true); setError(null); setSummary(null);
    try { setSummary(await generateSummary(articles, context)); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const render = (text) => text.split("\n").map((line, i) => {
    const t = line.trim();
    if (!t) return <div key={i} style={{ height: 6 }} />;
    if (/^[1-4]\.\s/.test(t)) return <div key={i} style={{ color: "#00ff9d", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", marginTop: 14, marginBottom: 6, borderBottom: "1px solid #00ff9d22", paddingBottom: 4 }}>{t.toUpperCase()}</div>;
    if (/^[-•▸]/.test(t)) return <div key={i} style={{ display: "flex", gap: 8, marginBottom: 5 }}><span style={{ color: "#00ff9d", flexShrink: 0 }}>▸</span><span style={{ color: "#c9d1d9", fontSize: 12, lineHeight: 1.75 }}>{t.replace(/^[-•▸]\s*/, "")}</span></div>;
    return <p key={i} style={{ color: "#c9d1d9", fontSize: 12, lineHeight: 1.75, marginBottom: 4 }}>{t}</p>;
  });

  return (
    <div style={{ background: "#0d1117", border: "1px solid #00ff9d22", borderRadius: 6, marginBottom: 20, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", background: "#00ff9d08", borderBottom: open ? "1px solid #1c2333" : "none", cursor: "pointer" }} onClick={() => setOpen(v => !v)}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#00ff9d", boxShadow: "0 0 6px #00ff9d", display: "inline-block" }} />
        <span style={{ color: "#00ff9d", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em" }}>AI MARKET BRIEFING</span>
        <span style={{ color: "#8b949e", fontSize: 11 }}>— {context}</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <button className="btn btn-primary" style={{ padding: "4px 14px", fontSize: 11 }} onClick={e => { e.stopPropagation(); run(); }} disabled={loading || !articles.length}>
            {loading ? "ANALYSING…" : summary ? "↻ REGENERATE" : "▶ GENERATE BRIEFING"}
          </button>
          <span style={{ color: "#8b949e" }}>{open ? "▲" : "▼"}</span>
        </div>
      </div>
      {open && (
        <div style={{ padding: "16px 18px" }}>
          {loading && <div style={{ display: "flex", alignItems: "center", gap: 12 }}><Spinner /><span style={{ color: "#8b949e", fontSize: 12 }}>Analysing {Math.min(articles.length, 25)} headlines…</span></div>}
          {error   && <p style={{ color: "#ff6b35", fontSize: 12 }}>⚠ {error}</p>}
          {!loading && !summary && !error && (
            <div style={{ textAlign: "center", padding: "18px 0" }}>
              <p style={{ color: "#8b949e", fontSize: 12, marginBottom: 6 }}>Click <strong style={{ color: "#00ff9d" }}>▶ GENERATE BRIEFING</strong> for an AI-powered analyst summary</p>
              <p style={{ color: "#8b949e55", fontSize: 11 }}>Key themes · Risks · Portfolio implications</p>
            </div>
          )}
          {!loading && summary && <div className="fade-in">{render(summary)}<div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #1c2333", display: "flex", justifyContent: "space-between" }}><span style={{ color: "#8b949e33", fontSize: 10 }}>Generated by Claude · Not financial advice</span><button className="btn btn-ghost" style={{ fontSize: 10, padding: "3px 10px" }} onClick={run}>↻ REFRESH</button></div></div>}
        </div>
      )}
    </div>
  );
}

function ArticleCard({ article }) {
  const s = scoreSentiment(article.title + " " + article.summary);
  return (
    <a href={article.url} target="_blank" rel="noreferrer" style={{ textDecoration: "none", display: "block" }}>
      <div style={{ padding: "11px 14px", borderBottom: "1px solid #0d1117", borderLeft: `3px solid ${s.color}`, transition: "background 0.1s" }}
        onMouseEnter={e => e.currentTarget.style.background = "#ffffff05"}
        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 4 }}>
          <span style={{ color: "#c9d1d9", fontSize: 12, fontWeight: 500, lineHeight: 1.5, flex: 1 }}>{article.title}</span>
          <span style={{ background: s.color + "18", color: s.color, border: `1px solid ${s.color}33`, padding: "1px 7px", borderRadius: 3, fontSize: 9, letterSpacing: "0.08em", whiteSpace: "nowrap", alignSelf: "flex-start" }}>{s.label}</span>
        </div>
        {article.summary && <p style={{ color: "#8b949e", fontSize: 11, lineHeight: 1.6, marginBottom: 5 }}>{article.summary.slice(0, 180)}{article.summary.length > 180 ? "…" : ""}</p>}
        <div style={{ display: "flex", gap: 12, fontSize: 10 }}>
          <span style={{ color: "#00ff9d77" }}>{article.source}</span>
          <span style={{ color: "#8b949e44" }}>{article.cat}</span>
          <span style={{ color: "#8b949e55", marginLeft: "auto" }}>{article.time}</span>
        </div>
      </div>
    </a>
  );
}

function SentimentBar({ articles }) {
  if (!articles.length) return null;
  const pos = articles.filter(a => scoreSentiment(a.title + a.summary).label === "POSITIVE").length;
  const neg = articles.filter(a => scoreSentiment(a.title + a.summary).label === "NEGATIVE").length;
  const neu = articles.length - pos - neg;
  const score = pos - neg;
  const color = score > 5 ? "#00ff9d" : score < -5 ? "#ff6b35" : "#ffd700";
  const label = score > 5 ? "BULLISH" : score < -5 ? "BEARISH" : "NEUTRAL";
  return (
    <div style={{ background: "#0d1117", border: `1px solid ${color}33`, borderRadius: 6, padding: "10px 16px", marginBottom: 14, display: "flex", alignItems: "center", gap: 20 }}>
      <div><span style={{ color: "#8b949e", fontSize: 11 }}>SENTIMENT </span><span style={{ color, fontWeight: 700, fontSize: 13, letterSpacing: "0.1em" }}>{label}</span></div>
      <div style={{ flex: 1, height: 5, borderRadius: 3, overflow: "hidden", display: "flex" }}>
        <div style={{ width: `${pos / articles.length * 100}%`, background: "#00ff9d" }} />
        <div style={{ width: `${neu / articles.length * 100}%`, background: "#ffd700" }} />
        <div style={{ width: `${neg / articles.length * 100}%`, background: "#ff6b35" }} />
      </div>
      <div style={{ display: "flex", gap: 14, fontSize: 11 }}>
        <span style={{ color: "#00ff9d" }}>▲ {pos}</span>
        <span style={{ color: "#ffd700" }}>{neu}</span>
        <span style={{ color: "#ff6b35" }}>▼ {neg}</span>
      </div>
    </div>
  );
}

export default function NewsSentiment({ holdings }) {
  const [allArticles, setAllArticles] = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [progress,    setProgress]    = useState(0);
  const [feedErrors,  setFeedErrors]  = useState([]);
  const [category,    setCategory]    = useState("All");
  const [activeFeed,  setActiveFeed]  = useState("all");
  const [ticker,      setTicker]      = useState("");
  const [search,      setSearch]      = useState("");

  const fetchAll = useCallback(async () => {
    setLoading(true); setAllArticles([]); setProgress(0); setFeedErrors([]);
    const errs = []; const buffer = [];
    const promises = FEEDS.map(feed =>
      fetchFeed(feed).then(articles => {
        setProgress(p => p + 1);
        buffer.push(...articles);
        setAllArticles(dedup([...buffer].sort((a, b) => (b.rawDate || 0) - (a.rawDate || 0))));
      }).catch(() => { setProgress(p => p + 1); errs.push(feed.label); })
    );
    await Promise.allSettled(promises);
    setAllArticles(prev => dedup(prev));
    setFeedErrors(errs); setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  let shown = allArticles;
  if (category !== "All")   shown = shown.filter(a => a.cat === category);
  if (activeFeed !== "all") shown = shown.filter(a => a.feedId === activeFeed);
  if (ticker) { const h = holdings.find(h => h.ticker === ticker); shown = shown.filter(a => articleMentionsTicker(a, ticker, h?.name)); }
  if (search.trim()) { const q = search.toLowerCase(); shown = shown.filter(a => a.title.toLowerCase().includes(q) || a.summary.toLowerCase().includes(q)); }

  const feedsInCat = category === "All" ? FEEDS : FEEDS.filter(f => f.cat === category);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 16, gap: 12 }}>
        <SectionLabel>Live News & Sentiment</SectionLabel>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          {loading ? <span style={{ color: "#8b949e", fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}><Spinner /> {progress}/{FEEDS.length} sources</span>
                   : <span style={{ color: "#00ff9d", fontSize: 11 }}>✓ {allArticles.length} articles · {FEEDS.length - feedErrors.length} sources</span>}
          <button onClick={fetchAll} disabled={loading} className="btn btn-ghost" style={{ fontSize: 11, padding: "5px 12px" }}>↻ REFRESH</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        {CATEGORIES.map(c => <button key={c} className={`btn ${category === c ? "btn-primary" : "btn-ghost"}`} style={{ padding: "5px 12px", fontSize: 11 }} onClick={() => { setCategory(c); setActiveFeed("all"); }}>{c.toUpperCase()}</button>)}
        {holdings.length > 0 && <select className="input-dark" value={ticker} onChange={e => setTicker(e.target.value)} style={{ fontSize: 11, padding: "5px 10px" }}><option value="">All stocks</option>{holdings.map(h => <option key={h.ticker} value={h.ticker}>{h.ticker} — {h.name}</option>)}</select>}
        <input className="input-dark" style={{ flex: 1, minWidth: 180, fontSize: 11 }} placeholder="Search headlines…" value={search} onChange={e => setSearch(e.target.value)} />
        <span style={{ color: "#8b949e", fontSize: 11 }}>{shown.length} results</span>
      </div>

      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 14 }}>
        {[{ id: "all", label: "ALL SOURCES" }, ...feedsInCat].map(f => (
          <button key={f.id} onClick={() => setActiveFeed(f.id)} style={{ cursor: "pointer", fontFamily: "inherit", fontSize: 10, background: activeFeed === f.id ? "#00ff9d22" : "transparent", color: activeFeed === f.id ? "#00ff9d" : "#8b949e66", border: `1px solid ${activeFeed === f.id ? "#00ff9d44" : "#1c233366"}`, padding: "2px 8px", borderRadius: 3 }}>
            {f.label || "ALL SOURCES"}
          </button>
        ))}
      </div>

      <SummaryPanel articles={shown} category={category} ticker={ticker} holdings={holdings} />
      <SentimentBar articles={shown} />

      {feedErrors.length > 0 && !loading && (
        <div style={{ background: "#ffd70010", border: "1px solid #ffd70022", borderRadius: 4, padding: "7px 12px", marginBottom: 12, fontSize: 10, color: "#ffd70088" }}>
          ⚠ {feedErrors.length} sources unavailable: {feedErrors.slice(0, 5).join(", ")}{feedErrors.length > 5 ? ` +${feedErrors.length - 5}` : ""}
        </div>
      )}

      <div style={{ background: "#0d1117", border: "1px solid #1c2333", borderRadius: 6, overflow: "hidden" }}>
        {loading && allArticles.length === 0 && <div style={{ padding: 48, textAlign: "center" }}><Spinner /><p style={{ color: "#8b949e", fontSize: 12, marginTop: 12 }}>Loading {FEEDS.length} news sources…</p><p style={{ color: "#8b949e44", fontSize: 11, marginTop: 4 }}>BBC · Economist · Guardian · Al Jazeera · FT · Bloomberg · Fed · IMF…</p></div>}
        {!loading && shown.length === 0 && allArticles.length > 0 && <p style={{ padding: 40, textAlign: "center", color: "#8b949e" }}>No articles match your filters.</p>}
        {shown.slice(0, 80).map(a => <ArticleCard key={a.id} article={a} />)}
        {shown.length > 80 && <div style={{ padding: 12, textAlign: "center", color: "#8b949e55", fontSize: 11, borderTop: "1px solid #1c2333" }}>Showing 80 of {shown.length} — use filters to narrow</div>}
      </div>
      <p style={{ color: "#8b949e33", fontSize: 10, marginTop: 8 }}>BBC · Economist · Guardian · Al Jazeera · Foreign Policy · Yahoo Finance · MarketWatch · Bloomberg · Reuters · FT · WSJ · Fed · IMF · ECB · TechCrunch · Verge · Wired</p>
    </div>
  );
}
