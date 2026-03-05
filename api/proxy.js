// api/proxy.js
// Fix: replaced deprecated url.parse() with new URL() (WHATWG standard)
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "No URL provided" });

  let decoded;
  try {
    decoded = decodeURIComponent(url);
    const parsed = new URL(decoded); // ← was url.parse(), now WHATWG URL
    const allowed = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"];
    if (!allowed.includes(parsed.hostname))
      return res.status(403).json({ error: "Domain not allowed" });
  } catch {
    return res.status(400).json({ error: "Invalid URL" });
  }

  try {
    const upstream = await fetch(decoded, {
      headers: {
        "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        "Accept":          "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Origin":          "https://finance.yahoo.com",
        "Referer":         "https://finance.yahoo.com/",
        "Cache-Control":   "no-cache",
      },
    });

    const data = await upstream.json();
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60");
    return res.status(upstream.status).json(data);
  } catch (err) {
    console.error("[proxy] error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
