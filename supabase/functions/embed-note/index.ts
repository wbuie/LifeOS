import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ~512 tokens at ~1.5 words/token
const CHUNK_SIZE = 350;

function chunkText(text: string): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += CHUNK_SIZE) {
    chunks.push(words.slice(i, i + CHUNK_SIZE).join(" "));
  }
  return chunks;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  try {
    const { note_id } = await req.json();
    if (!note_id) {
      return new Response(JSON.stringify({ error: "note_id required" }), {
        status: 400,
        headers: { ...CORS, "content-type": "application/json" },
      });
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) throw new Error("OPENAI_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: note, error: noteErr } = await supabase
      .from("notes")
      .select("id, title, body")
      .eq("id", note_id)
      .eq("deleted", false)
      .single();

    if (noteErr || !note) {
      // Note deleted or not found — clear any stale chunks
      await supabase.from("note_chunks").delete().eq("note_id", note_id);
      return new Response(JSON.stringify({ embedded: 0, skipped: true }), {
        headers: { ...CORS, "content-type": "application/json" },
      });
    }

    const fullText = [note.title, note.body].filter(Boolean).join("\n\n");
    const chunks = chunkText(fullText);
    if (chunks.length === 0) {
      return new Response(JSON.stringify({ embedded: 0 }), {
        headers: { ...CORS, "content-type": "application/json" },
      });
    }

    const embedRes = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ model: "text-embedding-3-small", input: chunks }),
    });

    if (!embedRes.ok) {
      throw new Error(`OpenAI error ${embedRes.status}: ${await embedRes.text()}`);
    }

    const { data: embedData } = await embedRes.json();
    const embeddings: number[][] = embedData.map(
      (d: { embedding: number[] }) => d.embedding,
    );

    await supabase.from("note_chunks").delete().eq("note_id", note_id);

    const rows = chunks.map((content, i) => ({
      note_id,
      chunk_index: i,
      content,
      embedding: JSON.stringify(embeddings[i]),
    }));

    const { error: insertErr } = await supabase.from("note_chunks").insert(rows);
    if (insertErr) throw new Error(`Insert failed: ${insertErr.message}`);

    return new Response(JSON.stringify({ embedded: rows.length }), {
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
