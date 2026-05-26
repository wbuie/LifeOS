import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `You are a personal knowledge management assistant. Given a capture text and an optional mode hint, classify it and return a JSON object with these exact keys:
- type: "effort" | "person" | "prayer" | "book" | "meeting" | "daily" | "inbox" | "task"
- domain: "work" | "faith" | "personal"
- destination: vault folder path ending in "/" (e.g. "Cards/People/", "Atlas/Efforts/", "Cards/Prayers/", "Inbox/")
- title: concise title, max 8 words
- frontmatter: object with at least { type, domain, status: "active" }
- body: cleaned markdown body
- links: string array of wikilink targets (names only, no brackets)
- reasoning: one sentence explaining the classification

Respond with ONLY valid JSON. No markdown fences, no prose.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  try {
    const { text, mode } = await req.json();
    if (!text?.trim()) {
      return new Response(JSON.stringify({ error: "text is required" }), {
        status: 400,
        headers: { ...CORS, "content-type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: SYSTEM,
        messages: [{ role: "user", content: `Mode hint: ${mode ?? "text"}\n\n${text}` }],
      }),
    });

    if (!res.ok) throw new Error(`Anthropic error ${res.status}: ${await res.text()}`);

    const { content } = await res.json();
    const result = JSON.parse(content[0].text);

    return new Response(JSON.stringify(result), {
      headers: { ...CORS, "content-type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...CORS, "content-type": "application/json" },
    });
  }
});
