/**
 * Webs oficiales de entradas de deporte (Real Madrid, Barça, Atleti, UEFA, Wimbledon, Roland-Garros,
 * Mutua Madrid Open, F1, NFL…) y de recintos o artistas que no venden por Ticketmaster (Movistar Arena): dos veces al día se compara cada página con la lectura anterior y, si
 * aparece una venta, preventa, sorteo o registro, la IA lo resume (con cita literal comprobada) y el
 * Worker lo publica en el canal del deporte. Respeta robots.txt y los bloqueos (403/429 → se salta).
 */
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { aiJson } from "./ai";
import { gira } from "./gira-client";
import { addedLines, relevantLines, robotsAllows } from "./sports-lib";

const UA = "Mozilla/5.0 (compatible; GIRA personal ticket radar; +https://github.com/Guti11nter11/COOKGROUP_FINAL)";
const STATE = ".sports-state/state.json";
const pages = (JSON.parse(readFileSync("data/sports-pages.json", "utf8")) as { pages: { name: string; channel: string; url: string }[] }).pages;
const state: Record<string, string[]> = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : {};

async function get(url: string): Promise<{ status: number; text: string }> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "es-ES,es;q=0.9,en;q=0.8" }, signal: AbortSignal.timeout(25000) });
    return { status: res.status, text: res.ok ? await res.text() : "" };
  } catch {
    return { status: 0, text: "" };
  }
}

type Browser = { newPage: (o?: unknown) => Promise<{ goto: (u: string, o?: unknown) => Promise<{ status: () => number } | null>; content: () => Promise<string>; waitForTimeout: (ms: number) => Promise<void>; close: () => Promise<void> }>; close: () => Promise<void> };
let browser: Browser | null = null;
async function rendered(url: string): Promise<string> {
  try {
    if (!browser) browser = await (createRequire(import.meta.url)("playwright") as { chromium: { launch: () => Promise<Browser> } }).chromium.launch();
    const page = await browser.newPage({ userAgent: UA });
    try {
      const res = await page.goto(url, { waitUntil: "networkidle", timeout: 40000 }).catch(() => null);
      if (res && res.status() >= 400) return "";
      await page.waitForTimeout(2000);
      return await page.content();
    } finally {
      await page.close();
    }
  } catch {
    return "";
  }
}

const SYSTEM = `Lees líneas NUEVAS de la web oficial de entradas de un club, torneo, competición, recinto de
conciertos o artista para un radar personal que busca conseguir entradas. Devuelve solo lo accionable:
una venta o preventa con fecha, un sorteo (ballot) que abre o cierra, un registro, la apertura para
socios o abonados, entradas de una final o un partido concreto, un concierto o fecha nueva, entradas
que vuelven a estar disponibles. Ignora menús, tienda, museo, tours del estadio, hospitality y paquetes
de viaje u hotel. "summary" en español, una frase con fechas y horas si aparecen. "quote" es una línea
LITERAL de las dadas. "category": presale, on_sale, signup, extra_date u other. No inventes nada.
Responde en JSON: {"items":[{"summary":"","quote":"","category":""}]}`;

const out: { artistName: string; title: string; url: string; source: string; category: string; summary: string; channel: string }[] = [];
for (const p of pages) {
  const u = new URL(p.url);
  const robots = await get(`${u.origin}/robots.txt`);
  if (robots.status === 200 && !robotsAllows(robots.text, u.pathname)) {
    console.log(`· ${p.name}: robots.txt no lo permite, se respeta`);
    continue;
  }
  const page = await get(p.url);
  if (page.status === 403 || page.status === 429 || page.status === 401) {
    console.log(`· ${p.name}: la web bloquea lectores automáticos (HTTP ${page.status}), se respeta`);
    continue;
  }
  let lines = relevantLines(page.text);
  if (lines.length < 5) lines = relevantLines(await rendered(p.url)); // web que se pinta con JavaScript
  if (!lines.length) {
    console.log(`· ${p.name}: sin texto legible (HTTP ${page.status})`);
    continue;
  }
  const prev = state[p.url];
  state[p.url] = lines;
  if (!prev) {
    console.log(`· ${p.name}: primera lectura (${lines.length} líneas), queda como referencia`);
    continue;
  }
  const added = addedLines(prev, lines);
  if (!added.length) {
    console.log(`· ${p.name}: sin cambios`);
    continue;
  }
  const res = await aiJson<{ items?: { summary: string; quote: string; category: string }[] }>(SYSTEM, `Web: ${p.name}\nLíneas nuevas:\n${added.slice(0, 60).join("\n")}`.slice(0, 8000));
  const ok = (res?.items ?? []).filter((i) => i.summary && i.quote && ["presale", "on_sale", "signup", "extra_date"].includes(i.category) && added.some((l) => l.toLowerCase().includes(i.quote.toLowerCase().trim())));
  for (const i of ok.slice(0, 3)) {
    const h = createHash("sha1").update(i.quote).digest("hex").slice(0, 10);
    out.push({ artistName: p.name, title: i.quote.slice(0, 200), url: `${p.url}#gira-${h}`, source: p.name, category: i.category, summary: i.summary.slice(0, 220), channel: p.channel });
  }
  console.log(`${ok.length ? "✓" : "·"} ${p.name}: ${added.length} líneas nuevas · ${ok.length} accionables`);
}
if (browser) await (browser as Browser).close();
if (out.length) console.log(JSON.stringify(await gira("/enrich/news", { items: out })));
mkdirSync(".sports-state", { recursive: true });
writeFileSync(STATE, JSON.stringify(state));
console.log(`${out.length} avisos de deporte`);
