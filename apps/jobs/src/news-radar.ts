import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { aiJson } from "./ai";
import { gira } from "./gira-client";
import { searchNews, type NewsItem } from "./news";
import { CATEGORIES, EVENT_NAMES, GENERAL_QUERIES, isTravelOffer, nameMatcher, SPORT_QUERIES, type NewsCategory } from "./news-radar-lib";

/**
 * Radar de noticias (cada 2 h): titulares de los últimos 2 días en varios países, filtrados por
 * artistas seguidos; la IA confirma el artista, lo clasifica y lo resume en español. Solo novedades.
 */
const STATE = ".news-state/seen.json";
const MAX_AGE_MS = 48 * 3600_000;
const follows: { name: string; tier: number }[] = JSON.parse(readFileSync("data/artists.resolved.json", "utf8"));
const matcher = nameMatcher([...follows.map((f) => f.name), ...EVENT_NAMES]);
const top = follows.filter((f) => f.tier >= 3).map((f) => f.name);
const hash = (t: string) => createHash("sha1").update(t).digest("hex").slice(0, 16);

const seen: Record<string, number> = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : {};
const now = Date.now();
const queries: [string, string][] = [...GENERAL_QUERIES, ...SPORT_QUERIES, ...top.map((n, i): [string, string] => [i % 2 ? "GB" : "ES", `"${n}" ${i % 2 ? "tour tickets" : "gira entradas"}`])];

const fresh: (NewsItem & { candidates: string[]; key: string })[] = [];
for (const [cc, q] of queries) {
  for (const it of await searchNews(q, cc)) {
    const age = it.pubDate ? now - Date.parse(it.pubDate) : 0;
    if (!it.pubDate || !(age >= 0 && age < MAX_AGE_MS)) continue;
    const key = hash(it.title.toLowerCase().replace(/\W+/g, " ").trim().slice(0, 90));
    if (seen[key] || fresh.some((f) => f.key === key)) continue;
    const candidates = matcher.match(`${it.title} ${it.description}`);
    if (candidates.length && !isTravelOffer(`${it.title} ${it.description}`)) fresh.push({ ...it, candidates, key });
  }
  await new Promise((r) => setTimeout(r, 800));
}
console.log(`${queries.length} búsquedas · ${fresh.length} titulares nuevos con artistas seguidos`);

const SYSTEM = `Clasificas titulares de música, festivales y deporte de alta demanda para un radar personal que busca
conseguir entradas (sorteos, preventas, registros y ventas cuentan como accionables).
Para cada titular di a qué artista de su lista de candidatos se refiere de verdad (o null si no es ese
artista: homónimos, palabras normales…), la categoría (${CATEGORIES.join(", ")}) y un resumen de una
línea en español con lo accionable (fechas, ciudades, cuándo es la preventa o venta). Sin inventar.
"europe" es true solo si afecta a fechas o ventas en Europa o Reino Unido (o es una gira mundial que
incluye Europa); false si solo trata de América, Asia u Oceanía.
Responde en JSON: {"items":[{"i":0,"artist":"","category":"","summary":"","europe":true}]}`;

const out: { artistName: string; title: string; url: string; source: string; category: NewsCategory; summary: string; publishedAt: string | null }[] = [];
for (let i = 0; i < fresh.length; i += 20) {
  const batch = fresh.slice(i, i + 20);
  const user = batch.map((b, j) => `${j}. [candidatos: ${b.candidates.join(", ")}] ${b.title} — ${b.description.slice(0, 280)}`).join("\n");
  const res = await aiJson<{ items?: { i: number; artist: string | null; category: string; summary: string; europe?: boolean }[] }>(SYSTEM, user);
  for (const r of res?.items ?? []) {
    const b = batch[r.i];
    if (!b || !r.artist || !b.candidates.includes(r.artist)) continue;
    if (!CATEGORIES.includes(r.category as NewsCategory) || r.category === "other") continue;
    // Fase 1: solo Europa y Reino Unido (América, Asia y Oceanía llegarán en sus fases).
    if (r.europe !== true) continue;
    // Una sola noticia por artista y tipo al día (la misma historia sale en muchos medios).
    const dup = `dup|${r.artist.toLowerCase()}|${r.category}|${new Date(now).toISOString().slice(0, 10)}`;
    if (seen[dup] || out.some((o) => o.artistName === r.artist && o.category === r.category)) continue;
    seen[dup] = now;
    out.push({ artistName: r.artist, title: b.title, url: b.link, source: b.source, category: r.category as NewsCategory, summary: r.summary.slice(0, 220), publishedAt: b.pubDate });
  }
}
for (const f of fresh) seen[f.key] = now;
for (const [k, t] of Object.entries(seen)) if (now - t > 7 * 86_400_000) delete seen[k];

if (out.length) console.log(JSON.stringify(await gira("/enrich/news", { items: out })));
console.log(`${out.length} noticias accionables`);
mkdirSync(".news-state", { recursive: true });
writeFileSync(STATE, JSON.stringify(seen));
