import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { getJson } from "./gira-client";
import { isTravelOffer } from "./news-radar-lib";
import { instagramHandle, itemConsistent } from "./social-lib";
import { aiJson } from "./ai";
import { apifyAllowed, runActor } from "./apify";
import { gira } from "./gira-client";

/**
 * Instagram oficial (vía Apify, solo lectura, una vez al día): ticketeras sin web legible (Blueticket) y
 * los artistas ⭐⭐⭐, que suelen anunciar ahí primero giras y preventas. La IA extrae lo accionable y
 * va a #noticias. Coste ≈ 0,0017 $ por publicación (≈ 0,05–0,15 $/día), dentro del límite de 1 $/día.
 */
const cfg = JSON.parse(readFileSync("data/social-accounts.json", "utf8")) as { instagram: { handle: string; name: string; country: string; artist?: boolean }[] };

// Cuentas de los artistas ⭐⭐⭐ desde MusicBrainz (caché semanal en .social-state).
const CACHE = ".social-state/handles.json";
type Cache = { at: string; handles: Record<string, string | null> };
const cache: Cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : { at: "1970-01-01", handles: {} };
const top = (JSON.parse(readFileSync("data/artists.resolved.json", "utf8")) as { name: string; tier: number; mbid: string | null }[]).filter((a) => a.tier >= 3 && a.mbid);
if (Date.now() - Date.parse(cache.at) > 7 * 86_400_000) {
  for (const a of top) {
    const d = await getJson<{ relations?: { type?: string; ended?: boolean; url?: { resource?: string } }[] }>(`https://musicbrainz.org/ws/2/artist/${a.mbid}?inc=url-rels&fmt=json`);
    cache.handles[a.name] = d ? instagramHandle(d.relations ?? []) : (cache.handles[a.name] ?? null);
    await new Promise((r) => setTimeout(r, 1100)); // MusicBrainz: 1 petición por segundo
  }
  cache.at = new Date().toISOString();
  mkdirSync(".social-state", { recursive: true });
  writeFileSync(CACHE, JSON.stringify(cache));
}
for (const [name, handle] of Object.entries(cache.handles)) {
  if (handle && !cfg.instagram.some((x) => x.handle.toLowerCase() === handle.toLowerCase())) cfg.instagram.push({ handle, name, country: "", artist: true });
}
console.log(`Cuentas: ${cfg.instagram.length} (${cfg.instagram.filter((a) => a.artist).length} de artistas ⭐⭐⭐)`);

const budget = await apifyAllowed(0.2);
if (!budget.ok) {
  console.log(`Apify: límite alcanzado (hoy ${budget.today ?? "?"} $ de 1 $) — se omite`);
  process.exit(0);
}
type Post = { caption?: string; url?: string; timestamp?: string; ownerUsername?: string };
const posts = await runActor<Post>(
  "apify/instagram-post-scraper",
  { username: cfg.instagram.map((a) => a.handle), resultsLimit: 3, onlyPostsNewerThan: "1 day", skipPinnedPosts: true, dataDetailLevel: "basicData" },
  { maxItems: 3 * cfg.instagram.length, timeoutSecs: 240 },
);
const fresh = posts.filter((p) => p.caption && p.url);
console.log(`${fresh.length} publicaciones nuevas`);
if (!fresh.length) process.exit(0);

const SYSTEM = `Lees publicaciones oficiales de ticketeras y artistas para un radar personal que busca conseguir entradas.
Para cada publicación que anuncie un concierto, gira, festival o evento deportivo con venta o preventa,
devuelve el artista o evento, la categoría (tour_announced, presale, on_sale, extra_date, sold_out) y un
resumen en español con fechas, ciudad/recinto y cuándo salen las entradas. Ignora sorteos de redes,
merchandising y publicaciones sin evento. "major" es true solo si es un artista o evento de alta demanda
(artista internacional o muy conocido, festival grande, pabellón o estadio); false para conciertos
locales pequeños, teatro o música de cámara.
"europe" es true si afecta a fechas o ventas en Europa o Reino Unido (o es una gira mundial que la
incluye); "latam" es true si afecta a Latinoamérica; "usa" es true si afecta a EE. UU. o Canadá. La
categoría "signup" es un registro abierto para una preventa.
Responde en JSON: {"items":[{"i":0,"artist":"","category":"","summary":"","major":true,"europe":true,"latam":false,"usa":false}]}`;
const res = await aiJson<{ items?: { i: number; artist: string; category: string; summary: string; major?: boolean; europe?: boolean; latam?: boolean; usa?: boolean }[] }>(
  SYSTEM,
  fresh.map((p, i) => `${i}. @${p.ownerUsername}: ${p.caption!.slice(0, 600)}`).join("\n\n"),
);
const items = (res?.items ?? [])
  .filter((r) => {
    const acc = cfg.instagram.find((a) => a.handle.toLowerCase() === fresh[r.i]?.ownerUsername?.toLowerCase());
    // Artistas: lo que afecta a Europa, Latinoamérica o EE. UU./Canadá. Ticketeras: solo eventos grandes.
    // La IA a veces cruza índices: lo devuelto tiene que encajar con la cuenta y el texto de esa publicación.
    return fresh[r.i] && r.artist && itemConsistent(r, fresh[r.i]!.caption!, acc) && !isTravelOffer(fresh[r.i]!.caption!) && (acc?.artist ? r.europe === true || r.latam === true || r.usa === true : r.major === true) && ["tour_announced", "presale", "on_sale", "extra_date", "sold_out", "signup"].includes(r.category);
  })
  .map((r) => {
    const p = fresh[r.i]!;
    const acc = cfg.instagram.find((a) => a.handle.toLowerCase() === p.ownerUsername?.toLowerCase());
    return { artistName: acc?.artist ? acc.name : r.artist, title: p.caption!.slice(0, 200), url: p.url!, source: `${acc?.name ?? p.ownerUsername} (Instagram)`, category: r.category, summary: r.summary, publishedAt: p.timestamp ?? null };
  });
console.log(`${items.length} accionables`);
if (items.length) console.log(JSON.stringify(await gira("/enrich/news", { items })));
