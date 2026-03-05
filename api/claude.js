export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  let body = req.body;
  if (typeof body === 'string') body = JSON.parse(body);

  // Extract the prompt from the existing request
  const prompt = body.messages?.[0]?.content ?? "";

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      max_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("Groq error:", data);
    return res.status(response.status).json(data);
  }

  // Convert Groq response to Anthropic-style so your existing code works
  const text = data.choices?.[0]?.message?.content ?? "No response.";
  res.status(200).json({
    content: [{ type: "text", text }]
  });
}