import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { gira } from "./gira-client";
import { axsMatchAll, listingsFor, TICKETERS } from "./ticketers-lib";

/**
 * Ticketeras sin API (Entradas.com/Eventim, El Corte Inglés, See Tickets, AXS): dos veces al día, por
 * turnos, la búsqueda de cada artista ⭐⭐⭐ con Cloudflare Browser Run (navegador real, una página cada
 * ~10 s, dentro de los 10 min/día gratis). Avisa de fichas nuevas; la primera lectura es línea base.
 */
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID;
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
if (!ACCOUNT || !TOKEN) throw new Error("Faltan CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN");
const STATE = ".ticketers-state/state.json";
const PER_RUN = Number(process.env.ARTISTS_PER_RUN ?? 5); // 5 artistas × 4 ticketeras × 2 pasadas ≈ 40 páginas (< 10 min de navegador al día)

type State = { cursor: number; seen: Record<string, string[]>; axs?: Record<string, number[]>; axsDay?: string };
const state: State = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : { cursor: 0, seen: {} };
const top = (JSON.parse(readFileSync("data/artists.resolved.json", "utf8")) as { name: string; tier: number }[]).filter((a) => a.tier >= 3).map((a) => a.name);
const batch = Array.from({ length: Math.min(PER_RUN, top.length) }, (_, i) => top[(state.cursor + i) % top.length]!);
const startCursor = state.cursor;

let limited = false; // 429: cupo diario de Browser Run agotado → parar y retomar en la próxima pasada
async function render(url: string): Promise<string | null> {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/browser-rendering/content`, {
    method: "POST",
    headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ url, gotoOptions: { waitUntil: "networkidle2", timeout: 30000 }, rejectResourceTypes: ["image", "media", "font"] }),
    signal: AbortSignal.timeout(70_000),
  }).catch(() => null);
  if (!res?.ok) {
    if (res?.status === 429) limited = true;
    console.log(`  ✗ ${url} → HTTP ${res?.status ?? "sin respuesta"}`);
    return null;
  }
  return ((await res.json()) as { result?: string }).result ?? null;
}

const news: { artistName: string; title: string; url: string; source: string; category: string; summary: string }[] = [];
let done = 0;
for (const artist of batch) {
  if (limited) break;
  done++;
  for (const t of TICKETERS.filter((x) => x.enabled !== false)) {
    if (limited) break;
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
// El turno avanza solo por los artistas leídos de verdad (si hubo 429, el último se repite).
state.cursor = (startCursor + (limited ? Math.max(0, done - 1) : done)) % Math.max(1, top.length);
if (limited) console.log("Browser Run: cupo del día agotado; se retoma en la próxima pasada");

// AXS por sus sitemaps públicos (robots.txt los anuncia): una vez al día, sin navegador, artistas ⭐⭐ y ⭐⭐⭐.
const day = new Date().toISOString().slice(0, 10);
if (state.axsDay !== day) {
  state.axs ??= {};
  const followed = (JSON.parse(readFileSync("data/artists.resolved.json", "utf8")) as { name: string; tier: number }[]).filter((a) => a.tier >= 2).map((a) => a.name);
  const index = await fetch("https://www.static.discovery-prod.axs.com/uploads/sitemaps/sitemap_index.xml", { headers: { "User-Agent": "GIRA/0.1 (+https://github.com/Guti11nter11/COOKGROUP_FINAL)" } })
    .then((r) => (r.ok ? r.text() : ""))
    .catch(() => "");
  const maps = [...index.matchAll(/<loc>([^<]*sitemap_event_(uk|de|fr|se)(_\d+)?\.xml)<\/loc>/g)].map((m) => m[1]!);
  const found = new Map<string, { url: string; id: number }[]>();
  for (const map of maps) {
    const xml = await fetch(map, { headers: { "User-Agent": "GIRA/0.1 (+https://github.com/Guti11nter11/COOKGROUP_FINAL)" } }).then((r) => (r.ok ? r.text() : "")).catch(() => "");
    for (const [artist, events] of axsMatchAll(xml, followed)) found.set(artist, [...(found.get(artist) ?? []), ...events]);
    await new Promise((r) => setTimeout(r, 2000)); // Crawl-delay: 2
  }
  let nuevas = 0;
  for (const [artist, events] of found) {
    const before = state.axs[artist];
    const fresh = before ? events.filter((e) => !before.includes(e.id)) : [];
    state.axs[artist] = [...new Set([...(before ?? []), ...events.map((e) => e.id)])].slice(-300);
    if (fresh.length) {
      // Un solo aviso por artista y día (ABBA Voyage, por ejemplo, añade fechas a menudo).
      nuevas += fresh.length;
      const names = [...new Set(fresh.map((f) => decodeURIComponent(f.url.split("/").pop()!).replace(/-tickets.*$/, "").replace(/-/g, " ")))];
      news.push({
        artistName: artist,
        title: names[0]!,
        url: fresh[0]!.url,
        source: "AXS",
        category: "on_sale",
        summary: `${fresh.length === 1 ? "Nueva ficha" : `${fresh.length} fichas nuevas`} en AXS: ${names.slice(0, 3).join(", ")}${names.length > 3 ? "…" : ""}`,
      });
    }
  }
  state.axsDay = day;
  console.log(`AXS: ${maps.length} sitemaps · ${[...found.values()].flat().length} fichas de artistas seguidos · ${nuevas} nuevas`);
}

if (news.length) console.log(JSON.stringify(await gira("/enrich/news", { items: news })));
mkdirSync(".ticketers-state", { recursive: true });
writeFileSync(STATE, JSON.stringify(state));
