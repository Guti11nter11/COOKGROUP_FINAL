import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { gira } from "./gira-client";
import { listingsFor, TICKETERS } from "./ticketers-lib";

/**
 * Ticketeras sin API (Entradas.com/Eventim, El Corte Inglés, See Tickets, AXS): dos veces al día, por
 * turnos, la búsqueda de cada artista ⭐⭐⭐ con Cloudflare Browser Run (navegador real, una página cada
 * ~10 s, dentro de los 10 min/día gratis). Avisa de fichas nuevas; la primera lectura es línea base.
 */
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID;
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
if (!ACCOUNT || !TOKEN) throw new Error("Faltan CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN");
const STATE = ".ticketers-state/state.json";
const PER_RUN = Number(process.env.ARTISTS_PER_RUN ?? 4); // 4 artistas × 4 ticketeras × 2 pasadas ≈ 8 min de navegador al día

type State = { cursor: number; seen: Record<string, string[]> };
const state: State = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : { cursor: 0, seen: {} };
const top = (JSON.parse(readFileSync("data/artists.resolved.json", "utf8")) as { name: string; tier: number }[]).filter((a) => a.tier >= 3).map((a) => a.name);
const batch = Array.from({ length: Math.min(PER_RUN, top.length) }, (_, i) => top[(state.cursor + i) % top.length]!);
state.cursor = (state.cursor + batch.length) % Math.max(1, top.length);

async function render(url: string): Promise<string | null> {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/browser-rendering/content`, {
    method: "POST",
    headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ url, gotoOptions: { waitUntil: "networkidle2", timeout: 30000 }, rejectResourceTypes: ["image", "media", "font"] }),
    signal: AbortSignal.timeout(70_000),
  }).catch(() => null);
  if (!res?.ok) {
    console.log(`  ✗ ${url} → HTTP ${res?.status ?? "sin respuesta"}`);
    return null;
  }
  return ((await res.json()) as { result?: string }).result ?? null;
}

const news: { artistName: string; title: string; url: string; source: string; category: string; summary: string }[] = [];
for (const artist of batch) {
  for (const t of TICKETERS) {
    const url = t.search(artist);
    const html = await render(url);
    await new Promise((r) => setTimeout(r, 10_000)); // una página cada ~10 s
    if (!html) continue;
    const found = listingsFor(html, url, artist, t);
    const key = `${t.id}|${artist}`;
    const before = state.seen[key];
    const fresh = before ? found.filter((f) => !before.includes(f.url)) : [];
    state.seen[key] = [...new Set([...(before ?? []), ...found.map((f) => f.url)])].slice(-200);
    console.log(`${artist} · ${t.name}: ${found.length} fichas${before ? ` · ${fresh.length} nuevas` : " (línea base)"}`);
    for (const f of fresh.slice(0, 5)) {
      news.push({ artistName: artist, title: f.text, url: f.url, source: t.name, category: "on_sale", summary: `Nueva ficha en ${t.name}: ${f.text}` });
    }
  }
}
if (news.length) console.log(JSON.stringify(await gira("/enrich/news", { items: news })));
mkdirSync(".ticketers-state", { recursive: true });
writeFileSync(STATE, JSON.stringify(state));
