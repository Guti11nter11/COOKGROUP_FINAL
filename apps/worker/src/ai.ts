import type { Env } from "./env";

/**
 * IA para leer los correos de preventa, en el orden acordado: Groq → Gemini → Workers AI. Siempre
 * devuelve JSON (o null si ninguna responde). Nunca registra el contenido que envía ni el que recibe.
 */
export async function askJson<T>(env: Env, prompt: string): Promise<T | null> {
  const parse = (t: string | undefined | null): T | null => {
    const m = t?.match(/\{[\s\S]*\}/);
    try {
      return m ? (JSON.parse(m[0]) as T) : null;
    } catch {
      return null;
    }
  };
  if (env.GROQ_API_KEY) {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { authorization: `Bearer ${env.GROQ_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ model: "llama-3.3-70b-versatile", temperature: 0, response_format: { type: "json_object" }, messages: [{ role: "user", content: prompt }] }),
    }).catch(() => null);
    if (res?.ok) {
      const out = parse(((await res.json()) as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message?.content);
      if (out) return out;
    }
  }
  if (env.GEMINI_API_KEY) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": env.GEMINI_API_KEY, "content-type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0, responseMimeType: "application/json" } }),
    }).catch(() => null);
    if (res?.ok) {
      const out = parse(((await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] }).candidates?.[0]?.content?.parts?.[0]?.text);
      if (out) return out;
    }
  }
  if (env.AI) {
    const r = (await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", { messages: [{ role: "user", content: prompt }], max_tokens: 300 }).catch(() => null)) as { response?: string } | null;
    const out = parse(r?.response);
    if (out) return out;
  }
  return null;
}
