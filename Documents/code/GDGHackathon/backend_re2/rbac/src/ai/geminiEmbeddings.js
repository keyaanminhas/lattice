/**
 * Optional Gemini embeddings (USE_GEMINI_EMBEDDINGS=true + GEMINI_API_KEY).
 * Falls back to local hash vectors when disabled — saves API credits by default.
 */

function useGeminiEmbeddings() {
  return (
    String(process.env.USE_GEMINI_EMBEDDINGS || "false").toLowerCase() === "true" &&
    Boolean(process.env.GEMINI_API_KEY)
  );
}

export async function getGeminiEmbedding(text) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "models/gemini-embedding-2",
      content: { parts: [{ text: String(text || "").slice(0, 8000) }] },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini embed failed: ${res.status} ${errText.slice(0, 200)}`);
  }

  const json = await res.json();
  const values = json?.embedding?.values;
  if (!values?.length) throw new Error("Gemini returned empty embedding");
  return values;
}

export { useGeminiEmbeddings };
