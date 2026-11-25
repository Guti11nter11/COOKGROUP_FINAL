/**
 * Artículos de los blogs oficiales de Ticketmaster (Reino Unido, España, Italia, Países Bajos, Irlanda):
 * los anuncios de gira traen a menudo el enlace de registro de la preventa (Cobrand, Laylo, Live
 * Nation…). Solo los feeds que robots.txt permite, solo artículos de artistas seguidos de los últimos
 * 3 días, con pausa entre lecturas y User-Agent identificado. Nada privado en los logs.
 */
import { readFileSync } from "node:fs";
import { gira, UA } from "./gira-client";
import { robotsAllows } from "./sports-lib";
import { nameMatcher } from "./news-radar-lib";
import { articleLinks, parseFeed } from "./articles-lib";

const FEEDS = [
  "https://discover.ticketmaster.co.uk/feed/",
  "https://blog.ticketmaster.es/feed/",
  "https://blog.ticketmaster.it/feed/",
  "https://blog.ticketmaster.nl/feed/",
  "https://blog.ticketmaster.ie/feed/",
];
const MAX_AGE_MS = 3 * 86_400_000;
const follows: { name: string; tmAttractionId: string | null }[] = JSON.parse(readFileSync("data/artists.resolved.json", "utf8"));
const idOf = new Map(follows.filter((f) => f.tmAttractionId).map((f) => [f.name, `a_${f.tmAttractionId}`]));
const matcher = nameMatcher([...idOf.keys()]);
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
const robots = new Map<string, string | null>();
async function allowed(url: string): Promise<boolean> {
  const u = new URL(url);
  if (!robots.has(u.origin)) {
    const r = await fetch(`${u.origin}/robots.txt`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15000) }).catch(() => null);
    robots.set(u.origin, r?.ok ? await r.text() : null);
  }
  const rb = robots.get(u.origin);
  return !rb || robotsAllows(rb, u.pathname);
}

const found: { artistId: string; url: string; label: string }[] = [];
for (const feed of FEEDS) {
  if (!(await allowed(feed))) {
    console.log(`· ${new URL(feed).host}: robots.txt no permite el feed, se respeta`);
    continue;
  }
  const res = await fetch(feed, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) }).catch(() => null);
  if (!res?.ok) {
    console.log(`· ${new URL(feed).host}: feed no disponible (HTTP ${res?.status ?? "sin respuesta"})`);
    continue;
  }
  const items = parseFeed(await res.text()).filter((i) => i.pubDate && Date.now() - Date.parse(i.pubDate) < MAX_AGE_MS);
  let read = 0;
  for (const it of items) {
    // El artista tiene que salir en el titular (en el cuerpo aparecen otros de pasada).
    const names = matcher.match(it.title);
    if (!names.length || !(await allowed(it.link))) continue;
    const page = await fetch(it.link, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) }).catch(() => null);
    if (!page || page.status === 403 || page.status === 429) {
      console.log(`· ${new URL(feed).host}: la web bloquea lectores automáticos, se respeta`);
      break;
    }
    read++;
    if (page.ok) {
      const links = articleLinks(await page.text());
      for (const n of names) for (const l of links) found.push({ artistId: idOf.get(n)!, ...l });
      if (links.length) console.log(`✓ ${it.title.slice(0, 90)} → ${links.map((l) => l.label).join(", ")}`);
    }
    await pause(3000);
  }
  console.log(`${new URL(feed).host}: ${items.length} artículos recientes, ${read} de artistas seguidos leídos`);
}
const r = await gira<Record<string, number>>("/enrich", { articleSignups: found });
console.log(`Registros sacados de artículos: ${found.length} · ${JSON.stringify(r)}`);
