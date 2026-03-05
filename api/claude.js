export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // Parse body manually
  let body = req.body;
  if (typeof body === 'string') {
    body = JSON.parse(body);
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  
  // Log error details if it fails
  if (!response.ok) {
    console.error("Anthropic error:", data);
  }

  res.status(response.status).json(data);
}