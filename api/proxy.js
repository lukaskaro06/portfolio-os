// api/proxy.js
// Fix: 304 Not Modified — Yahoo was returning cached data.
// Solution: append a cache-buster to every request + tell Vercel not to cache quotes.

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "No URL provided" });

  let decoded;
  try {
    decoded = decodeURIComponent(url);
    const parsed = new URL(decoded);
    const allowed = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"];
    if (!allowed.includes(parsed.hostname))
      return res.status(403).json({ error: "Domain not allowed" });

    // Append cache-buster so Yahoo never returns 304
    parsed.searchParams.set("_cb", Date.now());
    decoded = parsed.toString();
  } catch {
    return res.status(400).json({ error: "Invalid URL" });
  }

  try {
    const upstream = await fetch(decoded, {
      headers: {
        "User-Agent":       "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        "Accept":           "application/json, text/plain, */*",
        "Accept-Language":  "en-US,en;q=0.9",
        "Origin":           "https://finance.yahoo.com",
        "Referer":          "https://finance.yahoo.com/",
        // No If-None-Match / If-Modified-Since — force fresh response
        "Cache-Control":    "no-cache",
        "Pragma":           "no-cache",
      },
    });

    const data = await upstream.json();

    // Tell Vercel edge + browser: never cache this response
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    return res.status(200).json(data);
  } catch (err) {
    console.error("[proxy] error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
