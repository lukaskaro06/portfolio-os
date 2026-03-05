import { useState, useEffect, useCallback } from "react";
import { SectionLabel, Spinner } from "./UI";

// ── Sentiment scorer ───────────────────────────────────────
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
  let s   = 0;
  POS.forEach(w => { if (l.includes(w)) s += 1; });
  NEG.forEach(w => { if (l.includes(w)) s -= 1; });
  if (s >  1) return { label: "POSITIVE", color: "#00ff9d" };
  if (s < -1) return { label: "NEGATIVE", color: "#ff6b35" };
  return               { label: "NEUTRAL",  color: "#ffd700" };
}

const CORS = "https://api.allorigins.win/raw?url=";
const px   = (url) => `${CORS}${encodeURIComponent(url)}`;

// ── Deduplication helper ───────────────────────────────────
// Normalise title: lowercase, strip punctuation, collapse spaces
function normaliseTitle(title) {
  return title.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}
function deduplicateArticles(articles) {
  const seen = new Set();
  return articles.filter(a => {
    const key = normaliseTitle(a.title).slice(0, 80); // first 80 chars is enough
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseRSS(xmlText, feedLabel, feedCat, feedId) {
  try {
    const doc   = new DOMParser().parseFromString(xmlText, "text/xml");
    const items = Array.from(doc.querySelectorAll("item, entry")).slice(0, 15);
    return items.map((item, i) => {
      const title   = item.querySelector("title")?.textContent?.trim()       ?? "";
      const link    = item.querySelector("link")?.textContent?.trim()
                   ?? item.querySelector("link")?.getAttribute("href")
                   ?? item.querySelector("guid")?.textContent?.trim()        ?? "#";
      const desc    = (item.querySelector("description, summary, content")?.textContent ?? "")
                        .replace(/<[^>]+>/g, "").trim();
      const pubDate = item.querySelector("pubDate, published, updated")?.textContent?.trim() ?? "";
      return {
        id:      `${feedId}-${i}-${Date.now()}`,
        title,
        summary: desc.slice(0, 220),
        source:  feedLabel,
        feedId,
        cat:     feedCat,
        url:     link.startsWith("http") ? link : "#",
        time:    pubDate ? new Date(pubDate).toLocaleString() : "",
        rawDate: pubDate ? new Date(pubDate).getTime() : 0,
      };
    }).filter(a => a.title.length > 8);
  } catch { return []; }
}

const FEEDS = [
  { id: "reuters-biz",   label: "Reuters Business",      cat: "Finance",      url: "https://feeds.reuters.com/reuters/businessNews"        },
  { id: "reuters-money", label: "Reuters Markets",       cat: "Finance",      url: "https://feeds.reuters.com/reuters/moneyNews"           },
  { id: "cnbc-top",      label: "CNBC Top News",         cat: "Finance",      url: "https://www.cnbc.com/id/100003114/device/rss/rss.html" },
  { id: "cnbc-finance",  label: "CNBC Finance",          cat: "Finance",      url: "https://www.cnbc.com/id/10000664/device/rss/rss.html"  },
  { id: "marketwatch",   label: "MarketWatch",           cat: "Finance",      url: "https://feeds.marketwatch.com/marketwatch/topstories/" },
  { id: "yahoo-fin",     label: "Yahoo Finance",         cat: "Finance",      url: "https://finance.yahoo.com/news/rssindex"               },
  { id: "investing",     label: "Investing.com",         cat: "Finance",      url: "https://www.investing.com/rss/news.rss"                },
  { id: "wsj",           label: "WSJ Markets",           cat: "Finance",      url: "https://feeds.a.dj.com/rss/RSSMarketsMain.xml"         },
  { id: "economist-fin", label: "The Economist",         cat: "Finance",      url: "https://www.economist.com/finance-and-economics/rss.xml"},
  { id: "reuters-world", label: "Reuters World",         cat: "Geopolitical", url: "https://feeds.reuters.com/Reuters/worldNews"           },
  { id: "bbc-world",     label: "BBC World",             cat: "Geopolitical", url: "https://feeds.bbci.co.uk/news/world/rss.xml"           },
  { id: "bbc-biz",       label: "BBC Business",          cat: "Geopolitical", url: "https://feeds.bbci.co.uk/news/business/rss.xml"        },
  { id: "guardian-world",label: "Guardian World",        cat: "Geopolitical", url: "https://www.theguardian.com/world/rss"                 },
  { id: "guardian-biz",  label: "Guardian Business",     cat: "Geopolitical", url: "https://www.theguardian.com/business/rss"              },
  { id: "aljazeera",     label: "Al Jazeera",            cat: "Geopolitical", url: "https://www.aljazeera.com/xml/rss/all.xml"             },
  { id: "foreignpolicy", label: "Foreign Policy",        cat: "Geopolitical", url: "https://foreignpolicy.com/feed/"                      },
  { id: "ap-top",        label: "AP Top News",           cat: "Geopolitical", url: "https://rsshub.app/apnews/topics/apf-topnews"          },
  { id: "fed",           label: "Federal Reserve",       cat: "Macro",        url: "https://www.federalreserve.gov/feeds/press_all.xml"    },
  { id: "imf",           label: "IMF",                   cat: "Macro",        url: "https://www.imf.org/en/News/rss?language=eng"          },
  { id: "worldbank",     label: "World Bank",            cat: "Macro",        url: "https://feeds.worldbank.org/en/news/rss"               },
  { id: "ecb",           label: "European Central Bank", cat: "Macro",        url: "https://www.ecb.europa.eu/rss/press.html"              },
  { id: "economist-mac", label: "Economist Macro",       cat: "Macro",        url: "https://www.economist.com/the-world-this-week/rss.xml" },
  { id: "techcrunch",    label: "TechCrunch",            cat: "Tech",         url: "https://techcrunch.com/feed/"                         },
  { id: "verge",         label: "The Verge",             cat: "Tech",         url: "https://www.theverge.com/rss/index.xml"               },
  { id: "wired",         label: "Wired Business",        cat: "Tech",         url: "https://www.wired.com/feed/category/business/latest/rss"},
];

const CATEGORIES = ["All", "Finance", "Geopolitical", "Macro", "Tech"];

async function fetchFeed(feed) {
  const res = await fetch(px(feed.url), { signal: AbortSignal.timeout(9000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  return parseRSS(text, feed.label, feed.cat, feed.id);
}

function articleMentionsTicker(article, ticker, name) {
  const text = `${article.title} ${article.summary}`.toLowerCase();
  return text.includes(ticker.toLowerCase()) ||
    (name && name.split(" ")[0].length > 3 && text.includes(name.split(" ")[0].toLowerCase()));
}

// ── AI Summary — uses Anthropic API (same as claude.ai) ───
// This works because claude.ai artifacts have API access built in.
async function generateSummary(articles, context) {
  const headlines = articles
    .slice(0, 25)
    .map(a => `[${a.source}] ${a.title}`)
    .join("\n");

  const prompt = `You are a senior financial analyst at a top investment bank. Analyze these recent news headlines and write a concise market intelligence briefing.

Context: ${context}

Headlines:
${headlines}

Write a structured briefing with exactly these sections:
1. MARKET OVERVIEW — 2-3 sentences on the overall tone and dominant narrative
2. KEY THEMES — exactly 3 bullet points on the most important recurring themes  
3. RISKS TO WATCH — exactly 2 bullet points on the most significant risks
4. PORTFOLIO IMPLICATIONS — 1-2 sentences on what this means for equity investors

Use sharp, professional investment bank language. Be specific, not generic.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `API error ${res.status}`);
  }

  const data = await res.json();
  return data.content?.[0]?.text ?? "No summary returned.";
}

// ── Summary Panel ──────────────────────────────────────────
function SummaryPanel({ articles, category, ticker, holdings }) {
  const [summary,  setSummary]  = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const [expanded, setExpanded] = useState(true);

  const stock   = holdings.find(h => h.ticker === ticker);
  const context = ticker
    ? `Stock: ${ticker} — ${stock?.name ?? ""}`
    : `News category: ${category} (${articles.length} articles)`;

  const handleGenerate = async () => {
    if (!articles.length) return;
    setLoading(true);
    setError(null);
    setSummary(null);
    try {
      const text = await generateSummary(articles, context);
      setSummary(text);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Render formatted summary text
  const renderSummary = (text) => text.split("\n").map((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return <div key={i} style={{ height: 6 }} />;
    // Numbered section headers like "1. MARKET OVERVIEW"
    if (/^[1-4]\.\s/.test(trimmed)) {
      return (
        <div key={i} style={{ color: "#00ff9d", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", marginTop: 14, marginBottom: 6, borderBottom: "1px solid #00ff9d22", paddingBottom: 4 }}>
          {trimmed.toUpperCase()}
        </div>
      );
    }
    // Bullet points
    if (trimmed.startsWith("-") || trimmed.startsWith("•") || trimmed.startsWith("▸")) {
      return (
        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 5 }}>
          <span style={{ color: "#00ff9d", flexShrink: 0, marginTop: 2 }}>▸</span>
          <span style={{ color: "#c9d1d9", fontSize: 12, lineHeight: 1.75 }}>{trimmed.replace(/^[-•▸]\s*/, "")}</span>
        </div>
      );
    }
    return <p key={i} style={{ color: "#c9d1d9", fontSize: 12, lineHeight: 1.75, marginBottom: 4 }}>{trimmed}</p>;
  });

  return (
    <div style={{ background: "#0d1117", border: "1px solid #00ff9d22", borderRadius: 6, marginBottom: 20, overflow: "hidden" }}>
      {/* Header */}
      <div
        style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", background: "#00ff9d08", borderBottom: expanded ? "1px solid #1c2333" : "none", cursor: "pointer" }}
        onClick={() => setExpanded(v => !v)}
      >
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#00ff9d", boxShadow: "0 0 6px #00ff9d", display: "inline-block", flexShrink: 0 }} />
        <span style={{ color: "#00ff9d", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em" }}>AI MARKET BRIEFING</span>
        <span style={{ color: "#8b949e", fontSize: 11 }}>— {context}</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <button
            className="btn btn-primary"
            style={{ padding: "4px 14px", fontSize: 11 }}
            onClick={e => { e.stopPropagation(); handleGenerate(); }}
            disabled={loading || !articles.length}
          >
            {loading ? "ANALYSING…" : summary ? "↻ REGENERATE" : "▶ GENERATE BRIEFING"}
          </button>
          <span style={{ color: "#8b949e" }}>{expanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <div style={{ padding: "16px 18px" }}>
          {loading && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0" }}>
              <Spinner />
              <span style={{ color: "#8b949e", fontSize: 12 }}>Analysing {Math.min(articles.length, 25)} headlines with Claude…</span>
            </div>
          )}
          {error && (
            <div style={{ color: "#ff6b35", fontSize: 12, padding: "8px 0" }}>
              ⚠ {error}
              <span style={{ color: "#8b949e", marginLeft: 8 }}>
                (The AI briefing requires the app to be running inside claude.ai)
              </span>
            </div>
          )}
          {!loading && !summary && !error && (
            <div style={{ textAlign: "center", padding: "18px 0" }}>
              <p style={{ color: "#8b949e", fontSize: 12, marginBottom: 6 }}>
                Click <strong style={{ color: "#00ff9d" }}>▶ GENERATE BRIEFING</strong> for an AI-powered analyst summary
              </p>
              <p style={{ color: "#8b949e55", fontSize: 11 }}>Analyses up to 25 headlines · Key themes · Risks · Portfolio implications</p>
            </div>
          )}
          {!loading && summary && (
            <div className="fade-in">
              {renderSummary(summary)}
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #1c2333", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "#8b949e33", fontSize: 10 }}>Generated by Claude · {Math.min(articles.length, 25)} headlines · Not financial advice</span>
                <button className="btn btn-ghost" style={{ fontSize: 10, padding: "3px 10px" }} onClick={handleGenerate}>↻ REFRESH</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Article Card ───────────────────────────────────────────
function ArticleCard({ article }) {
  const s = scoreSentiment(article.title + " " + article.summary);
  return (
    <a href={article.url} target="_blank" rel="noreferrer" style={{ textDecoration: "none", display: "block" }}>
      <div
        style={{ padding: "11px 14px", borderBottom: "1px solid #0d1117", borderLeft: `3px solid ${s.color}`, transition: "background 0.1s" }}
        onMouseEnter={e => e.currentTarget.style.background = "#ffffff05"}
        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 4 }}>
          <span style={{ color: "#c9d1d9", fontSize: 12, fontWeight: 500, lineHeight: 1.5, flex: 1 }}>{article.title}</span>
          <span style={{ background: s.color + "18", color: s.color, border: `1px solid ${s.color}33`, padding: "1px 7px", borderRadius: 3, fontSize: 9, letterSpacing: "0.08em", whiteSpace: "nowrap", alignSelf: "flex-start" }}>
            {s.label}
          </span>
        </div>
        {article.summary && (
          <p style={{ color: "#8b949e", fontSize: 11, lineHeight: 1.6, marginBottom: 5 }}>
            {article.summary.slice(0, 180)}{article.summary.length > 180 ? "…" : ""}
          </p>
        )}
        <div style={{ display: "flex", gap: 12, fontSize: 10 }}>
          <span style={{ color: "#00ff9d77" }}>{article.source}</span>
          <span style={{ color: "#8b949e44" }}>{article.cat}</span>
          <span style={{ color: "#8b949e55", marginLeft: "auto" }}>{article.time}</span>
        </div>
      </div>
    </a>
  );
}

function SentimentSummary({ articles }) {
  if (!articles.length) return null;
  const pos   = articles.filter(a => scoreSentiment(a.title + a.summary).label === "POSITIVE").length;
  const neg   = articles.filter(a => scoreSentiment(a.title + a.summary).label === "NEGATIVE").length;
  const neu   = articles.length - pos - neg;
  const score = pos - neg;
  const color = score > 5 ? "#00ff9d" : score < -5 ? "#ff6b35" : "#ffd700";
  const label = score > 5 ? "BULLISH" : score < -5 ? "BEARISH" : "NEUTRAL";
  return (
    <div style={{ background: "#0d1117", border: `1px solid ${color}33`, borderRadius: 6, padding: "10px 16px", marginBottom: 14, display: "flex", alignItems: "center", gap: 20 }}>
      <div>
        <span style={{ color: "#8b949e", fontSize: 11 }}>SENTIMENT </span>
        <span style={{ color, fontWeight: 700, fontSize: 13, letterSpacing: "0.1em" }}>{label}</span>
      </div>
      <div style={{ flex: 1, height: 5, borderRadius: 3, overflow: "hidden", display: "flex" }}>
        <div style={{ width: `${pos / articles.length * 100}%`, background: "#00ff9d", transition: "width 0.4s" }} />
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

// ── Main ───────────────────────────────────────────────────
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
    setLoading(true);
    setAllArticles([]);
    setProgress(0);
    setFeedErrors([]);
    const errs     = [];
    const buffer   = [];   // collect all before dedup

    const promises = FEEDS.map(feed =>
      fetchFeed(feed)
        .then(articles => {
          setProgress(p => p + 1);
          buffer.push(...articles);
          // Deduplicate the full buffer on each update
          const deduped = deduplicateArticles(
            [...buffer].sort((a, b) => (b.rawDate || 0) - (a.rawDate || 0))
          );
          setAllArticles(deduped);
        })
        .catch(() => { setProgress(p => p + 1); errs.push(feed.label); })
    );

    await Promise.allSettled(promises);
    // Final dedup pass after everything loaded
    setAllArticles(prev => deduplicateArticles(prev));
    setFeedErrors(errs);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Filter pipeline
  let shown = allArticles;
  if (category !== "All")   shown = shown.filter(a => a.cat === category);
  if (activeFeed !== "all") shown = shown.filter(a => a.feedId === activeFeed);
  if (ticker) {
    const h = holdings.find(h => h.ticker === ticker);
    shown = shown.filter(a => articleMentionsTicker(a, ticker, h?.name));
  }
  if (search.trim()) {
    const q = search.toLowerCase();
    shown = shown.filter(a => a.title.toLowerCase().includes(q) || a.summary.toLowerCase().includes(q));
  }

  const feedsInCat = category === "All" ? FEEDS : FEEDS.filter(f => f.cat === category);

  return (
    <div>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: 16, gap: 12 }}>
        <SectionLabel>Live News & Sentiment</SectionLabel>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          {loading
            ? <span style={{ color: "#8b949e", fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}><Spinner /> {progress}/{FEEDS.length} sources</span>
            : <span style={{ color: "#00ff9d", fontSize: 11 }}>✓ {allArticles.length} articles · {FEEDS.length - feedErrors.length} sources</span>
          }
          <button onClick={fetchAll} disabled={loading} className="btn btn-ghost" style={{ fontSize: 11, padding: "5px 12px" }}>↻ REFRESH</button>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        {CATEGORIES.map(c => (
          <button key={c} className={`btn ${category === c ? "btn-primary" : "btn-ghost"}`}
            style={{ padding: "5px 12px", fontSize: 11 }}
            onClick={() => { setCategory(c); setActiveFeed("all"); }}>
            {c.toUpperCase()}
          </button>
        ))}
        {holdings.length > 0 && (
          <select className="input-dark" value={ticker} onChange={e => setTicker(e.target.value)} style={{ fontSize: 11, padding: "5px 10px" }}>
            <option value="">All stocks</option>
            {holdings.map(h => <option key={h.ticker} value={h.ticker}>{h.ticker} — {h.name}</option>)}
          </select>
        )}
        <input className="input-dark" style={{ flex: 1, minWidth: 180, fontSize: 11 }}
          placeholder="Search headlines…" value={search} onChange={e => setSearch(e.target.value)} />
        <span style={{ color: "#8b949e", fontSize: 11 }}>{shown.length} results</span>
      </div>

      {/* Source chips */}
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 14 }}>
        {[{ id: "all", label: "ALL SOURCES" }, ...feedsInCat].map(f => (
          <button key={f.id} onClick={() => setActiveFeed(f.id)} style={{
            cursor: "pointer", fontFamily: "inherit", fontSize: 10,
            background: activeFeed === f.id ? "#00ff9d22" : "transparent",
            color:      activeFeed === f.id ? "#00ff9d"   : "#8b949e66",
            border:     `1px solid ${activeFeed === f.id ? "#00ff9d44" : "#1c233366"}`,
            padding: "2px 8px", borderRadius: 3,
          }}>
            {f.label || "ALL SOURCES"}
          </button>
        ))}
      </div>

      {/* AI Summary */}
      <SummaryPanel articles={shown} category={category} ticker={ticker} holdings={holdings} />

      {/* Sentiment bar */}
      <SentimentSummary articles={shown} />

      {/* Errors */}
      {feedErrors.length > 0 && !loading && (
        <div style={{ background: "#ffd70010", border: "1px solid #ffd70022", borderRadius: 4, padding: "7px 12px", marginBottom: 12, fontSize: 10, color: "#ffd70088" }}>
          ⚠ {feedErrors.length} sources blocked/rate-limited: {feedErrors.slice(0, 5).join(", ")}{feedErrors.length > 5 ? ` +${feedErrors.length - 5}` : ""}
        </div>
      )}

      {/* Feed */}
      <div style={{ background: "#0d1117", border: "1px solid #1c2333", borderRadius: 6, overflow: "hidden" }}>
        {loading && allArticles.length === 0 && (
          <div style={{ padding: 48, textAlign: "center" }}>
            <Spinner />
            <p style={{ color: "#8b949e", fontSize: 12, marginTop: 12 }}>Loading {FEEDS.length} news sources…</p>
            <p style={{ color: "#8b949e44", fontSize: 11, marginTop: 4 }}>Reuters · BBC · FT · WSJ · CNBC · Al Jazeera · Guardian · Fed · IMF…</p>
          </div>
        )}
        {!loading && shown.length === 0 && allArticles.length > 0 && (
          <p style={{ padding: 40, textAlign: "center", color: "#8b949e" }}>No articles match your filters.</p>
        )}
        {shown.slice(0, 80).map(a => <ArticleCard key={a.id} article={a} />)}
        {shown.length > 80 && (
          <div style={{ padding: 12, textAlign: "center", color: "#8b949e55", fontSize: 11, borderTop: "1px solid #1c2333" }}>
            Showing 80 of {shown.length} — narrow with filters above
          </div>
        )}
      </div>
      <p style={{ color: "#8b949e33", fontSize: 10, marginTop: 8 }}>
        Reuters · BBC · FT · WSJ · CNBC · MarketWatch · Yahoo Finance · Al Jazeera · Guardian · Foreign Policy · AP · Fed · IMF · World Bank · ECB · Economist · TechCrunch · Verge · Wired
      </p>
    </div>
  );
}
