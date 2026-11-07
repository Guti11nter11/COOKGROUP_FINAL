/**
 * IA con respaldo, en el orden acordado: Groq → Gemini → (de pago, último) OpenAI. Solo extracción
 * de datos de textos públicos, siempre en JSON. Si ninguna responde, devuelve null.
 */
import { UA } from "./gira-client";

type Provider = { name: string; run: (system: string, user: string) => Promise<string | null> };

const groqPreferred = ["llama-3.3-70b-versatile", "openai/gpt-oss-120b", "llama-3.1-8b-instant"];
let groqModel: string | null = process.env.GROQ_MODEL ?? null;

async function openAiCompatible(base: string, key: string, model: string, system: string, user: string): Promise<{ status: number; text: string | null }> {
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}`, "User-Agent": UA },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  }).catch(() => null);
  if (!res) return { status: 0, text: null };
  if (!res.ok) return { status: res.status, text: null };
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return { status: 200, text: data.choices?.[0]?.message?.content ?? null };
}

const groq: Provider = {
  name: "Groq",
  async run(system, user) {
    const key = process.env.GROQ_API_KEY;
    if (!key) return null;
    const base = "https://api.groq.com/openai/v1";
    const candidates = groqModel ? [groqModel] : groqPreferred;
    for (const model of candidates) {
      const r = await openAiCompatible(base, key, model, system, user);
      if (r.text) {
        groqModel = model;
        return r.text;
      }
      if (r.status === 429) await new Promise((ok) => setTimeout(ok, 8000));
    }
    return null;
  },
};

const geminiModels = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"];
const gemini: Provider = {
  name: "Gemini",
  async run(system, user) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) return null;
    for (const model of geminiModels) {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: { temperature: 0, responseMimeType: "application/json" },
        }),
      }).catch(() => null);
      if (!res?.ok) continue;
      const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("");
      if (text) return text;
    }
    return null;
  },
};

const providers = [groq, gemini];

/** Pide un JSON a la primera IA que responda. */
export async function aiJson<T>(system: string, user: string): Promise<T | null> {
  for (const p of providers) {
    try {
      const text = await p.run(system, user);
      if (!text) continue;
      const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
      return JSON.parse(json) as T;
    } catch {
      continue;
    }
  }
  return null;
}
