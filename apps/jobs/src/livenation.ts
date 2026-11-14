/**
 * Preventas de Live Nation que no salen en la API de Ticketmaster ("Preventa Registrados
 * LiveNation.es", Santander SMusic…): 4 veces al día se leen las páginas públicas de evento guardadas
 * (las añade /livenation y se amplían solas con las otras fechas de la gira). Solo esas páginas, una
 * cada pocos segundos, con un User-Agent que dice quién somos, respetando robots.txt y bloqueos.
 * Nunca la búsqueda ni las APIs internas del sitio.
 */
import { parseLnEvent } from "@gira/core";
import { gira, UA } from "./gira-client";
import { robotsAllows } from "./sports-lib";

const { urls } = await gira<{ urls: string[] }>("/enrich/ln-pages");
const robots = new Map<string, string | null>();
const blocked = new Set<string>();
const pages: { url: string; siblings: string[]; lastDate: string | null; sales: ReturnType<typeof parseLnEvent>["sales"] }[] = [];

for (const url of urls) {
  const u = new URL(url);
  if (blocked.has(u.origin)) continue;
  if (!robots.has(u.origin)) {
    const r = await fetch(`${u.origin}/robots.txt`, { headers: { "User-Agent": UA } }).catch(() => null);
    robots.set(u.origin, r?.ok ? await r.text() : null);
  }
  const rb = robots.get(u.origin);
  if (rb && !robotsAllows(rb, u.pathname)) {
    console.log(`· ${u.host}: robots.txt no lo permite, se respeta`);
    blocked.add(u.origin);
    continue;
  }
  const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "es-ES,es;q=0.9,en;q=0.8" }, signal: AbortSignal.timeout(25000) }).catch(() => null);
  if (!res || res.status === 403 || res.status === 429 || res.status === 401) {
    console.log(`· ${u.host}: la web bloquea lectores automáticos (HTTP ${res?.status ?? "sin respuesta"}), se respeta`);
    blocked.add(u.origin);
    continue;
  }
  if (!res.ok) continue;
  const r = parseLnEvent(await res.text(), url);
  pages.push({ url, ...r });
  console.log(`· ${u.pathname.slice(0, 70)}: ${r.sales.length} preventas, ${r.siblings.length} fechas de la gira`);
  await new Promise((ok) => setTimeout(ok, 3000));
}
if (pages.length) console.log(JSON.stringify(await gira("/enrich/ln-sales", { pages })));
console.log(`${pages.length} páginas de Live Nation leídas`);
