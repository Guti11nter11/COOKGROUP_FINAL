/**
 * DICE: eventos de los artistas de data/dice-artists.json desde sus páginas públicas (robots.txt lo
 * permite). Por artista, su página y la de cada evento futuro (como mucho 10), con 3 s de pausa y
 * User-Agent identificado; ante un 403/429 se para. Los eventos van al Worker como fechas más.
 */
import { readFileSync } from "node:fs";
import { diceArtistEvents, diceVenueEvents, parseDiceEvent, type Show } from "@gira/core";
import { nameMatcher } from "./news-radar-lib";
import { gira, UA } from "./gira-client";
import { robotsAllows } from "./sports-lib";

const fold = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const conf = JSON.parse(readFileSync("data/dice-artists.json", "utf8")) as { artists: { name: string; url: string }[]; venues?: { name: string; url: string }[] };
const list = conf.artists;
const follows: { name: string; tmAttractionId: string | null }[] = JSON.parse(readFileSync("data/artists.resolved.json", "utf8"));
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

const rb = await fetch("https://dice.fm/robots.txt", { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15000) }).catch(() => null);
const robots = rb?.ok ? await rb.text() : null;
const get = async (url: string): Promise<string | null | "blocked"> => {
  if (robots && !robotsAllows(robots, new URL(url).pathname)) return null;
  const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "en-GB,en;q=0.9" }, signal: AbortSignal.timeout(25000) }).catch(() => null);
  if (!res || res.status === 403 || res.status === 429) return "blocked";
  return res.ok ? await res.text() : null;
};

const shows: Show[] = [];
outer: for (const a of list) {
  const tm = follows.find((f) => fold(f.name) === fold(a.name))?.tmAttractionId;
  if (!tm) {
    console.log(`· ${a.name}: no es un artista seguido en GIRA`);
    continue;
  }
  const page = await get(a.url);
  if (page === "blocked") {
    console.log("· DICE bloquea lectores automáticos, se respeta");
    break;
  }
  if (!page) continue;
  const events = diceArtistEvents(page, new Date()).slice(0, 10);
  for (const url of events) {
    await pause(3000);
    const html = await get(url);
    if (html === "blocked") {
      console.log("· DICE bloquea lectores automáticos, se respeta");
      break outer;
    }
    const s = html ? parseDiceEvent(html, tm, url) : null;
    if (s) shows.push(s);
  }
  console.log(`✓ ${a.name}: ${events.length} eventos en DICE`);
  await pause(3000);
}
// Lo que ya salió a la venta entra como línea base (sin avisos): solo avisa lo que tiene una venta por llegar.
const upcoming = (s: Show) => s.sales.some((w) => w.startsAt && Date.parse(w.startsAt) > Date.now());
// Recintos: de sus eventos, los de artistas seguidos (el nombre del evento nombra al artista).
const matcher = nameMatcher(follows.filter((f) => f.tmAttractionId).map((f) => f.name));
const seen = new Set(shows.map((s) => s.url));
const venues = (conf.venues ?? []).map((v) => v.url);
venues: for (const v of venues.slice(0, 15)) {
  await pause(3000);
  const page = await get(v);
  if (page === "blocked") {
    console.log("· DICE bloquea lectores automáticos, se respeta");
    break;
  }
  if (!page) continue;
  const events = diceVenueEvents(page, new Date()).filter((e) => !seen.has(e.url));
  let n = 0;
  for (const e of events) {
    const who = matcher.match(e.name)[0];
    const tm = who ? follows.find((f) => f.name === who)?.tmAttractionId : null;
    if (!tm || n >= 10) continue;
    await pause(3000);
    const html = await get(e.url);
    if (html === "blocked") break venues;
    const s = html ? parseDiceEvent(html, tm, e.url) : null;
    if (s) {
      shows.push(s);
      seen.add(e.url);
      n++;
    }
  }
  console.log(`✓ recinto ${new URL(v).pathname}: ${events.length} eventos, ${n} de artistas seguidos`);
}

for (const [baseline, part] of [[false, shows.filter(upcoming)], [true, shows.filter((s) => !upcoming(s))]] as const) {
  for (let i = 0; i < part.length; i += 80) {
    const r = await gira<{ stored: number; alerts: number }>("/ingest", { shows: part.slice(i, i + 80), baseline });
    console.log(`Enviadas ${Math.min(80, part.length - i)} fechas de DICE${baseline ? " (ya a la venta, sin avisos)" : ""}: ${JSON.stringify(r)}`);
  }
}
if (!shows.length) console.log("Sin fechas de DICE nuevas");
