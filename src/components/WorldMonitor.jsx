import { useState, useEffect, useRef, useCallback } from "react";

// ── WorldMonitor — Enhanced with News Integration + Bloomberg Live ──────────
// Features:
//   • Leaflet (OpenStreetMap) — interactive map
//   • ReliefWeb API          — live crisis alerts
//   • RSS Feeds              — live news (BBC, Reuters, Al Jazeera, FT, Bloomberg…)
//   • Groq API               — AI news → hotspot impact analysis (llama-3.3-70b-versatile)
//   • Bloomberg Live         — embedded live stream + recordings

// ── Groq API config ─────────────────────────────────────────────────────────
// Set your Groq API key here or pass it via props/env
const GROQ_API_KEY = typeof process !== "undefined" && process.env?.REACT_APP_GROQ_API_KEY
  ? process.env.REACT_APP_GROQ_API_KEY
  : (typeof window !== "undefined" && window.__GROQ_API_KEY)
  ? window.__GROQ_API_KEY
  : "";   // ← paste your key here as fallback: "gsk_..."

const GROQ_MODEL = "llama-3.3-70b-versatile";

const RELIEF_WEB = "https://api.reliefweb.int/v1";

const riskColor = (level) => ({
  critical: "#ff2d2d",
  high:     "#ff6b35",
  medium:   "#ffd700",
  low:      "#00ff9d",
  none:     "#8b949e",
}[level] ?? "#8b949e");

const HOTSPOTS = [
  { id: "ukraine",    name: "Ukraine / Russia",   lat: 49.0,  lon: 31.0,  risk: "critical", category: "Armed Conflict",  detail: "Active war zone. NATO involvement. Energy supply disruption.", keywords: ["ukraine","russia","moscow","kyiv","zelensky","putin","nato","dnipro"] },
  { id: "mideast",    name: "Middle East",         lat: 29.0,  lon: 42.0,  risk: "critical", category: "Geopolitical",    detail: "Regional escalation. Shipping disruption via Red Sea.",          keywords: ["israel","gaza","hamas","hezbollah","red sea","iran","lebanon","houthi","yemen","west bank"] },
  { id: "taiwan",     name: "Taiwan Strait",       lat: 23.7,  lon: 120.9, risk: "high",     category: "Geopolitical",    detail: "China-Taiwan tensions. Semiconductor supply chain risk.",         keywords: ["taiwan","tsmc","strait","pla","beijing","taipei","chip","semiconductor"] },
  { id: "southchina", name: "South China Sea",     lat: 12.0,  lon: 114.0, risk: "high",     category: "Maritime",        detail: "Disputed waters. Trade route tensions.",                          keywords: ["south china sea","philippine","spratly","paracel","beijing","indo-pacific"] },
  { id: "sahel",      name: "Sahel Region",        lat: 15.0,  lon: 2.0,   risk: "high",     category: "Armed Conflict",  detail: "Multiple coups. Jihadist insurgency spreading.",                  keywords: ["sahel","mali","niger","burkina","coup","jihadist","wagner","africa"] },
  { id: "northkorea", name: "Korean Peninsula",    lat: 37.5,  lon: 127.0, risk: "high",     category: "Nuclear",         detail: "DPRK missile tests. Nuclear escalation risk.",                    keywords: ["north korea","dprk","kim jong","pyongyang","missile","nuclear","icbm"] },
  { id: "iran",       name: "Iran",                lat: 32.0,  lon: 53.0,  risk: "high",     category: "Sanctions",       detail: "Nuclear programme. Strait of Hormuz leverage.",                   keywords: ["iran","tehran","hormuz","irgc","nuclear deal","rouhani","khamenei","sanction"] },
  { id: "venezuela",  name: "Venezuela",           lat: 8.0,   lon: -66.0, risk: "medium",   category: "Political",       detail: "Election disputes. US sanctions. Oil sector risk.",                keywords: ["venezuela","maduro","caracas","pdvsa","guaido","sanction","oil","bolivar"] },
  { id: "myanmar",    name: "Myanmar",             lat: 17.0,  lon: 96.0,  risk: "medium",   category: "Armed Conflict",  detail: "Military junta. Civil war ongoing.",                               keywords: ["myanmar","burma","junta","tatmadaw","rohingya","coup","yangon"] },
  { id: "ethiopia",   name: "Ethiopia / Horn",     lat: 8.0,   lon: 38.0,  risk: "medium",   category: "Humanitarian",    detail: "Tigray aftermath. Regional food insecurity.",                     keywords: ["ethiopia","tigray","horn of africa","addis","famine","drought","somalia"] },
  { id: "pakistan",   name: "Pakistan",            lat: 30.0,  lon: 70.0,  risk: "medium",   category: "Political",       detail: "Political instability. Nuclear state.",                            keywords: ["pakistan","islamabad","imran khan","isi","india-pakistan","kashmir","nuclear"] },
  { id: "haiti",      name: "Haiti",               lat: 19.0,  lon: -72.0, risk: "medium",   category: "Humanitarian",    detail: "Gang control. State collapse risk.",                               keywords: ["haiti","port-au-prince","gang","humanitarian","cholera","moise"] },
];

const MARKET_STRESS = [
  { label: "VIX",          value: "18.4",  change: "+2.1",  color: "#ffd700" },
  { label: "Gold $/oz",    value: "2,345", change: "+0.8%", color: "#ffd700" },
  { label: "DXY",          value: "104.2", change: "-0.3%", color: "#00ff9d" },
  { label: "WTI $/bbl",    value: "78.4",  change: "+1.2%", color: "#ff6b35" },
  { label: "10Y UST",      value: "4.42%", change: "-0.04", color: "#00ff9d" },
  { label: "BDI",          value: "1,840", change: "-3.1%", color: "#ff6b35" },
];

const TICKER_GEO = {
  AAPL: ["taiwan","southchina"], MSFT: ["ukraine"], XOM: ["mideast","iran"],
  JPM:  ["ukraine","mideast"],   NVDA: ["taiwan","southchina"], AMZN: ["mideast"],
  TSM:  ["taiwan","southchina"], V:    ["ukraine","mideast"],   HD:   [], PG: ["ukraine"],
  JNJ:  [], NEE: [], META: ["ukraine"], BRK: [], UNH: [],
};

// ── RSS feeds for geopolitical / finance news ────────────────────────────
const GEO_FEEDS = [
  { id: "bbc-world",    label: "BBC World",     url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
  { id: "aljazeera",   label: "Al Jazeera",    url: "https://www.aljazeera.com/xml/rss/all.xml" },
  { id: "reuters-hub", label: "Reuters",       url: "https://rsshub.app/reuters/world" },
  { id: "guardian",    label: "Guardian",      url: "https://www.theguardian.com/world/rss" },
  { id: "bloomberg",   label: "Bloomberg",     url: "https://rsshub.app/bloomberg/markets" },
  { id: "ft-hub",      label: "FT",            url: "https://rsshub.app/ft/myft/following" },
  { id: "fp",          label: "Foreign Policy",url: "https://foreignpolicy.com/feed/" },
];

const PROXIES = [
  (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
];

async function fetchWithFallback(url) {
  for (const proxy of PROXIES) {
    try {
      const res = await fetch(proxy(url), { signal: AbortSignal.timeout(7000) });
      if (res.ok) { const t = await res.text(); if (t.length > 100) return t; }
    } catch { /* next */ }
  }
  return null;
}

function parseRSS(xml, label, feedId) {
  try {
    const doc = new DOMParser().parseFromString(xml, "text/xml");
    return Array.from(doc.querySelectorAll("item, entry")).slice(0, 10).map((item, i) => {
      const title   = item.querySelector("title")?.textContent?.trim() ?? "";
      const link    = item.querySelector("link")?.textContent?.trim() ?? item.querySelector("link")?.getAttribute("href") ?? "#";
      const desc    = (item.querySelector("description,summary,content")?.textContent ?? "").replace(/<[^>]+>/g,"").trim();
      const pubDate = item.querySelector("pubDate,published,updated")?.textContent?.trim() ?? "";
      return {
        id: `${feedId}-${i}`, title, summary: desc.slice(0,200),
        source: label, url: link.startsWith("http") ? link : "#",
        time: pubDate ? new Date(pubDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "",
        rawDate: pubDate ? new Date(pubDate).getTime() : 0,
      };
    }).filter(a => a.title.length > 8);
  } catch { return []; }
}

// Map articles → affected hotspots
function articleToHotspots(article) {
  const text = `${article.title} ${article.summary}`.toLowerCase();
  return HOTSPOTS.filter(h => h.keywords.some(k => text.includes(k)));
}

// Simple sentiment
const POS_WORDS = ["rally","gain","rise","growth","beat","surge","recovery","upgrade","deal","ceasefire","agreement","peace"];
const NEG_WORDS = ["war","attack","crisis","sanction","conflict","crash","collapse","escalate","threat","bomb","missile","coup","strike","tension"];
function sentiment(text) {
  const l = text.toLowerCase();
  let s = 0;
  POS_WORDS.forEach(w => { if (l.includes(w)) s++; });
  NEG_WORDS.forEach(w => { if (l.includes(w)) s--; });
  if (s > 0)  return { label: "POS", color: "#00ff9d" };
  if (s < 0)  return { label: "NEG", color: "#ff2d2d" };
  return           { label: "NEU", color: "#ffd700" };
}

// Bloomberg live/recordings config
// Uses Bloomberg's public YouTube channel for live + curated playlist
const BLOOMBERG_LIVE_URL = "https://www.youtube.com/embed/dp8PhLsUcFE?autoplay=0&rel=0&modestbranding=1";
const BLOOMBERG_RECORDINGS = [
  { id: "1", title: "Bloomberg Markets: Americas", desc: "Daily market open coverage",          yt: "dp8PhLsUcFE" },
  { id: "2", title: "Bloomberg Surveillance",      desc: "Morning macro & central bank watch",  yt: "8KQBeObTEAA" },
  { id: "3", title: "Bloomberg Technology",        desc: "Tech sector & AI developments",       yt: "5RnrHX68G7k" },
  { id: "4", title: "Bloomberg The Open",          desc: "Pre-market analysis & catalysts",     yt: "6WdIBqutMdk" },
  { id: "5", title: "Bloomberg Markets Full",      desc: "Extended markets coverage",           yt: "dp8PhLsUcFE" },
];

// ── AI analysis via Groq API ─────────────────────────────────────────────────
async function groqChat(systemPrompt, userPrompt, maxTokens = 1024) {
  if (!GROQ_API_KEY) throw new Error("Groq API key not set. Add it to GROQ_API_KEY in the file or window.__GROQ_API_KEY.");
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      max_tokens: maxTokens,
      temperature: 0.4,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userPrompt },
      ],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Groq API ${res.status}: ${err?.error?.message ?? res.statusText}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function analyzeNewsImpact(articles, hotspot) {
  const headlines = articles.slice(0, 15).map(a => `[${a.source}] ${a.title}`).join("\n");
  return groqChat(
    "You are a geopolitical risk analyst at a macro hedge fund. Be concise, specific, and professional.",
    `Based on these recent headlines, provide a brief 3-4 sentence risk assessment for "${hotspot.name}" and its current market impact. Be specific about any escalation or de-escalation signals. Respond with just the assessment, no headers.\n\nHeadlines:\n${headlines}`,
    512
  );
}

async function generateGlobalBriefing(articles) {
  const headlines = articles.slice(0, 20).map(a => `[${a.source}] ${a.title}`).join("\n");
  return groqChat(
    "You are a geopolitical risk analyst at a macro hedge fund. Write sharp, specific, actionable intelligence. No fluff.",
    `Based on today's headlines, write a concise GLOBAL RISK BRIEFING covering:\n\n1. TOP 3 RISK DEVELOPMENTS (what changed today)\n2. MARKET TRANSMISSION (how these risks affect equities, FX, commodities)\n3. WATCH LIST (events in next 24-48h that could escalate)\n\nMax 300 words.\n\nHeadlines:\n${headlines}`,
    800
  );
}

export default function WorldMonitor({ holdings = [] }) {
  const mapRef     = useRef(null);
  const leafletMap = useRef(null);
  const markersRef = useRef([]);

  const [mapLoaded,      setMapLoaded]      = useState(false);
  const [selected,       setSelected]       = useState(null);
  const [activeLayer,    setActiveLayer]    = useState("all");
  const [ticker,         setTicker]         = useState(null);
  const [alerts,         setAlerts]         = useState([]);
  const [loadingAlerts,  setLoadingAlerts]  = useState(true);

  // News state
  const [newsArticles,   setNewsArticles]   = useState([]);
  const [loadingNews,    setLoadingNews]    = useState(true);
  const [hotspotNews,    setHotspotNews]    = useState({});   // hotspot.id → articles[]
  const [rightTab,       setRightTab]       = useState("alerts"); // alerts | news | bloomberg

  // AI state
  const [aiAnalysis,     setAiAnalysis]     = useState(null);
  const [aiLoading,      setAiLoading]      = useState(false);
  const [briefing,       setBriefing]       = useState(null);
  const [briefingLoading,setBriefingLoading]= useState(false);

  // Bloomberg state
  const [bloombergTab,   setBloombergTab]   = useState("live");
  const [selectedRec,    setSelectedRec]    = useState(BLOOMBERG_RECORDINGS[0]);

  // ── Load Leaflet ────────────────────────────────────────────────────────
  useEffect(() => {
    if (window.L) { setMapLoaded(true); return; }
    const link = document.createElement("link");
    link.rel = "stylesheet"; link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => setMapLoaded(true);
    document.head.appendChild(script);
  }, []);

  // ── Init map ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || leafletMap.current) return;
    const L = window.L;
    leafletMap.current = L.map(mapRef.current, { center: [20, 10], zoom: 2, zoomControl: true, attributionControl: false });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { maxZoom: 18 }).addTo(leafletMap.current);
    return () => { if (leafletMap.current) { leafletMap.current.remove(); leafletMap.current = null; } };
  }, [mapLoaded]);

  // ── Add markers ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded || !leafletMap.current) return;
    const L = window.L;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    const visible = activeLayer === "all" ? HOTSPOTS : HOTSPOTS.filter(h => h.category.toLowerCase().includes(activeLayer));
    visible.forEach(spot => {
      const color = riskColor(spot.risk);
      const newsCount = (hotspotNews[spot.id] ?? []).length;
      const hasNews = newsCount > 0;
      const isExposed = ticker ? (TICKER_GEO[ticker] ?? []).includes(spot.id) : false;
      const size = isExposed ? 22 : hasNews ? 18 : 14;
      const icon = L.divIcon({
        html: `<div style="width:${size}px;height:${size}px;background:${color};border-radius:50%;border:2px solid ${isExposed ? "#fff" : color+"88"};box-shadow:0 0 ${isExposed ? 14 : hasNews ? 10 : 6}px ${color};cursor:pointer;animation:pulse-marker 2s infinite;position:relative;">
          ${hasNews ? `<div style="position:absolute;top:-6px;right:-6px;background:#ff2d2d;color:#fff;font-size:8px;font-weight:700;width:14px;height:14px;border-radius:50%;display:flex;align-items:center;justify-content:center;">${Math.min(newsCount,9)}</div>` : ""}
        </div>`,
        className: "", iconSize: [size, size], iconAnchor: [size/2, size/2],
      });
      const marker = L.marker([spot.lat, spot.lon], { icon })
        .addTo(leafletMap.current)
        .on("click", () => { setSelected(spot); setRightTab("alerts"); });
      markersRef.current.push(marker);
    });
  }, [mapLoaded, activeLayer, ticker, hotspotNews]);

  // ── Fetch ReliefWeb alerts ───────────────────────────────────────────────
  useEffect(() => {
    async function fetchAlerts() {
      setLoadingAlerts(true);
      try {
        const res = await fetch(`${RELIEF_WEB}/disasters?appname=portfolio-os&limit=12&fields[include][]=name&fields[include][]=status&fields[include][]=date&fields[include][]=country&fields[include][]=type&filter[operator]=AND&filter[conditions][0][field]=status&filter[conditions][0][value]=alert&sort[]=date:desc`);
        const data = await res.json();
        setAlerts((data?.data ?? []).map(d => ({
          id: d.id,
          name:    d.fields?.name ?? "Unknown Event",
          status:  d.fields?.status ?? "alert",
          date:    d.fields?.date?.created?.slice(0, 10) ?? "",
          country: d.fields?.country?.[0]?.name ?? "Unknown",
          type:    d.fields?.type?.[0]?.name ?? "Disaster",
        })));
      } catch {
        setAlerts([
          { id: 1, name: "Red Sea Shipping Crisis",     country: "Yemen",     type: "Complex Emergency", date: "2025-01-15" },
          { id: 2, name: "Ukraine Humanitarian Crisis", country: "Ukraine",   type: "Armed Conflict",    date: "2025-01-10" },
          { id: 3, name: "Sudan Civil War",             country: "Sudan",     type: "Armed Conflict",    date: "2025-01-08" },
          { id: 4, name: "Gaza Humanitarian Emergency", country: "Palestine", type: "Complex Emergency", date: "2025-01-05" },
          { id: 5, name: "Myanmar Conflict Escalation", country: "Myanmar",   type: "Armed Conflict",    date: "2025-01-03" },
          { id: 6, name: "Haiti Security Crisis",       country: "Haiti",     type: "Complex Emergency", date: "2024-12-28" },
        ]);
      } finally { setLoadingAlerts(false); }
    }
    fetchAlerts();
  }, []);

  // ── Fetch live news from RSS feeds ───────────────────────────────────────
  const fetchNews = useCallback(async () => {
    setLoadingNews(true);
    const allArticles = [];
    await Promise.allSettled(
      GEO_FEEDS.map(feed =>
        fetchWithFallback(feed.url).then(xml => {
          if (xml) allArticles.push(...parseRSS(xml, feed.label, feed.id));
        })
      )
    );
    // Sort by date
    const sorted = allArticles.sort((a, b) => (b.rawDate || 0) - (a.rawDate || 0));
    // Deduplicate
    const seen = new Set();
    const deduped = sorted.filter(a => {
      const k = a.title.toLowerCase().slice(0, 60);
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });
    setNewsArticles(deduped);
    // Map to hotspots
    const byHotspot = {};
    deduped.forEach(article => {
      articleToHotspots(article).forEach(h => {
        if (!byHotspot[h.id]) byHotspot[h.id] = [];
        if (byHotspot[h.id].length < 8) byHotspot[h.id].push(article);
      });
    });
    setHotspotNews(byHotspot);
    setLoadingNews(false);
  }, []);

  useEffect(() => { fetchNews(); }, [fetchNews]);

  // Auto-refresh news every 5 minutes
  useEffect(() => {
    const interval = setInterval(fetchNews, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchNews]);

  // ── AI: Analyze selected hotspot ────────────────────────────────────────
  const runHotspotAnalysis = useCallback(async (spot) => {
    const articles = hotspotNews[spot.id] ?? newsArticles.filter(a => articleToHotspots(a).find(h => h.id === spot.id));
    if (!articles.length) return;
    setAiLoading(true); setAiAnalysis(null);
    try {
      const analysis = await analyzeNewsImpact(articles, spot);
      setAiAnalysis(analysis);
    } catch (e) {
      setAiAnalysis(`Analysis unavailable: ${e.message}`);
    } finally { setAiLoading(false); }
  }, [hotspotNews, newsArticles]);

  // ── AI: Global briefing ──────────────────────────────────────────────────
  const runGlobalBriefing = useCallback(async () => {
    if (!newsArticles.length) return;
    setBriefingLoading(true); setBriefing(null);
    try {
      const text = await generateGlobalBriefing(newsArticles);
      setBriefing(text);
    } catch (e) {
      setBriefing(`Briefing unavailable: ${e.message}`);
    } finally { setBriefingLoading(false); }
  }, [newsArticles]);

  // ── Portfolio exposure ───────────────────────────────────────────────────
  const exposureData = holdings.map(h => {
    const exposed  = (TICKER_GEO[h.ticker] ?? []);
    const hotspots = exposed.map(id => HOTSPOTS.find(s => s.id === id)).filter(Boolean);
    const maxRisk  = hotspots.reduce((max, s) => {
      const o = { critical: 4, high: 3, medium: 2, low: 1, none: 0 };
      return o[s.risk] > o[max] ? s.risk : max;
    }, "none");
    return { ...h, exposed, hotspots, maxRisk };
  }).sort((a, b) => ({ critical: 4, high: 3, medium: 2, low: 1, none: 0 }[b.maxRisk] - { critical: 4, high: 3, medium: 2, low: 1, none: 0 }[a.maxRisk]));

  const riskCounts = {
    critical: HOTSPOTS.filter(h => h.risk === "critical").length,
    high:     HOTSPOTS.filter(h => h.risk === "high").length,
    medium:   HOTSPOTS.filter(h => h.risk === "medium").length,
  };

  const layers = ["all","conflict","geopolitical","maritime","nuclear","sanctions","humanitarian","political"];

  // When selecting a hotspot, run analysis if news available
  const handleSelectHotspot = (spot) => {
    setSelected(spot);
    setAiAnalysis(null);
    setRightTab("alerts");
  };

  const selectedHotspotNews = selected ? (hotspotNews[selected.id] ?? []) : [];

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 0, height: "calc(100vh - 120px)", minHeight: 600, fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&display=swap');
        @keyframes pulse-marker { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.7; transform:scale(1.3); } }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
        .alert-row:hover { background: #00ff9d08 !important; }
        .tab-btn { cursor:pointer; font-family:inherit; font-size:10px; letter-spacing:0.08em; padding:5px 12px; border-radius:3px; border:1px solid #1c2333; background:transparent; color:#8b949e; transition:all 0.15s; }
        .tab-btn.active { background:#00ff9d18; color:#00ff9d; border-color:#00ff9d44; }
        .tab-btn:hover:not(.active) { color:#c9d1d9; border-color:#2c3440; }
        .news-item { padding:10px 14px; border-bottom:1px solid #0d1117; cursor:pointer; transition:background 0.1s; animation:fadeIn 0.3s ease; }
        .news-item:hover { background:#ffffff05; }
        .blink { animation:blink 1.5s infinite; }
        .spin { animation:spin 1s linear infinite; }
        @keyframes spin { to { transform:rotate(360deg); } }
        .scroll-thin::-webkit-scrollbar { width:4px; } .scroll-thin::-webkit-scrollbar-track { background:transparent; } .scroll-thin::-webkit-scrollbar-thumb { background:#1c2333; border-radius:2px; }
        .layer-btn { cursor:pointer; font-family:inherit; font-size:10px; letter-spacing:0.06em; text-transform:uppercase; padding:3px 10px; border-radius:3px; transition:all 0.15s; }
        .ticker-tag { background:#00ff9d15; color:#00ff9d; border:1px solid #00ff9d33; padding:1px 7px; border-radius:3px; font-size:10px; font-weight:600; }
        .rec-item { padding:10px 12px; border-radius:4px; cursor:pointer; transition:all 0.15s; border:1px solid transparent; }
        .rec-item:hover { background:#ffffff05; border-color:#1c2333; }
        .rec-item.active { background:#ffd70010; border-color:#ffd70033; }
      `}</style>

      {/* ── LEFT: Map + controls ─────────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", borderRight: "1px solid #1c2333" }}>

        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", borderBottom: "1px solid #1c2333", background: "#0a0e14", flexWrap: "wrap" }}>
          <span style={{ color: "#8b949e", fontSize: 10, letterSpacing: "0.08em" }}>LAYERS</span>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {layers.map(l => (
              <button key={l} className="layer-btn" onClick={() => setActiveLayer(l)} style={{ background: activeLayer===l ? "#00ff9d22" : "transparent", color: activeLayer===l ? "#00ff9d" : "#8b949e", border: `1px solid ${activeLayer===l ? "#00ff9d44" : "#1c2333"}` }}>{l}</button>
            ))}
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 12, fontSize: 10, alignItems: "center" }}>
            {/* News loading indicator */}
            {loadingNews ? (
              <span style={{ color: "#8b949e", fontSize: 10, display: "flex", alignItems: "center", gap: 5 }}>
                <div className="spin" style={{ width: 10, height: 10, border: "1.5px solid #1c2333", borderTopColor: "#ffd700", borderRadius: "50%", flexShrink: 0 }} />
                Fetching news…
              </span>
            ) : (
              <span style={{ color: "#00ff9d66", fontSize: 10 }}>✓ {newsArticles.length} articles</span>
            )}
            {["critical","high","medium","low"].map(r => (
              <span key={r} style={{ display: "flex", alignItems: "center", gap: 4, color: "#8b949e" }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: riskColor(r), display: "inline-block", boxShadow: `0 0 4px ${riskColor(r)}` }} />
                {r.toUpperCase()}
              </span>
            ))}
          </div>
        </div>

        {/* Map */}
        <div style={{ flex: 1, position: "relative" }}>
          <div ref={mapRef} style={{ width: "100%", height: "100%" }} />

          {/* AI Global Briefing button */}
          <div style={{ position: "absolute", top: 12, right: 12, zIndex: 1000 }}>
            <button
              onClick={runGlobalBriefing}
              disabled={briefingLoading || !newsArticles.length}
              style={{
                background: briefingLoading ? "#0d1117" : "#00ff9d15",
                border: "1px solid #00ff9d44",
                color: "#00ff9d",
                padding: "7px 14px",
                borderRadius: 4,
                fontFamily: "inherit",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.1em",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 7,
                boxShadow: "0 0 12px #00ff9d22",
              }}
            >
              {briefingLoading ? (
                <><div className="spin" style={{ width: 10, height: 10, border: "1.5px solid #0d1117", borderTopColor: "#00ff9d", borderRadius: "50%" }} /> BRIEFING…</>
              ) : (
                <>▶ AI GLOBAL BRIEFING</>
              )}
            </button>
          </div>

          {/* Global briefing overlay */}
          {briefing && (
            <div style={{
              position: "absolute", top: 52, right: 12, zIndex: 1000,
              background: "#0d1117f5", border: "1px solid #00ff9d33",
              borderRadius: 6, padding: "14px 16px", maxWidth: 340,
              boxShadow: "0 0 24px #00ff9d15",
              animation: "fadeIn 0.3s ease",
              maxHeight: 320, overflowY: "auto",
            }} className="scroll-thin">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ color: "#00ff9d", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em" }}>AI GLOBAL BRIEFING</span>
                <button onClick={() => setBriefing(null)} style={{ background: "none", border: "none", color: "#8b949e", cursor: "pointer", fontSize: 14 }}>×</button>
              </div>
              {briefing.split("\n").map((line, i) => {
                const t = line.trim();
                if (!t) return <div key={i} style={{ height: 5 }} />;
                if (/^\d\./.test(t)) return <div key={i} style={{ color: "#ffd700", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", marginTop: 10, marginBottom: 4 }}>{t}</div>;
                return <p key={i} style={{ color: "#c9d1d9", fontSize: 11, lineHeight: 1.7, marginBottom: 3 }}>{t}</p>;
              })}
            </div>
          )}

          {/* Portfolio filter */}
          {holdings.length > 0 && (
            <div style={{ position: "absolute", top: 12, left: 12, zIndex: 1000, background: "#0d1117ee", border: "1px solid #1c2333", borderRadius: 6, padding: "10px 12px", maxWidth: 200 }}>
              <p style={{ color: "#8b949e", fontSize: 10, letterSpacing: "0.08em", marginBottom: 8 }}>EXPOSURE FILTER</p>
              <select style={{ background: "#161b22", border: "1px solid #1c2333", color: "#c9d1d9", padding: "5px 8px", borderRadius: 3, fontFamily: "inherit", fontSize: 11, width: "100%", cursor: "pointer" }}
                value={ticker ?? ""} onChange={e => setTicker(e.target.value || null)}>
                <option value="">All regions</option>
                {holdings.map(h => <option key={h.ticker} value={h.ticker}>{h.ticker} — {h.name}</option>)}
              </select>
              {ticker && <p style={{ color: "#ffd700", fontSize: 10, marginTop: 6 }}>● Highlighted = {ticker} exposure</p>}
            </div>
          )}

          {/* Selected hotspot popup */}
          {selected && (
            <div style={{
              position: "absolute", bottom: 16, left: 16, zIndex: 1000,
              background: "#0d1117f5", border: `1px solid ${riskColor(selected.risk)}44`,
              borderRadius: 6, padding: "14px 16px", maxWidth: 340,
              boxShadow: `0 0 24px ${riskColor(selected.risk)}22`,
              animation: "fadeIn 0.2s ease",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div>
                  <div style={{ color: "#c9d1d9", fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{selected.name}</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <span style={{ background: riskColor(selected.risk)+"22", color: riskColor(selected.risk), border: `1px solid ${riskColor(selected.risk)}44`, padding: "1px 8px", borderRadius: 3, fontSize: 9, letterSpacing: "0.08em" }}>{selected.risk.toUpperCase()}</span>
                    <span style={{ color: "#8b949e", fontSize: 9 }}>{selected.category}</span>
                  </div>
                </div>
                <button onClick={() => { setSelected(null); setAiAnalysis(null); }} style={{ background: "none", border: "none", color: "#8b949e", cursor: "pointer", fontSize: 16 }}>×</button>
              </div>
              <p style={{ color: "#8b949e", fontSize: 11, lineHeight: 1.6, marginBottom: 10 }}>{selected.detail}</p>

              {/* Related news count */}
              {selectedHotspotNews.length > 0 && (
                <div style={{ marginBottom: 10, padding: "8px 10px", background: "#ffd70010", border: "1px solid #ffd70033", borderRadius: 4 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ color: "#ffd700", fontSize: 10, fontWeight: 700 }}>📰 {selectedHotspotNews.length} RELATED ARTICLES</span>
                    <button
                      onClick={() => runHotspotAnalysis(selected)}
                      disabled={aiLoading}
                      style={{ background: "#00ff9d18", border: "1px solid #00ff9d44", color: "#00ff9d", padding: "2px 10px", borderRadius: 3, fontFamily: "inherit", fontSize: 9, cursor: "pointer", letterSpacing: "0.08em" }}
                    >
                      {aiLoading ? "ANALYSING…" : "AI ANALYSIS"}
                    </button>
                  </div>
                  {selectedHotspotNews.slice(0, 2).map((a, i) => (
                    <div key={i} style={{ marginBottom: 4 }}>
                      <a href={a.url} target="_blank" rel="noreferrer" style={{ color: "#c9d1d9", fontSize: 10, lineHeight: 1.5, textDecoration: "none" }}>
                        <span style={{ color: sentiment(a.title).color, fontSize: 8 }}>● </span>
                        [{a.source}] {a.title.slice(0, 70)}{a.title.length > 70 ? "…" : ""}
                      </a>
                    </div>
                  ))}
                </div>
              )}

              {/* AI Analysis */}
              {aiLoading && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0" }}>
                  <div className="spin" style={{ width: 12, height: 12, border: "1.5px solid #1c2333", borderTopColor: "#00ff9d", borderRadius: "50%", flexShrink: 0 }} />
                  <span style={{ color: "#8b949e", fontSize: 11 }}>Analysing latest news…</span>
                </div>
              )}
              {aiAnalysis && !aiLoading && (
                <div style={{ padding: "10px 12px", background: "#00ff9d08", border: "1px solid #00ff9d22", borderRadius: 4, animation: "fadeIn 0.3s ease" }}>
                  <div style={{ color: "#00ff9d", fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", marginBottom: 6 }}>AI RISK ASSESSMENT</div>
                  <p style={{ color: "#c9d1d9", fontSize: 11, lineHeight: 1.7 }}>{aiAnalysis}</p>
                </div>
              )}

              {/* Portfolio exposure */}
              {holdings.length > 0 && (() => {
                const affected = holdings.filter(h => (TICKER_GEO[h.ticker] ?? []).includes(selected.id));
                return affected.length > 0 ? (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #1c2333" }}>
                    <p style={{ color: "#ffd700", fontSize: 10, marginBottom: 6 }}>⚠ PORTFOLIO EXPOSURE:</p>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {affected.map(h => <span key={h.ticker} className="ticker-tag">{h.ticker}</span>)}
                    </div>
                  </div>
                ) : null;
              })()}
            </div>
          )}

          {!mapLoaded && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#060a0f", zIndex: 999 }}>
              <div style={{ textAlign: "center" }}>
                <div className="spin" style={{ width: 24, height: 24, border: "2px solid #1c2333", borderTopColor: "#00ff9d", borderRadius: "50%", margin: "0 auto 12px" }} />
                <p style={{ color: "#8b949e", fontSize: 12 }}>Loading map…</p>
              </div>
            </div>
          )}
        </div>

        {/* Market stress ticker */}
        <div style={{ borderTop: "1px solid #1c2333", padding: "7px 14px", background: "#0a0e14", display: "flex", gap: 24, overflowX: "auto" }}>
          {MARKET_STRESS.map(s => (
            <div key={s.label} style={{ whiteSpace: "nowrap" }}>
              <span style={{ color: "#8b949e", fontSize: 10 }}>{s.label} </span>
              <span style={{ color: s.color, fontWeight: 600, fontSize: 11 }}>{s.value} </span>
              <span style={{ color: s.change.startsWith("+") ? "#00ff9d" : "#ff6b35", fontSize: 10 }}>{s.change}</span>
            </div>
          ))}
          <div style={{ marginLeft: "auto", whiteSpace: "nowrap" }}>
            <span style={{ color: "#8b949e55", fontSize: 9 }}>Last update: {new Date().toLocaleTimeString()}</span>
          </div>
        </div>
      </div>

      {/* ── RIGHT SIDEBAR ────────────────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", background: "#0a0e14" }}>

        {/* Risk summary */}
        <div style={{ padding: "10px 14px", borderBottom: "1px solid #1c2333" }}>
          <p style={{ color: "#8b949e", fontSize: 10, letterSpacing: "0.08em", marginBottom: 8 }}>GLOBAL RISK SUMMARY</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
            {[{ label: "CRITICAL", count: riskCounts.critical, color: "#ff2d2d" },
              { label: "HIGH",     count: riskCounts.high,     color: "#ff6b35" },
              { label: "MEDIUM",   count: riskCounts.medium,   color: "#ffd700" }].map(({ label, count, color }) => (
              <div key={label} style={{ background: "#0d1117", border: `1px solid ${color}33`, borderRadius: 4, padding: "7px", textAlign: "center" }}>
                <div style={{ color, fontSize: 18, fontWeight: 700 }}>{count}</div>
                <div style={{ color: "#8b949e", fontSize: 9, letterSpacing: "0.08em" }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tab switcher */}
        <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #1c2333", background: "#0d1117" }}>
          {[
            { id: "alerts",   label: "ALERTS" },
            { id: "news",     label: `NEWS ${newsArticles.length > 0 ? `(${newsArticles.length})` : ""}` },
            { id: "bloomberg",label: "▶ BLOOMBERG" },
          ].map(t => (
            <button key={t.id} onClick={() => setRightTab(t.id)} style={{
              flex: 1, padding: "9px 4px", border: "none", borderBottom: `2px solid ${rightTab === t.id ? "#00ff9d" : "transparent"}`,
              background: "transparent", color: rightTab === t.id ? "#00ff9d" : "#8b949e",
              fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", cursor: "pointer", fontFamily: "inherit",
              transition: "all 0.15s",
            }}>{t.label}</button>
          ))}
        </div>

        {/* ── ALERTS TAB ─────────────────────────────────────────────────── */}
        {rightTab === "alerts" && (
          <div style={{ flex: 1, overflowY: "auto" }} className="scroll-thin">
            {/* Portfolio geo-risk */}
            {holdings.length > 0 && (
              <div style={{ padding: "10px 14px", borderBottom: "1px solid #1c2333" }}>
                <p style={{ color: "#8b949e", fontSize: 10, letterSpacing: "0.08em", marginBottom: 8 }}>PORTFOLIO GEO-RISK</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {exposureData.map(h => (
                    <div key={h.ticker} onClick={() => setTicker(h.ticker)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 9px", background: "#0d1117", border: `1px solid ${riskColor(h.maxRisk)}22`, borderRadius: 4, cursor: "pointer" }}>
                      <span className="ticker-tag">{h.ticker}</span>
                      <div style={{ flex: 1, display: "flex", gap: 3, flexWrap: "wrap" }}>
                        {h.hotspots.slice(0,2).map(s => (
                          <span key={s.id} style={{ fontSize: 9, color: riskColor(s.risk), background: riskColor(s.risk)+"15", padding: "1px 5px", borderRadius: 2 }}>
                            {s.name.split(" ")[0]}
                          </span>
                        ))}
                        {h.hotspots.length === 0 && <span style={{ fontSize: 9, color: "#8b949e" }}>No exposure</span>}
                      </div>
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: riskColor(h.maxRisk), boxShadow: `0 0 4px ${riskColor(h.maxRisk)}` }} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Crisis alerts */}
            <div style={{ padding: "10px 14px 6px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <p style={{ color: "#8b949e", fontSize: 10, letterSpacing: "0.08em" }}>LIVE CRISIS ALERTS</p>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span className="blink" style={{ width: 6, height: 6, borderRadius: "50%", background: "#ff2d2d", boxShadow: "0 0 6px #ff2d2d", display: "inline-block" }} />
                <span style={{ color: "#ff2d2d", fontSize: 9 }}>LIVE</span>
              </span>
            </div>
            {loadingAlerts ? (
              <div style={{ padding: 20, textAlign: "center" }}>
                <div className="spin" style={{ width: 16, height: 16, border: "2px solid #1c2333", borderTopColor: "#00ff9d", borderRadius: "50%", margin: "0 auto 8px" }} />
                <p style={{ color: "#8b949e", fontSize: 11 }}>Fetching alerts…</p>
              </div>
            ) : (
              alerts.map(alert => (
                <div key={alert.id} className="alert-row" style={{ padding: "9px 14px", borderBottom: "1px solid #0d1117" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                    <span style={{ color: "#c9d1d9", fontSize: 11, fontWeight: 500 }}>{alert.country}</span>
                    <span style={{ color: "#8b949e", fontSize: 10 }}>{alert.date}</span>
                  </div>
                  <div style={{ color: "#8b949e", fontSize: 11, marginBottom: 3 }}>{alert.name}</div>
                  <span style={{ fontSize: 9, background: "#ff6b3518", color: "#ff6b35", border: "1px solid #ff6b3533", padding: "1px 6px", borderRadius: 2 }}>{alert.type}</span>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── NEWS TAB ───────────────────────────────────────────────────── */}
        {rightTab === "news" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "8px 14px", borderBottom: "1px solid #1c2333", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "#8b949e", fontSize: 10 }}>
                {loadingNews ? "Loading feeds…" : `${newsArticles.length} articles from ${GEO_FEEDS.length} sources`}
              </span>
              <button onClick={fetchNews} disabled={loadingNews} style={{ marginLeft: "auto", background: "transparent", border: "1px solid #1c2333", color: "#8b949e", padding: "3px 10px", borderRadius: 3, fontFamily: "inherit", fontSize: 9, cursor: "pointer", letterSpacing: "0.08em" }}>
                {loadingNews ? "…" : "↻ REFRESH"}
              </button>
            </div>

            {/* If hotspot selected, show its news first */}
            {selected && selectedHotspotNews.length > 0 && (
              <div style={{ padding: "8px 14px", background: riskColor(selected.risk)+"08", borderBottom: "1px solid #1c2333" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ color: riskColor(selected.risk), fontSize: 10, fontWeight: 700, letterSpacing: "0.08em" }}>
                    📍 {selected.name.toUpperCase()} ({selectedHotspotNews.length})
                  </span>
                  <button onClick={() => runHotspotAnalysis(selected)} disabled={aiLoading} style={{ background: "#00ff9d18", border: "1px solid #00ff9d44", color: "#00ff9d", padding: "2px 8px", borderRadius: 3, fontFamily: "inherit", fontSize: 9, cursor: "pointer" }}>
                    {aiLoading ? "…" : "AI ANALYSIS"}
                  </button>
                </div>
                {selectedHotspotNews.slice(0, 4).map((a, i) => (
                  <a key={i} href={a.url} target="_blank" rel="noreferrer" style={{ display: "block", textDecoration: "none", marginBottom: 6 }}>
                    <div style={{ display: "flex", gap: 5, alignItems: "flex-start" }}>
                      <span style={{ color: sentiment(a.title).color, fontSize: 9, flexShrink: 0, marginTop: 2 }}>●</span>
                      <div>
                        <div style={{ color: "#c9d1d9", fontSize: 11, lineHeight: 1.5 }}>{a.title}</div>
                        <div style={{ color: "#8b949e44", fontSize: 9 }}>{a.source} · {a.time}</div>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            )}

            <div style={{ flex: 1, overflowY: "auto" }} className="scroll-thin">
              {loadingNews && newsArticles.length === 0 && (
                <div style={{ padding: 24, textAlign: "center" }}>
                  <div className="spin" style={{ width: 18, height: 18, border: "2px solid #1c2333", borderTopColor: "#00ff9d", borderRadius: "50%", margin: "0 auto 10px" }} />
                  <p style={{ color: "#8b949e", fontSize: 11 }}>Loading {GEO_FEEDS.length} feeds…</p>
                  <p style={{ color: "#8b949e44", fontSize: 10, marginTop: 4 }}>BBC · Reuters · Al Jazeera · Bloomberg · FT…</p>
                </div>
              )}
              {newsArticles.map(article => {
                const s = sentiment(article.title);
                const relatedSpots = articleToHotspots(article);
                return (
                  <div key={article.id} className="news-item">
                    <a href={article.url} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
                      <div style={{ display: "flex", gap: 6, marginBottom: 3 }}>
                        <span style={{ color: s.color, fontSize: 9, flexShrink: 0, marginTop: 2 }}>●</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ color: "#c9d1d9", fontSize: 11, lineHeight: 1.5, marginBottom: 3 }}>{article.title}</div>
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <span style={{ color: "#00ff9d66", fontSize: 9 }}>{article.source}</span>
                            <span style={{ color: "#8b949e44", fontSize: 9 }}>{article.time}</span>
                            {relatedSpots.slice(0,2).map(h => (
                              <span key={h.id} onClick={(e) => { e.preventDefault(); handleSelectHotspot(h); }} style={{ fontSize: 8, color: riskColor(h.risk), background: riskColor(h.risk)+"15", padding: "1px 5px", borderRadius: 2, cursor: "pointer", border: `1px solid ${riskColor(h.risk)}33` }}>
                                {h.name.split(" ")[0]}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </a>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── BLOOMBERG TAB ──────────────────────────────────────────────── */}
        {rightTab === "bloomberg" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

            {/* Sub-tabs: Live / Recordings */}
            <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #1c2333", background: "#0d1117" }}>
              {["live","recordings"].map(t => (
                <button key={t} onClick={() => setBloombergTab(t)} style={{
                  flex: 1, padding: "8px 4px", border: "none", borderBottom: `2px solid ${bloombergTab===t ? "#ffd700" : "transparent"}`,
                  background: "transparent", color: bloombergTab===t ? "#ffd700" : "#8b949e",
                  fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", cursor: "pointer", fontFamily: "inherit",
                }}>
                  {t === "live" ? "🔴 LIVE STREAM" : "📼 RECORDINGS"}
                </button>
              ))}
            </div>

            {bloombergTab === "live" && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <div style={{ padding: "8px 14px", background: "#ff2d2d10", borderBottom: "1px solid #ff2d2d22", display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="blink" style={{ width: 7, height: 7, borderRadius: "50%", background: "#ff2d2d", boxShadow: "0 0 6px #ff2d2d", display: "inline-block", flexShrink: 0 }} />
                  <span style={{ color: "#ff2d2d", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em" }}>BLOOMBERG TELEVISION — LIVE</span>
                </div>
                <div style={{ flex: 1, position: "relative", background: "#0d1117" }}>
                  <iframe
                    src={BLOOMBERG_LIVE_URL}
                    style={{ width: "100%", height: "100%", border: "none", minHeight: 200 }}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title="Bloomberg Live"
                  />
                </div>
                <div style={{ padding: "8px 14px", borderTop: "1px solid #1c2333", background: "#0d1117" }}>
                  <p style={{ color: "#8b949e", fontSize: 9, lineHeight: 1.6 }}>Bloomberg Television provides 24/7 financial news coverage. Stream may require YouTube availability in your region.</p>
                  <a href="https://www.bloomberg.com/live" target="_blank" rel="noreferrer" style={{ color: "#ffd700", fontSize: 9, textDecoration: "none" }}>→ bloomberg.com/live</a>
                </div>
              </div>
            )}

            {bloombergTab === "recordings" && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                {/* Recordings list */}
                <div style={{ padding: "8px 14px", borderBottom: "1px solid #1c2333" }}>
                  <p style={{ color: "#8b949e", fontSize: 10, letterSpacing: "0.08em" }}>RECENT PROGRAMS</p>
                </div>
                <div style={{ overflowY: "auto", maxHeight: 160 }} className="scroll-thin">
                  {BLOOMBERG_RECORDINGS.map(rec => (
                    <div key={rec.id} className={`rec-item ${selectedRec.id === rec.id ? "active" : ""}`}
                      onClick={() => setSelectedRec(rec)}
                      style={{ margin: "4px 8px" }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ color: selectedRec.id === rec.id ? "#ffd700" : "#8b949e", fontSize: 12 }}>{selectedRec.id === rec.id ? "▶" : "○"}</span>
                        <div>
                          <div style={{ color: "#c9d1d9", fontSize: 11, fontWeight: selectedRec.id === rec.id ? 600 : 400 }}>{rec.title}</div>
                          <div style={{ color: "#8b949e", fontSize: 9 }}>{rec.desc}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Video player */}
                <div style={{ flex: 1, position: "relative", background: "#0d1117", borderTop: "1px solid #1c2333" }}>
                  <div style={{ padding: "6px 14px", background: "#ffd70010", borderBottom: "1px solid #ffd70022", display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ color: "#ffd700", fontSize: 10, fontWeight: 700 }}>▶ {selectedRec.title}</span>
                  </div>
                  <iframe
                    key={selectedRec.yt}
                    src={`https://www.youtube.com/embed/${selectedRec.yt}?rel=0&modestbranding=1`}
                    style={{ width: "100%", height: "calc(100% - 32px)", border: "none", minHeight: 160 }}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title={selectedRec.title}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
