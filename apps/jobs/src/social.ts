import { readFileSync } from "node:fs";
import { aiJson } from "./ai";
import { apifyBudget, runActor } from "./apify";
import { gira } from "./gira-client";

/**
 * Redes oficiales de ticketeras sin web legible (Blueticket): una vez al día, las publicaciones de
 * los últimos 2 días; la IA extrae lo accionable (gira, preventa, venta) y va a #noticias.
 */
const cfg = JSON.parse(readFileSync("data/social-accounts.json", "utf8")) as { instagram: { handle: string; name: string; country: string }[] };
const budget = await apifyBudget();
if (!budget || budget.used >= 3.5) {
  console.log(`Apify: sin presupuesto este mes (${budget?.used ?? "?"} $) — se omite`);
  process.exit(0);
}
type Post = { caption?: string; url?: string; timestamp?: string; ownerUsername?: string };
const posts = await runActor<Post>(
  "apify/instagram-post-scraper",
  { username: cfg.instagram.map((a) => a.handle), resultsLimit: 6, onlyPostsNewerThan: "2 days", skipPinnedPosts: true, dataDetailLevel: "basicData" },
  { maxItems: 6 * cfg.instagram.length, timeoutSecs: 180 },
);
const fresh = posts.filter((p) => p.caption && p.url);
console.log(`${fresh.length} publicaciones nuevas`);
if (!fresh.length) process.exit(0);

const SYSTEM = `Lees publicaciones oficiales de una ticketera para un radar personal que busca conseguir entradas.
Para cada publicación que anuncie un concierto, gira, festival o evento deportivo con venta o preventa,
devuelve el artista o evento, la categoría (tour_announced, presale, on_sale, extra_date, sold_out) y un
resumen en español con fechas, ciudad/recinto y cuándo salen las entradas. Ignora sorteos de redes,
merchandising y publicaciones sin evento. Responde en JSON: {"items":[{"i":0,"artist":"","category":"","summary":""}]}`;
const res = await aiJson<{ items?: { i: number; artist: string; category: string; summary: string }[] }>(
  SYSTEM,
  fresh.map((p, i) => `${i}. @${p.ownerUsername}: ${p.caption!.slice(0, 600)}`).join("\n\n"),
);
const items = (res?.items ?? [])
  .filter((r) => fresh[r.i] && r.artist && ["tour_announced", "presale", "on_sale", "extra_date", "sold_out"].includes(r.category))
  .map((r) => {
    const p = fresh[r.i]!;
    const acc = cfg.instagram.find((a) => a.handle === p.ownerUsername);
    return { artistName: r.artist, title: p.caption!.slice(0, 200), url: p.url!, source: `${acc?.name ?? p.ownerUsername} (Instagram)`, category: r.category, summary: r.summary, publishedAt: p.timestamp ?? null };
  });
console.log(`${items.length} accionables`);
if (items.length) console.log(JSON.stringify(await gira("/enrich/news", { items })));
