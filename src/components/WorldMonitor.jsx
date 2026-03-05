import { useState, useEffect, useRef, useCallback } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// WorldMonitor — Geopolitical Risk Map
// • Leaflet dark map with live pulsing markers
// • ReliefWeb API  — crisis alerts
// • RSS feeds      — live news auto-mapped to regions
// • Groq AI        — hotspot analysis + global briefing + auto-detect new zones
// • Bloomberg      — fixed media panel with working links + live embed
// ─────────────────────────────────────────────────────────────────────────────

const GROQ_MODEL = "llama-3.3-70b-versatile";
function getGroqKey() {
  if (typeof process !== "undefined" && process.env?.REACT_APP_GROQ_API_KEY)
    return process.env.REACT_APP_GROQ_API_KEY;
  if (typeof window !== "undefined" && window.__GROQ_API_KEY)
    return window.__GROQ_API_KEY;
  return "";
}

const RC = { critical:"#ff2d2d", high:"#ff6b35", medium:"#ffd700", low:"#00ff9d", none:"#8b949e" };
const riskColor = l => RC[l] ?? RC.none;
const RISK_ORDER = { critical:4, high:3, medium:2, low:1, none:0 };

// ── Hotspot seed list ─────────────────────────────────────────────────────────
const SEED_HOTSPOTS = [
  { id:"ukraine",    name:"Ukraine / Russia",    lat:49.0,  lon:31.0,  risk:"critical", category:"Armed Conflict",  detail:"Active war zone. NATO involvement. Energy supply disruption.",         keywords:["ukraine","russia","moscow","kyiv","zelensky","putin","nato","dnipro","kharkiv","crimea"] },
  { id:"mideast",    name:"Middle East",          lat:29.0,  lon:42.0,  risk:"critical", category:"Geopolitical",    detail:"Regional escalation. Red Sea and Hormuz shipping at risk.",            keywords:["israel","gaza","hamas","hezbollah","red sea","iran","lebanon","houthi","yemen","west bank","rafah","idf"] },
  { id:"taiwan",     name:"Taiwan Strait",        lat:23.7,  lon:120.9, risk:"high",     category:"Geopolitical",    detail:"China-Taiwan tensions. Semiconductor supply chain risk.",              keywords:["taiwan","tsmc","strait","pla","beijing","taipei","chip","semiconductor","foxconn"] },
  { id:"southchina", name:"South China Sea",      lat:12.0,  lon:114.0, risk:"high",     category:"Maritime",        detail:"Disputed waters. Indo-Pacific trade route tensions.",                  keywords:["south china sea","philippine","spratly","paracel","indo-pacific","scarborough"] },
  { id:"sahel",      name:"Sahel Region",          lat:15.0,  lon:2.0,   risk:"high",     category:"Armed Conflict",  detail:"Multiple coups. Jihadist insurgency spreading across region.",       keywords:["sahel","mali","niger","burkina","coup","jihadist","wagner","africa","junta","al-qaeda"] },
  { id:"northkorea", name:"Korean Peninsula",     lat:37.5,  lon:127.0, risk:"high",     category:"Nuclear",         detail:"DPRK missile tests. Nuclear escalation risk.",                         keywords:["north korea","dprk","kim jong","pyongyang","missile","icbm","nuclear test","seoul"] },
  { id:"iran",       name:"Iran",                 lat:32.0,  lon:53.0,  risk:"high",     category:"Sanctions",       detail:"Nuclear programme. Strait of Hormuz leverage.",                        keywords:["iran","tehran","hormuz","irgc","nuclear deal","khamenei","sanction","uranium","enrichment"] },
  { id:"sudan",      name:"Sudan",                lat:15.5,  lon:32.5,  risk:"high",     category:"Armed Conflict",  detail:"Civil war between SAF and RSF. Massive humanitarian crisis.",          keywords:["sudan","khartoum","rsf","saf","darfur","sudanese","civil war"] },
  { id:"venezuela",  name:"Venezuela",            lat:8.0,   lon:-66.0, risk:"medium",   category:"Political",       detail:"Election disputes. US sanctions. Oil sector risk.",                    keywords:["venezuela","maduro","caracas","pdvsa","sanction","bolivar","opposition"] },
  { id:"myanmar",    name:"Myanmar",              lat:17.0,  lon:96.0,  risk:"medium",   category:"Armed Conflict",  detail:"Military junta vs resistance. Civil war ongoing.",                     keywords:["myanmar","burma","junta","tatmadaw","rohingya","coup","yangon","naypyidaw"] },
  { id:"ethiopia",   name:"Ethiopia / Horn",      lat:8.0,   lon:38.0,  risk:"medium",   category:"Humanitarian",    detail:"Post-Tigray instability. Regional food insecurity.",                   keywords:["ethiopia","tigray","horn of africa","addis","famine","drought","somalia","eritrea"] },
  { id:"pakistan",   name:"Pakistan",             lat:30.0,  lon:70.0,  risk:"medium",   category:"Political",       detail:"Political instability. Nuclear state. IMF pressure.",                  keywords:["pakistan","islamabad","imran khan","isi","kashmir","nuclear","pti","economic crisis"] },
  { id:"haiti",      name:"Haiti",                lat:19.0,  lon:-72.0, risk:"medium",   category:"Humanitarian",    detail:"Gang control. State collapse risk.",                                   keywords:["haiti","port-au-prince","gang","humanitarian","ariel henry","viv ansanm"] },
  { id:"drcongo",    name:"DR Congo",             lat:-3.0,  lon:23.0,  risk:"medium",   category:"Armed Conflict",  detail:"M23 insurgency. Eastern DRC mineral conflict.",                        keywords:["congo","drc","kinshasa","m23","goma","kivu","rwanda","cobalt","coltan"] },
  { id:"georgia",    name:"Georgia / Caucasus",   lat:42.0,  lon:43.5,  risk:"medium",   category:"Geopolitical",    detail:"Pro-EU protests. Russian influence escalating.",                       keywords:["georgia","tbilisi","caucasus","south ossetia","abkhazia","eu protest","russian influence"] },
  { id:"libya",      name:"Libya",                lat:27.0,  lon:17.0,  risk:"medium",   category:"Political",       detail:"Divided government. Oil infrastructure disruption risk.",               keywords:["libya","tripoli","benghazi","haftar","noc","oil","warlord","militia"] },
  { id:"armenia",    name:"Armenia / Azerbaijan", lat:40.1,  lon:45.0,  risk:"low",      category:"Geopolitical",    detail:"Nagorno-Karabakh aftermath. Border tensions persist.",                  keywords:["armenia","azerbaijan","nagorno","karabakh","yerevan","baku","pashinyan","aliyev"] },
  { id:"mozambique", name:"Mozambique / Cabo",    lat:-15.0, lon:35.0,  risk:"low",      category:"Armed Conflict",  detail:"Islamist insurgency in Cabo Delgado. LNG projects at risk.",          keywords:["mozambique","cabo delgado","ansar","mozambican","maputo","lng","totalenergies"] },
];

const TICKER_GEO = {
  AAPL:["taiwan","southchina"], MSFT:["ukraine"], XOM:["mideast","iran"],
  JPM:["ukraine","mideast"],    NVDA:["taiwan","southchina"], AMZN:["mideast"],
  TSM:["taiwan","southchina"],  V:["ukraine","mideast"],      HD:[],
  PG:["ukraine"],               JNJ:[], NEE:[], META:["ukraine"], BRK:[], UNH:[],
  SHEL:["mideast","iran"],      CVX:["mideast","iran","venezuela"],
  BA:["ukraine","taiwan"],      GS:["ukraine","mideast"],
};

const MARKET_STRESS = [
  { label:"VIX",       value:"18.4",  change:"+2.1",  color:RC.medium },
  { label:"Gold $/oz", value:"2,345", change:"+0.8%", color:RC.medium },
  { label:"DXY",       value:"104.2", change:"-0.3%", color:RC.low    },
  { label:"WTI $/bbl", value:"78.4",  change:"+1.2%", color:RC.high   },
  { label:"10Y UST",   value:"4.42%", change:"-0.04", color:RC.low    },
  { label:"BDI",       value:"1,840", change:"-3.1%", color:RC.high   },
  { label:"EUR/USD",   value:"1.082", change:"-0.2%", color:RC.medium },
];

const GEO_FEEDS = [
  { id:"bbc",      label:"BBC World",      url:"https://feeds.bbci.co.uk/news/world/rss.xml" },
  { id:"alj",      label:"Al Jazeera",     url:"https://www.aljazeera.com/xml/rss/all.xml" },
  { id:"guardian", label:"Guardian",       url:"https://www.theguardian.com/world/rss" },
  { id:"reuters",  label:"Reuters",        url:"https://rsshub.app/reuters/world" },
  { id:"bloomberg",label:"Bloomberg",      url:"https://rsshub.app/bloomberg/markets" },
  { id:"ft",       label:"FT",             url:"https://rsshub.app/ft/myft/following" },
  { id:"fp",       label:"Foreign Policy", url:"https://foreignpolicy.com/feed/" },
  { id:"ap",       label:"AP News",        url:"https://rsshub.app/apnews/topics/apf-topnews" },
];

const PROXIES = [
  u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  u => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  u => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
];

async function fetchWithFallback(url) {
  for (const px of PROXIES) {
    try {
      const r = await fetch(px(url), { signal: AbortSignal.timeout(7000) });
      if (r.ok) { const t = await r.text(); if (t.length > 100) return t; }
    } catch { /* next proxy */ }
  }
  return null;
}

function parseRSS(xml, label, feedId) {
  try {
    const doc = new DOMParser().parseFromString(xml, "text/xml");
    return Array.from(doc.querySelectorAll("item, entry")).slice(0, 12).map((item, i) => {
      const title   = item.querySelector("title")?.textContent?.trim() ?? "";
      const link    = item.querySelector("link")?.textContent?.trim() ?? item.querySelector("link")?.getAttribute("href") ?? "#";
      const desc    = (item.querySelector("description,summary,content")?.textContent ?? "").replace(/<[^>]+>/g,"").trim();
      const pubDate = item.querySelector("pubDate,published,updated")?.textContent?.trim() ?? "";
      return {
        id:`${feedId}-${i}-${Date.now()}`, title, summary:desc.slice(0,200),
        source:label, feedId,
        url: link.startsWith("http") ? link : "#",
        time: pubDate ? new Date(pubDate).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}) : "",
        rawDate: pubDate ? new Date(pubDate).getTime() : 0,
      };
    }).filter(a => a.title.length > 8);
  } catch { return []; }
}

const POS_W = ["rally","gain","ceasefire","peace","deal","agreement","recovery","upgrade","surge","growth","truce"];
const NEG_W = ["war","attack","crisis","sanction","conflict","missile","bomb","coup","escalat","threat","crash","collapse","tension","strike","invasion","massacre","famine","explosion"];
function sentiment(text) {
  const l = (text||"").toLowerCase();
  let s = 0;
  POS_W.forEach(w => { if(l.includes(w)) s++; });
  NEG_W.forEach(w => { if(l.includes(w)) s--; });
  return s>0 ? {label:"POS",color:RC.low} : s<0 ? {label:"NEG",color:RC.critical} : {label:"NEU",color:RC.medium};
}

function articleToHotspots(article, hotspotList) {
  const text = `${article.title} ${article.summary}`.toLowerCase();
  return hotspotList.filter(h => h.keywords && h.keywords.some(k => text.includes(k)));
}

// ── Groq helpers ──────────────────────────────────────────────────────────────
async function groqChat(system, user, maxTokens = 700) {
  const key = getGroqKey();
  if (!key) throw new Error("NO_KEY");
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method:"POST",
    headers:{ "Content-Type":"application/json", "Authorization":`Bearer ${key}` },
    body: JSON.stringify({
      model: GROQ_MODEL, max_tokens: maxTokens, temperature: 0.35,
      messages:[{ role:"system", content:system },{ role:"user", content:user }],
    }),
  });
  if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e?.error?.message ?? `HTTP ${res.status}`); }
  return (await res.json()).choices?.[0]?.message?.content ?? "";
}

async function aiHotspotAnalysis(articles, spot) {
  const hl = articles.slice(0,14).map(a=>`[${a.source}] ${a.title}`).join("\n");
  return groqChat(
    "You are a senior geopolitical risk analyst. Be concise and specific. Max 4 sentences.",
    `Risk assessment for "${spot.name}": cover current risk level, key escalation or de-escalation signals, and direct market transmission.\n\nHeadlines:\n${hl}`,
    380
  );
}

async function aiGlobalBriefing(articles) {
  const hl = articles.slice(0,22).map(a=>`[${a.source}] ${a.title}`).join("\n");
  return groqChat(
    "You are a senior geopolitical risk analyst. Write sharp, actionable intelligence. No preamble or sign-off.",
    `Write a GLOBAL RISK BRIEFING with exactly these 3 sections:\n\n1. TOP RISK DEVELOPMENTS (3 bullet points — what changed today)\n2. MARKET TRANSMISSION (how risks affect equities, FX, commodities)\n3. 48H WATCH LIST (3 events that could escalate)\n\nMax 280 words. Use → for bullets.\n\nHeadlines:\n${hl}`,
    650
  );
}

async function aiDetectNewHotspots(articles, existingIds) {
  const hl = articles.slice(0,18).map(a=>a.title).join("\n");
  const result = await groqChat(
    "You extract geopolitical location data. Respond ONLY with a valid JSON array. No markdown, no explanation, no preamble.",
    `Identify up to 3 NEW crisis locations from these headlines NOT already in this list: [${existingIds.join(",")}].\n\nReturn ONLY JSON array:\n[{"id":"short_id","name":"Display Name","lat":0.0,"lon":0.0,"risk":"high","category":"Armed Conflict","detail":"One sentence."}]\n\nRisk: critical/high/medium/low. Categories: Armed Conflict/Geopolitical/Maritime/Nuclear/Sanctions/Humanitarian/Political.\nReturn [] if nothing new.\n\nHeadlines:\n${hl}`,
    350
  );
  try {
    const clean = result.replace(/```json?|```/g,"").trim();
    const arr = JSON.parse(clean);
    return Array.isArray(arr) ? arr.filter(p => p.id && p.lat && p.lon && p.name) : [];
  } catch { return []; }
}

// ─────────────────────────────────────────────────────────────────────────────
export default function WorldMonitor({ holdings = [], groqApiKey = "" }) {
  if (groqApiKey) window.__GROQ_API_KEY = groqApiKey;

  const mapRef     = useRef(null);
  const leafletMap = useRef(null);
  const markersRef = useRef([]);

  const [mapLoaded,        setMapLoaded]        = useState(false);
  const [hotspots,         setHotspots]         = useState(SEED_HOTSPOTS);
  const [selected,         setSelected]         = useState(null);
  const [activeLayer,      setActiveLayer]      = useState("all");
  const [ticker,           setTicker]           = useState(null);
  const [newsArticles,     setNewsArticles]      = useState([]);
  const [loadingNews,      setLoadingNews]      = useState(true);
  const [hotspotNews,      setHotspotNews]      = useState({});
  const [lastUpdated,      setLastUpdated]      = useState(null);
  const [alerts,           setAlerts]           = useState([]);
  const [loadingAlerts,    setLoadingAlerts]    = useState(true);
  const [rightTab,         setRightTab]         = useState("alerts");
  const [aiAnalysis,       setAiAnalysis]       = useState(null);
  const [aiLoading,        setAiLoading]        = useState(false);
  const [briefing,         setBriefing]         = useState(null);
  const [briefingLoading,  setBriefingLoading]  = useState(false);
  const [aiNewHotspots,    setAiNewHotspots]    = useState([]);
  const [apiKeyInput,      setApiKeyInput]      = useState("");
  const [apiKeySet,        setApiKeySet]        = useState(!!getGroqKey());
  const [showKeyInput,     setShowKeyInput]     = useState(false);
  const [bloombergView,    setBloombergView]    = useState("info");
  const detectedRef        = useRef(false);

  // ── Leaflet ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (window.L) { setMapLoaded(true); return; }
    const link = document.createElement("link");
    link.rel = "stylesheet"; link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
    const s = document.createElement("script");
    s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    s.onload = () => setMapLoaded(true);
    document.head.appendChild(s);
  }, []);

  useEffect(() => {
    if (!mapLoaded || !mapRef.current || leafletMap.current) return;
    const L = window.L;
    leafletMap.current = L.map(mapRef.current, { center:[20,10], zoom:2, zoomControl:true, attributionControl:false });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { maxZoom:18 }).addTo(leafletMap.current);
    return () => { if (leafletMap.current) { leafletMap.current.remove(); leafletMap.current = null; } };
  }, [mapLoaded]);

  // ── Markers ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded || !leafletMap.current) return;
    const L = window.L;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    const filtered = activeLayer === "all" ? hotspots : hotspots.filter(h => h.category.toLowerCase().includes(activeLayer));

    filtered.forEach(spot => {
      const color     = riskColor(spot.risk);
      const nc        = (hotspotNews[spot.id] ?? []).length;
      const isExposed = ticker ? (TICKER_GEO[ticker]??[]).includes(spot.id) : false;
      const isNew     = aiNewHotspots.some(n => n.id === spot.id);
      const size      = isExposed ? 22 : isNew ? 20 : nc > 0 ? 18 : 14;
      const glow      = isExposed ? 16 : isNew ? 12 : nc > 0 ? 9 : 5;

      const badge = nc > 0
        ? `<div style="position:absolute;top:-7px;right:-7px;background:#ff2d2d;color:#fff;font-size:8px;font-weight:700;min-width:14px;height:14px;border-radius:7px;display:flex;align-items:center;justify-content:center;padding:0 2px;box-shadow:0 0 6px #ff2d2d;">${nc>9?"9+":nc}</div>`
        : "";
      const newBadge = isNew
        ? `<div style="position:absolute;bottom:-15px;left:50%;transform:translateX(-50%);background:#ffd700;color:#000;font-size:7px;font-weight:800;padding:1px 4px;border-radius:2px;white-space:nowrap;letter-spacing:.04em;">AI NEW</div>`
        : "";

      const icon = L.divIcon({
        html: `<div style="position:relative;width:${size+14}px;height:${size+20}px;display:flex;align-items:center;justify-content:center;">
          <div style="width:${size}px;height:${size}px;background:${color};border-radius:50%;border:2px solid ${isExposed?"#fff":color+"99"};box-shadow:0 0 ${glow}px ${color};cursor:pointer;animation:pulse-marker ${isExposed?"1.4s":"2.2s"} infinite;"></div>
          ${badge}${newBadge}
        </div>`,
        className:"", iconSize:[size+14, size+20], iconAnchor:[(size+14)/2,(size+14)/2],
      });
      markersRef.current.push(
        L.marker([spot.lat, spot.lon], { icon })
          .addTo(leafletMap.current)
          .on("click", () => setSelected(spot))
      );
    });
  }, [mapLoaded, activeLayer, ticker, hotspots, hotspotNews, aiNewHotspots]);

  // ── ReliefWeb ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function go() {
      setLoadingAlerts(true);
      try {
        const r = await fetch("https://api.reliefweb.int/v1/disasters?appname=worldmonitor&limit=14&fields[include][]=name&fields[include][]=status&fields[include][]=date&fields[include][]=country&fields[include][]=type&filter[operator]=AND&filter[conditions][0][field]=status&filter[conditions][0][value]=alert&sort[]=date:desc");
        const d = await r.json();
        setAlerts((d?.data ?? []).map(x => ({
          id:x.id, name:x.fields?.name??"Unknown", status:x.fields?.status??"alert",
          date:x.fields?.date?.created?.slice(0,10)??"", country:x.fields?.country?.[0]?.name??"Unknown",
          type:x.fields?.type?.[0]?.name??"Disaster",
        })));
      } catch {
        setAlerts([
          { id:1, name:"Red Sea Shipping Crisis",     country:"Yemen",     type:"Complex Emergency", date:"2025-03-01" },
          { id:2, name:"Ukraine Humanitarian Crisis", country:"Ukraine",   type:"Armed Conflict",    date:"2025-02-28" },
          { id:3, name:"Sudan Civil War",             country:"Sudan",     type:"Armed Conflict",    date:"2025-02-20" },
          { id:4, name:"Gaza Humanitarian Emergency", country:"Palestine", type:"Complex Emergency", date:"2025-02-15" },
          { id:5, name:"Myanmar Conflict",            country:"Myanmar",   type:"Armed Conflict",    date:"2025-02-10" },
          { id:6, name:"Haiti Security Crisis",       country:"Haiti",     type:"Complex Emergency", date:"2025-02-05" },
          { id:7, name:"DRC Eastern Conflict",        country:"DR Congo",  type:"Armed Conflict",    date:"2025-01-30" },
        ]);
      } finally { setLoadingAlerts(false); }
    }
    go();
    const t = setInterval(go, 10 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  // ── RSS news fetch ────────────────────────────────────────────────────────────
  const fetchNews = useCallback(async () => {
    setLoadingNews(true);
    const raw = [];
    await Promise.allSettled(GEO_FEEDS.map(f => fetchWithFallback(f.url).then(xml => { if(xml) raw.push(...parseRSS(xml, f.label, f.id)); })));
    const sorted  = raw.sort((a,b) => (b.rawDate||0)-(a.rawDate||0));
    const seen    = new Set();
    const deduped = sorted.filter(a => { const k = a.title.toLowerCase().slice(0,60); if(seen.has(k)) return false; seen.add(k); return true; });
    setNewsArticles(deduped);

    setHotspots(prev => {
      const bySpot = {};
      deduped.forEach(art => {
        articleToHotspots(art, prev).forEach(h => {
          if (!bySpot[h.id]) bySpot[h.id] = [];
          if (bySpot[h.id].length < 10) bySpot[h.id].push(art);
        });
      });
      setHotspotNews(bySpot);
      return prev;
    });

    setLastUpdated(new Date());
    setLoadingNews(false);
    return deduped;
  }, []);

  useEffect(() => { fetchNews(); }, [fetchNews]);
  useEffect(() => {
    const t = setInterval(fetchNews, 4 * 60 * 1000);
    return () => clearInterval(t);
  }, [fetchNews]);

  // ── AI: detect new hotspots once after first news load ────────────────────────
  useEffect(() => {
    if (!newsArticles.length || !getGroqKey() || detectedRef.current) return;
    detectedRef.current = true;
    const existingIds = hotspots.map(h => h.id);
    aiDetectNewHotspots(newsArticles, existingIds).then(newOnes => {
      if (!newOnes.length) return;
      setAiNewHotspots(newOnes);
      setHotspots(prev => {
        const ids = new Set(prev.map(h=>h.id));
        const toAdd = newOnes
          .filter(n => !ids.has(n.id))
          .map(n => ({
            ...n,
            keywords: [n.name.toLowerCase().split(" "), n.id].flat().filter(w => w.length > 3),
            isAiGenerated: true,
          }));
        return toAdd.length ? [...prev, ...toAdd] : prev;
      });
    }).catch(()=>{});
  // eslint-disable-next-line
  }, [newsArticles.length]);

  const riskCounts = {
    critical: hotspots.filter(h=>h.risk==="critical").length,
    high:     hotspots.filter(h=>h.risk==="high").length,
    medium:   hotspots.filter(h=>h.risk==="medium").length,
  };

  const exposureData = holdings.map(h => {
    const exposed = TICKER_GEO[h.ticker] ?? [];
    const spots   = exposed.map(id => hotspots.find(s=>s.id===id)).filter(Boolean);
    const maxRisk = spots.reduce((m,s) => RISK_ORDER[s.risk]>RISK_ORDER[m] ? s.risk : m, "none");
    return { ...h, exposed, hotspots:spots, maxRisk };
  }).sort((a,b) => RISK_ORDER[b.maxRisk]-RISK_ORDER[a.maxRisk]);

  const runHotspotAnalysis = useCallback(async (spot) => {
    const arts = hotspotNews[spot.id] ?? [];
    setAiLoading(true); setAiAnalysis(null);
    try {
      if (!arts.length) { setAiAnalysis("No recent news indexed for this region yet."); return; }
      setAiAnalysis(await aiHotspotAnalysis(arts, spot));
    } catch(e) {
      setAiAnalysis(e.message === "NO_KEY" ? "Set your Groq API key (⚙ button) to enable AI analysis." : `Error: ${e.message}`);
    } finally { setAiLoading(false); }
  }, [hotspotNews]);

  const runBriefing = useCallback(async () => {
    setBriefingLoading(true); setBriefing(null);
    try { setBriefing(await aiGlobalBriefing(newsArticles)); }
    catch(e) { setBriefing(e.message==="NO_KEY" ? "Set your Groq API key (⚙ button, top-right) to enable briefings." : `Error: ${e.message}`); }
    finally { setBriefingLoading(false); }
  }, [newsArticles]);

  const layers = ["all","conflict","geopolitical","maritime","nuclear","sanctions","humanitarian","political"];
  const selectedNews = selected ? (hotspotNews[selected.id] ?? []) : [];

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 340px", height:"calc(100vh - 120px)", minHeight:600, fontFamily:"'JetBrains Mono','Fira Code',monospace", background:"#060a0f" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&display=swap');
        @keyframes pulse-marker { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.6;transform:scale(1.35)} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.2} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        .spin{animation:spin 1s linear infinite}
        .blink{animation:blink 1.4s ease infinite}
        .fade-in{animation:fadeIn .3s ease}
        .scroll-thin::-webkit-scrollbar{width:3px}.scroll-thin::-webkit-scrollbar-track{background:transparent}.scroll-thin::-webkit-scrollbar-thumb{background:#1c2333;border-radius:2px}
        .lbtn{cursor:pointer;font-family:inherit;font-size:10px;letter-spacing:.06em;text-transform:uppercase;padding:3px 8px;border-radius:3px;transition:all .12s}
        .rtab{flex:1;padding:8px 4px;border:none;font-family:inherit;font-size:9px;font-weight:700;letter-spacing:.09em;cursor:pointer;transition:all .12s}
        .news-row{padding:9px 13px;border-bottom:1px solid #0d1117;transition:background .1s}
        .news-row:hover{background:#ffffff05!important}
        .alert-row{padding:8px 13px;border-bottom:1px solid #0d1117;transition:background .1s;cursor:pointer}
        .alert-row:hover{background:#00ff9d08!important}
        .ticker-tag{background:#00ff9d14;color:#00ff9d;border:1px solid #00ff9d33;padding:1px 6px;border-radius:3px;font-size:10px;font-weight:600}
        .key-input{background:#0d1117;border:1px solid #1c2333;color:#c9d1d9;padding:6px 10px;border-radius:4px;font-family:inherit;font-size:11px;width:100%;box-sizing:border-box;outline:none}
        .key-input:focus{border-color:#00ff9d55}
        .media-link{display:flex;justify-content:space-between;align-items:center;background:#0d1117;border:1px solid #1c2333;border-radius:4px;padding:9px 11px;text-decoration:none;transition:border-color .12s;margin-bottom:7px}
        .media-link:hover{border-color:#ffd70055}
      `}</style>

      {/* ══════════ LEFT — MAP ══════════ */}
      <div style={{ display:"flex", flexDirection:"column", borderRight:"1px solid #1c2333" }}>

        {/* Layer bar */}
        <div style={{ display:"flex", alignItems:"center", gap:7, padding:"7px 12px", borderBottom:"1px solid #1c2333", background:"#0a0e14", flexWrap:"wrap" }}>
          <span style={{ color:"#8b949e55", fontSize:9, letterSpacing:".08em" }}>LAYERS</span>
          <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
            {layers.map(l => (
              <button key={l} className="lbtn" onClick={() => setActiveLayer(l)} style={{ background:activeLayer===l?"#00ff9d1a":"transparent", color:activeLayer===l?"#00ff9d":"#8b949e", border:`1px solid ${activeLayer===l?"#00ff9d44":"#1c2333"}` }}>{l}</button>
            ))}
          </div>
          <div style={{ marginLeft:"auto", display:"flex", gap:10, alignItems:"center" }}>
            {loadingNews
              ? <span style={{ color:"#8b949e55", fontSize:9, display:"flex", alignItems:"center", gap:4 }}><div className="spin" style={{ width:8,height:8,border:"1.5px solid #1c2333",borderTopColor:"#ffd700",borderRadius:"50%" }}/>syncing…</span>
              : <span style={{ color:"#00ff9d44", fontSize:9 }}>✓ {newsArticles.length} articles{lastUpdated?` · ${lastUpdated.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}`:""}</span>
            }
            {aiNewHotspots.length > 0 && <span className="blink" style={{ color:"#ffd700", fontSize:9, background:"#ffd70018", border:"1px solid #ffd70044", padding:"1px 6px", borderRadius:3 }}>+{aiNewHotspots.length} AI ZONES</span>}
            {["critical","high","medium","low"].map(r => (
              <span key={r} style={{ display:"flex", alignItems:"center", gap:3, color:"#8b949e44" }}>
                <span style={{ width:7,height:7,borderRadius:"50%",background:riskColor(r),boxShadow:`0 0 4px ${riskColor(r)}`,display:"inline-block" }} />
                <span style={{ fontSize:9 }}>{r}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Map container */}
        <div style={{ flex:1, position:"relative" }}>
          <div ref={mapRef} style={{ width:"100%", height:"100%" }} />

          {/* Top-right controls */}
          <div style={{ position:"absolute", top:10, right:10, zIndex:1000, display:"flex", flexDirection:"column", gap:6, alignItems:"flex-end" }}>
            <button onClick={runBriefing} disabled={briefingLoading || !newsArticles.length}
              style={{ background:"#00ff9d14", border:"1px solid #00ff9d44", color:"#00ff9d", padding:"6px 12px", borderRadius:4, fontFamily:"inherit", fontSize:10, fontWeight:700, letterSpacing:".1em", cursor:"pointer", display:"flex", alignItems:"center", gap:6, boxShadow:"0 0 14px #00ff9d18" }}>
              {briefingLoading ? <><div className="spin" style={{ width:9,height:9,border:"1.5px solid transparent",borderTopColor:"#00ff9d",borderRadius:"50%" }}/>ANALYSING…</> : <>▶ AI BRIEFING</>}
            </button>
            <button onClick={() => setShowKeyInput(v=>!v)}
              style={{ background:apiKeySet?"#00ff9d0a":"#ffd70014", border:`1px solid ${apiKeySet?"#00ff9d33":"#ffd70044"}`, color:apiKeySet?"#00ff9d66":"#ffd700", padding:"4px 10px", borderRadius:4, fontFamily:"inherit", fontSize:9, fontWeight:700, letterSpacing:".08em", cursor:"pointer" }}>
              {apiKeySet ? "✓ GROQ ACTIVE" : "⚙ SET GROQ KEY"}
            </button>
          </div>

          {/* Groq key panel */}
          {showKeyInput && (
            <div className="fade-in" style={{ position:"absolute", top:82, right:10, zIndex:1002, background:"#0d1117fa", border:"1px solid #ffd70055", borderRadius:6, padding:"12px 14px", width:255, boxShadow:"0 0 20px #ffd70015" }}>
              <p style={{ color:"#ffd700", fontSize:10, fontWeight:700, letterSpacing:".08em", marginBottom:7 }}>GROQ API KEY</p>
              <input className="key-input" type="password" placeholder="gsk_..." value={apiKeyInput}
                onChange={e => setApiKeyInput(e.target.value)}
                onKeyDown={e => { if(e.key==="Enter" && apiKeyInput.trim()) { window.__GROQ_API_KEY=apiKeyInput.trim(); setApiKeySet(true); setShowKeyInput(false); detectedRef.current=false; } }}
              />
              <div style={{ display:"flex", gap:6, marginTop:8 }}>
                <button onClick={() => { if(apiKeyInput.trim()) { window.__GROQ_API_KEY=apiKeyInput.trim(); setApiKeySet(true); setShowKeyInput(false); detectedRef.current=false; } }}
                  style={{ flex:1, background:"#ffd70018", border:"1px solid #ffd70044", color:"#ffd700", padding:"5px", borderRadius:3, fontFamily:"inherit", fontSize:10, cursor:"pointer", fontWeight:700 }}>SAVE</button>
                <button onClick={() => setShowKeyInput(false)}
                  style={{ background:"transparent", border:"1px solid #1c2333", color:"#8b949e", padding:"5px 10px", borderRadius:3, fontFamily:"inherit", fontSize:10, cursor:"pointer" }}>✕</button>
              </div>
              <p style={{ color:"#8b949e55", fontSize:9, marginTop:6, lineHeight:1.5 }}>Stored in memory only. Free key at console.groq.com</p>
            </div>
          )}

          {/* Global briefing overlay */}
          {briefing && (
            <div className="fade-in scroll-thin" style={{ position:"absolute", top:46, right:10, zIndex:1001, background:"#0d1117f7", border:"1px solid #00ff9d33", borderRadius:6, padding:"13px 15px", width:315, maxHeight:330, overflowY:"auto", boxShadow:"0 0 24px #00ff9d10" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:9 }}>
                <span style={{ color:"#00ff9d", fontSize:10, fontWeight:700, letterSpacing:".1em" }}>AI GLOBAL BRIEFING</span>
                <button onClick={() => setBriefing(null)} style={{ background:"none", border:"none", color:"#8b949e", cursor:"pointer", fontSize:16, lineHeight:1 }}>×</button>
              </div>
              {briefing.split("\n").map((line,i) => {
                const t = line.trim();
                if (!t) return <div key={i} style={{ height:4 }} />;
                if (/^\d\./.test(t)) return <div key={i} style={{ color:"#ffd700", fontSize:10, fontWeight:700, letterSpacing:".08em", marginTop:11, marginBottom:4, borderBottom:"1px solid #ffd70020", paddingBottom:3 }}>{t.toUpperCase()}</div>;
                if (/^[→•\-]/.test(t)) return <div key={i} style={{ display:"flex", gap:6, marginBottom:4 }}><span style={{ color:"#00ff9d", flexShrink:0 }}>▸</span><span style={{ color:"#c9d1d9", fontSize:11, lineHeight:1.6 }}>{t.replace(/^[→•\-]\s*/,"")}</span></div>;
                return <p key={i} style={{ color:"#c9d1d9", fontSize:11, lineHeight:1.65, marginBottom:3 }}>{t}</p>;
              })}
            </div>
          )}

          {/* Portfolio exposure filter */}
          {holdings.length > 0 && (
            <div style={{ position:"absolute", top:10, left:10, zIndex:1000, background:"#0d1117ee", border:"1px solid #1c2333", borderRadius:5, padding:"9px 11px", minWidth:165 }}>
              <p style={{ color:"#8b949e", fontSize:9, letterSpacing:".08em", marginBottom:6 }}>EXPOSURE FILTER</p>
              <select style={{ background:"#161b22", border:"1px solid #1c2333", color:"#c9d1d9", padding:"4px 7px", borderRadius:3, fontFamily:"inherit", fontSize:10, width:"100%", cursor:"pointer" }}
                value={ticker??""} onChange={e => setTicker(e.target.value||null)}>
                <option value="">All regions</option>
                {holdings.map(h => <option key={h.ticker} value={h.ticker}>{h.ticker} — {h.name}</option>)}
              </select>
              {ticker && <p style={{ color:"#ffd700", fontSize:9, marginTop:5 }}>● {ticker} exposure highlighted</p>}
            </div>
          )}

          {/* Selected hotspot card */}
          {selected && (
            <div className="fade-in" style={{ position:"absolute", bottom:14, left:14, zIndex:1000, background:"#0d1117f8", border:`1px solid ${riskColor(selected.risk)}44`, borderRadius:6, padding:"13px 15px", maxWidth:330, boxShadow:`0 0 28px ${riskColor(selected.risk)}15` }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                <div>
                  <div style={{ color:"#c9d1d9", fontWeight:700, fontSize:13, marginBottom:4 }}>
                    {selected.name}
                    {selected.isAiGenerated && <span style={{ marginLeft:7, fontSize:8, background:"#ffd70020", color:"#ffd700", border:"1px solid #ffd70044", padding:"1px 5px", borderRadius:3 }}>AI DETECTED</span>}
                  </div>
                  <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                    <span style={{ background:riskColor(selected.risk)+"22", color:riskColor(selected.risk), border:`1px solid ${riskColor(selected.risk)}44`, padding:"1px 7px", borderRadius:3, fontSize:9, letterSpacing:".08em" }}>{selected.risk.toUpperCase()}</span>
                    <span style={{ color:"#8b949e", fontSize:9 }}>{selected.category}</span>
                    {selectedNews.length > 0 && <span style={{ color:"#ff2d2d", fontSize:9, background:"#ff2d2d18", padding:"1px 5px", borderRadius:2 }}>{selectedNews.length} articles</span>}
                  </div>
                </div>
                <button onClick={() => { setSelected(null); setAiAnalysis(null); }} style={{ background:"none", border:"none", color:"#8b949e", cursor:"pointer", fontSize:18, lineHeight:1, padding:0 }}>×</button>
              </div>

              <p style={{ color:"#8b949e", fontSize:11, lineHeight:1.65, marginBottom:10 }}>{selected.detail}</p>

              {selectedNews.length > 0 && (
                <div style={{ marginBottom:9, padding:"8px 10px", background:"#ffd70010", border:"1px solid #ffd70030", borderRadius:4 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                    <span style={{ color:"#ffd700", fontSize:9, fontWeight:700 }}>📰 {selectedNews.length} RELATED ARTICLES</span>
                    <button onClick={() => runHotspotAnalysis(selected)} disabled={aiLoading}
                      style={{ background:"#00ff9d18", border:"1px solid #00ff9d44", color:aiLoading?"#8b949e":"#00ff9d", padding:"2px 9px", borderRadius:3, fontFamily:"inherit", fontSize:9, cursor:"pointer", fontWeight:700, letterSpacing:".06em" }}>
                      {aiLoading ? "ANALYSING…" : "AI ANALYSIS"}
                    </button>
                  </div>
                  {selectedNews.slice(0,3).map((a,i) => (
                    <a key={i} href={a.url} target="_blank" rel="noreferrer" style={{ display:"flex", gap:5, marginBottom:4, textDecoration:"none" }}>
                      <span style={{ color:sentiment(a.title).color, fontSize:8, flexShrink:0, marginTop:2 }}>●</span>
                      <span style={{ color:"#c9d1d9cc", fontSize:10, lineHeight:1.4 }}>[{a.source}] {a.title.slice(0,62)}{a.title.length>62?"…":""}</span>
                    </a>
                  ))}
                </div>
              )}

              {aiLoading && (
                <div style={{ display:"flex", alignItems:"center", gap:7, padding:"4px 0" }}>
                  <div className="spin" style={{ width:11,height:11,border:"1.5px solid #1c2333",borderTopColor:"#00ff9d",borderRadius:"50%",flexShrink:0 }} />
                  <span style={{ color:"#8b949e", fontSize:11 }}>Analysing latest intel…</span>
                </div>
              )}
              {aiAnalysis && !aiLoading && (
                <div className="fade-in" style={{ padding:"10px 11px", background:"#00ff9d08", border:"1px solid #00ff9d22", borderRadius:4 }}>
                  <div style={{ color:"#00ff9d", fontSize:9, fontWeight:700, letterSpacing:".1em", marginBottom:5 }}>AI RISK ASSESSMENT</div>
                  <p style={{ color:"#c9d1d9", fontSize:11, lineHeight:1.7 }}>{aiAnalysis}</p>
                </div>
              )}

              {holdings.length > 0 && (() => {
                const hit = holdings.filter(h => (TICKER_GEO[h.ticker]??[]).includes(selected.id));
                return hit.length > 0 ? (
                  <div style={{ marginTop:9, paddingTop:9, borderTop:"1px solid #1c2333" }}>
                    <p style={{ color:"#ffd700", fontSize:9, marginBottom:5 }}>⚠ PORTFOLIO EXPOSURE:</p>
                    <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>{hit.map(h => <span key={h.ticker} className="ticker-tag">{h.ticker}</span>)}</div>
                  </div>
                ) : null;
              })()}
            </div>
          )}

          {!mapLoaded && (
            <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", background:"#060a0f", zIndex:999 }}>
              <div style={{ textAlign:"center" }}>
                <div className="spin" style={{ width:22,height:22,border:"2px solid #1c2333",borderTopColor:"#00ff9d",borderRadius:"50%",margin:"0 auto 12px" }} />
                <p style={{ color:"#8b949e", fontSize:12 }}>Initialising map…</p>
              </div>
            </div>
          )}
        </div>

        {/* Market stress ticker */}
        <div style={{ borderTop:"1px solid #1c2333", padding:"6px 12px", background:"#0a0e14", display:"flex", gap:18, overflowX:"auto" }}>
          {MARKET_STRESS.map(s => (
            <div key={s.label} style={{ whiteSpace:"nowrap" }}>
              <span style={{ color:"#8b949e44", fontSize:9 }}>{s.label} </span>
              <span style={{ color:s.color, fontWeight:600, fontSize:11 }}>{s.value} </span>
              <span style={{ color:s.change.startsWith("+")?RC.low:RC.high, fontSize:9 }}>{s.change}</span>
            </div>
          ))}
          <span style={{ marginLeft:"auto", color:"#8b949e33", fontSize:9, flexShrink:0, whiteSpace:"nowrap" }}>
            {hotspots.length} zones · {newsArticles.length} articles
          </span>
        </div>
      </div>

      {/* ══════════ RIGHT — SIDEBAR ══════════ */}
      <div style={{ display:"flex", flexDirection:"column", overflow:"hidden", background:"#0a0e14" }}>

        {/* Risk counts */}
        <div style={{ padding:"9px 12px", borderBottom:"1px solid #1c2333" }}>
          <p style={{ color:"#8b949e", fontSize:9, letterSpacing:".08em", marginBottom:7 }}>GLOBAL RISK · {hotspots.length} ZONES</p>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:5 }}>
            {[{l:"CRITICAL",c:riskCounts.critical,col:RC.critical},{l:"HIGH",c:riskCounts.high,col:RC.high},{l:"MEDIUM",c:riskCounts.medium,col:RC.medium}].map(({l,c,col}) => (
              <div key={l} style={{ background:"#0d1117", border:`1px solid ${col}33`, borderRadius:4, padding:"7px 4px", textAlign:"center" }}>
                <div style={{ color:col, fontSize:18, fontWeight:700 }}>{c}</div>
                <div style={{ color:"#8b949e", fontSize:8, letterSpacing:".07em" }}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ display:"flex", borderBottom:"1px solid #1c2333", background:"#0d1117" }}>
          {[{id:"alerts",label:"ALERTS"},{id:"news",label:`NEWS${newsArticles.length?` (${newsArticles.length})`:""}`},{id:"bloomberg",label:"▶ MEDIA"}].map(t => (
            <button key={t.id} className="rtab" onClick={() => setRightTab(t.id)}
              style={{ borderBottom:`2px solid ${rightTab===t.id?"#00ff9d":"transparent"}`, background:"transparent", color:rightTab===t.id?"#00ff9d":"#8b949e" }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── ALERTS TAB ── */}
        {rightTab === "alerts" && (
          <div style={{ flex:1, overflowY:"auto" }} className="scroll-thin">
            {holdings.length > 0 && (
              <div style={{ padding:"9px 12px", borderBottom:"1px solid #1c2333" }}>
                <p style={{ color:"#8b949e", fontSize:9, letterSpacing:".08em", marginBottom:7 }}>PORTFOLIO GEO-RISK</p>
                {exposureData.map(h => (
                  <div key={h.ticker} onClick={() => setTicker(h.ticker)}
                    style={{ display:"flex", alignItems:"center", gap:7, padding:"6px 8px", background:"#0d1117", border:`1px solid ${riskColor(h.maxRisk)}18`, borderRadius:4, cursor:"pointer", marginBottom:4 }}>
                    <span className="ticker-tag">{h.ticker}</span>
                    <div style={{ flex:1, display:"flex", gap:3, flexWrap:"wrap" }}>
                      {h.hotspots.slice(0,2).map(s => <span key={s.id} style={{ fontSize:8, color:riskColor(s.risk), background:riskColor(s.risk)+"14", padding:"1px 4px", borderRadius:2 }}>{s.name.split(" ")[0]}</span>)}
                      {!h.hotspots.length && <span style={{ fontSize:8, color:"#8b949e" }}>No exposure</span>}
                    </div>
                    <div style={{ width:7,height:7,borderRadius:"50%",background:riskColor(h.maxRisk),boxShadow:`0 0 4px ${riskColor(h.maxRisk)}` }} />
                  </div>
                ))}
              </div>
            )}

            {/* Zone list sorted by risk */}
            <div style={{ padding:"8px 12px 4px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <p style={{ color:"#8b949e", fontSize:9, letterSpacing:".08em" }}>ALL ZONES ({hotspots.length})</p>
              {aiNewHotspots.length > 0 && <span style={{ color:"#ffd700", fontSize:8, background:"#ffd70015", border:"1px solid #ffd70033", padding:"1px 5px", borderRadius:3 }}>{aiNewHotspots.length} AI-ADDED</span>}
            </div>
            {hotspots.slice().sort((a,b)=>RISK_ORDER[b.risk]-RISK_ORDER[a.risk]).map(spot => (
              <div key={spot.id} className="alert-row" onClick={() => setSelected(spot)}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:2 }}>
                  <span style={{ color:"#c9d1d9", fontSize:11, fontWeight:500 }}>{spot.name}</span>
                  <div style={{ display:"flex", gap:5, alignItems:"center" }}>
                    {(hotspotNews[spot.id]??[]).length > 0 && (
                      <span style={{ background:"#ff2d2d1a", color:"#ff2d2d", fontSize:8, padding:"1px 4px", borderRadius:2 }}>{(hotspotNews[spot.id]??[]).length}</span>
                    )}
                    {spot.isAiGenerated && <span style={{ color:"#ffd70055", fontSize:8, fontStyle:"italic" }}>AI</span>}
                    <div style={{ width:7,height:7,borderRadius:"50%",background:riskColor(spot.risk),boxShadow:`0 0 4px ${riskColor(spot.risk)}` }} />
                  </div>
                </div>
                <div style={{ color:"#8b949e44", fontSize:9 }}>{spot.category}</div>
              </div>
            ))}

            {/* ReliefWeb alerts */}
            <div style={{ padding:"8px 12px 4px", display:"flex", justifyContent:"space-between", alignItems:"center", borderTop:"1px solid #1c2333", marginTop:6 }}>
              <p style={{ color:"#8b949e", fontSize:9, letterSpacing:".08em" }}>RELIEFWEB CRISIS ALERTS</p>
              <span style={{ display:"flex", alignItems:"center", gap:4 }}>
                <span className="blink" style={{ width:5,height:5,borderRadius:"50%",background:RC.critical,display:"inline-block" }} />
                <span style={{ color:RC.critical, fontSize:8 }}>LIVE</span>
              </span>
            </div>
            {loadingAlerts
              ? <div style={{ padding:16, textAlign:"center" }}><div className="spin" style={{ width:14,height:14,border:"2px solid #1c2333",borderTopColor:"#00ff9d",borderRadius:"50%",margin:"0 auto 7px" }} /></div>
              : alerts.map(a => (
                <div key={a.id} className="alert-row">
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:2 }}>
                    <span style={{ color:"#c9d1d9", fontSize:11 }}>{a.country}</span>
                    <span style={{ color:"#8b949e44", fontSize:9 }}>{a.date}</span>
                  </div>
                  <div style={{ color:"#8b949e", fontSize:10, marginBottom:3 }}>{a.name}</div>
                  <span style={{ fontSize:8, background:"#ff6b3518", color:"#ff6b35", border:"1px solid #ff6b3530", padding:"1px 5px", borderRadius:2 }}>{a.type}</span>
                </div>
              ))
            }
          </div>
        )}

        {/* ── NEWS TAB ── */}
        {rightTab === "news" && (
          <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
            <div style={{ padding:"6px 12px", borderBottom:"1px solid #1c2333", display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ color:"#8b949e55", fontSize:9 }}>{loadingNews?"syncing…":`${newsArticles.length} articles · ${GEO_FEEDS.length} feeds`}</span>
              <button onClick={fetchNews} disabled={loadingNews} style={{ marginLeft:"auto", background:"transparent", border:"1px solid #1c2333", color:"#8b949e", padding:"2px 8px", borderRadius:3, fontFamily:"inherit", fontSize:9, cursor:"pointer" }}>
                {loadingNews?"…":"↻"}
              </button>
            </div>

            {selected && selectedNews.length > 0 && (
              <div style={{ padding:"8px 12px", background:`${riskColor(selected.risk)}0a`, borderBottom:"1px solid #1c2333" }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:5 }}>
                  <span style={{ color:riskColor(selected.risk), fontSize:9, fontWeight:700 }}>📍 {selected.name.toUpperCase()} ({selectedNews.length})</span>
                  <button onClick={() => runHotspotAnalysis(selected)} disabled={aiLoading}
                    style={{ background:"#00ff9d18", border:"1px solid #00ff9d44", color:"#00ff9d", padding:"2px 8px", borderRadius:3, fontFamily:"inherit", fontSize:9, cursor:"pointer", fontWeight:700 }}>
                    {aiLoading?"…":"AI"}
                  </button>
                </div>
                {selectedNews.slice(0,3).map((a,i) => (
                  <a key={i} href={a.url} target="_blank" rel="noreferrer" style={{ display:"block", textDecoration:"none", marginBottom:4 }}>
                    <div style={{ display:"flex", gap:5 }}>
                      <span style={{ color:sentiment(a.title).color, fontSize:8, flexShrink:0, marginTop:2 }}>●</span>
                      <span style={{ color:"#c9d1d9cc", fontSize:10, lineHeight:1.4 }}>{a.title.slice(0,70)}{a.title.length>70?"…":""}</span>
                    </div>
                    <span style={{ color:"#8b949e44", fontSize:8, marginLeft:13 }}>{a.source} · {a.time}</span>
                  </a>
                ))}
              </div>
            )}

            <div style={{ flex:1, overflowY:"auto" }} className="scroll-thin">
              {loadingNews && !newsArticles.length && (
                <div style={{ padding:24, textAlign:"center" }}>
                  <div className="spin" style={{ width:16,height:16,border:"2px solid #1c2333",borderTopColor:"#00ff9d",borderRadius:"50%",margin:"0 auto 9px" }} />
                  <p style={{ color:"#8b949e", fontSize:11 }}>Loading {GEO_FEEDS.length} feeds…</p>
                </div>
              )}
              {newsArticles.map(art => {
                const s = sentiment(art.title);
                const spots = articleToHotspots(art, hotspots);
                return (
                  <div key={art.id} className="news-row">
                    <a href={art.url} target="_blank" rel="noreferrer" style={{ textDecoration:"none" }}>
                      <div style={{ display:"flex", gap:5 }}>
                        <span style={{ color:s.color, fontSize:8, flexShrink:0, marginTop:3 }}>●</span>
                        <div>
                          <div style={{ color:"#c9d1d9", fontSize:11, lineHeight:1.5, marginBottom:3 }}>{art.title}</div>
                          <div style={{ display:"flex", gap:6, alignItems:"center", flexWrap:"wrap" }}>
                            <span style={{ color:"#00ff9d55", fontSize:9 }}>{art.source}</span>
                            <span style={{ color:"#8b949e33", fontSize:9 }}>{art.time}</span>
                            {spots.slice(0,2).map(h => (
                              <span key={h.id} onClick={e => { e.preventDefault(); setSelected(h); }}
                                style={{ fontSize:8, color:riskColor(h.risk), background:riskColor(h.risk)+"14", padding:"1px 4px", borderRadius:2, cursor:"pointer", border:`1px solid ${riskColor(h.risk)}28` }}>
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

        {/* ── BLOOMBERG / MEDIA TAB ── */}
        {rightTab === "bloomberg" && (
          <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
            {/* Sub nav */}
            <div style={{ display:"flex", borderBottom:"1px solid #1c2333" }}>
              {[{id:"info",label:"INFO"},{id:"live",label:"🔴 LIVE"},{id:"programs",label:"PROGRAMS"}].map(t => (
                <button key={t.id} className="rtab" onClick={() => setBloombergView(t.id)}
                  style={{ borderBottom:`2px solid ${bloombergView===t.id?"#ffd700":"transparent"}`, background:"transparent", color:bloombergView===t.id?"#ffd700":"#8b949e" }}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* INFO */}
            {bloombergView === "info" && (
              <div style={{ flex:1, overflowY:"auto", padding:"12px 13px" }} className="scroll-thin">
                <div style={{ background:"#ffd70010", border:"1px solid #ffd70030", borderRadius:5, padding:"11px 13px", marginBottom:11 }}>
                  <p style={{ color:"#ffd700", fontSize:11, fontWeight:700, marginBottom:7 }}>📺 Bloomberg Television</p>
                  <p style={{ color:"#c9d1d9", fontSize:11, lineHeight:1.65, marginBottom:11 }}>Access Bloomberg's 24/7 financial news, markets coverage, and geopolitical analysis.</p>
                  {[
                    { label:"bloomberg.com/live",        url:"https://www.bloomberg.com/live",                     desc:"Official live stream" },
                    { label:"YouTube Live Streams",      url:"https://www.youtube.com/@Bloomberg/streams",          desc:"Free Bloomberg live & replays" },
                    { label:"Bloomberg Markets",         url:"https://www.bloomberg.com/markets",                   desc:"Real-time market data" },
                    { label:"Bloomberg Technology",      url:"https://www.bloomberg.com/technology",                desc:"Tech & AI coverage" },
                    { label:"Bloomberg Podcasts",        url:"https://www.bloomberg.com/podcasts",                  desc:"Audio programs on demand" },
                    { label:"Odd Lots Podcast",          url:"https://www.bloomberg.com/podcasts/odd-lots",         desc:"Macro & finance deep dives" },
                  ].map(l => (
                    <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="media-link">
                      <div>
                        <div style={{ color:"#ffd700", fontSize:11, fontWeight:600 }}>→ {l.label}</div>
                        <div style={{ color:"#8b949e", fontSize:9, marginTop:2 }}>{l.desc}</div>
                      </div>
                      <span style={{ color:"#8b949e33", fontSize:13 }}>↗</span>
                    </a>
                  ))}
                </div>

                <div style={{ background:"#00ff9d08", border:"1px solid #00ff9d22", borderRadius:5, padding:"11px 13px" }}>
                  <p style={{ color:"#00ff9d", fontSize:10, fontWeight:700, marginBottom:8 }}>📡 ACTIVE RSS FEEDS</p>
                  {GEO_FEEDS.map(f => (
                    <div key={f.id} style={{ display:"flex", justifyContent:"space-between", marginBottom:5, padding:"4px 0", borderBottom:"1px solid #00ff9d0a" }}>
                      <span style={{ color:"#c9d1d9", fontSize:10 }}>{f.label}</span>
                      <span style={{ color:"#00ff9d55", fontSize:9 }}>● LIVE</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* LIVE */}
            {bloombergView === "live" && (
              <div style={{ flex:1, display:"flex", flexDirection:"column" }}>
                <div style={{ padding:"7px 12px", background:"#ff2d2d0c", borderBottom:"1px solid #ff2d2d20", display:"flex", alignItems:"center", gap:7 }}>
                  <span className="blink" style={{ width:7,height:7,borderRadius:"50%",background:RC.critical,boxShadow:`0 0 6px ${RC.critical}`,display:"inline-block",flexShrink:0 }} />
                  <span style={{ color:RC.critical, fontSize:10, fontWeight:700, letterSpacing:".08em" }}>BLOOMBERG LIVE — YOUTUBE</span>
                </div>
                {/* Bloomberg official YouTube live stream */}
                <div style={{ flex:1, background:"#000", minHeight:200 }}>
                  <iframe
                    src="https://www.youtube.com/embed/live_stream?channel=UCIALMKvObZNtJ6AmdCLP7Lg&autoplay=0&rel=0"
                    style={{ width:"100%", height:"100%", border:"none", minHeight:200 }}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen title="Bloomberg Live"
                    sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation"
                  />
                </div>
                <div style={{ padding:"7px 12px", borderTop:"1px solid #1c2333", background:"#0d1117" }}>
                  <p style={{ color:"#8b949e44", fontSize:9, marginBottom:5 }}>If stream doesn't load, open directly:</p>
                  <div style={{ display:"flex", gap:12 }}>
                    <a href="https://www.bloomberg.com/live" target="_blank" rel="noreferrer" style={{ color:"#ffd700", fontSize:10, textDecoration:"none" }}>→ Bloomberg.com/live</a>
                    <a href="https://www.youtube.com/@Bloomberg/streams" target="_blank" rel="noreferrer" style={{ color:"#ffd700", fontSize:10, textDecoration:"none" }}>→ YouTube</a>
                  </div>
                </div>
              </div>
            )}

            {/* PROGRAMS */}
            {bloombergView === "programs" && (
              <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
                <div style={{ flex:1, overflowY:"auto", padding:"8px 8px" }} className="scroll-thin">
                  {[
                    { title:"Bloomberg Surveillance",    desc:"Morning macro & Fed watch",     url:"https://www.bloomberg.com/shows/bloomberg-surveillance" },
                    { title:"Bloomberg Markets Open",    desc:"Pre-market open analysis",      url:"https://www.bloomberg.com/shows/bloomberg-markets" },
                    { title:"Bloomberg Technology",      desc:"Tech & AI sector focus",        url:"https://www.bloomberg.com/shows/bloomberg-technology" },
                    { title:"Bloomberg The Open",        desc:"Daily market open briefing",    url:"https://www.youtube.com/@Bloomberg/streams" },
                    { title:"Odd Lots",                  desc:"In-depth macro interviews",     url:"https://www.bloomberg.com/podcasts/odd-lots" },
                    { title:"Bloomberg Crypto",          desc:"Digital assets coverage",       url:"https://www.bloomberg.com/crypto" },
                    { title:"Bloomberg Balance of Power",desc:"Geopolitics & policy focus",   url:"https://www.bloomberg.com/shows/balance-of-power" },
                    { title:"Bloomberg Intelligence",    desc:"Research & analytics",          url:"https://www.bloomberg.com/professional/product/bloomberg-intelligence/" },
                  ].map(p => (
                    <a key={p.url} href={p.url} target="_blank" rel="noreferrer" style={{ textDecoration:"none", display:"block" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:9, padding:"9px 10px", borderRadius:4, marginBottom:4, border:"1px solid transparent", transition:"all .12s", cursor:"pointer" }}
                        onMouseEnter={e => { e.currentTarget.style.background="#ffffff05"; e.currentTarget.style.borderColor="#1c2333"; }}
                        onMouseLeave={e => { e.currentTarget.style.background="transparent"; e.currentTarget.style.borderColor="transparent"; }}>
                        <span style={{ color:"#ffd70066", fontSize:13, flexShrink:0 }}>▶</span>
                        <div style={{ flex:1 }}>
                          <div style={{ color:"#c9d1d9", fontSize:11, fontWeight:600 }}>{p.title}</div>
                          <div style={{ color:"#8b949e", fontSize:9, marginTop:2 }}>{p.desc}</div>
                        </div>
                        <span style={{ color:"#8b949e33", fontSize:12 }}>↗</span>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
