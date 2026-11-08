import { readFileSync, writeFileSync } from "node:fs";
import { buildAttractionIndex, rankEntities, resolveEntity, type Candidate, type FeedAttraction } from "./follows-lib";
import { pickAttraction, type Candidate as TmCandidate } from "./resolve";
import { iterateFeed } from "./tm-feed";

const TM = process.env.TICKETMASTER_API_KEY;
const LASTFM = process.env.LASTFM_API_KEY;
if (!TM || !LASTFM) throw new Error("Faltan TICKETMASTER_API_KEY o LASTFM_API_KEY");
// Lista de partida (2.000 desde 2026-11-08); además, el radar del catálogo añade solas las giras grandes.
const LIMIT = Number(process.env.GIRA_ENTITIES ?? 2000);
const UA = "GIRA/0.1 (+https://github.com/Guti11nter11/COOKGROUP_FINAL)";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const getJson = async (url: string) => (await fetch(url, { headers: { "User-Agent": UA } })).json() as Promise<any>;

// 1) Candidatos por popularidad (Last.fm): global y por país.
const cands: Candidate[] = [];
for (let page = 1; page <= 40; page++) {
  const d = await getJson(`https://ws.audioscrobbler.com/2.0/?method=chart.gettopartists&limit=50&page=${page}&format=json&api_key=${LASTFM}`);
  for (const a of d.artists?.artist ?? []) cands.push({ name: a.name, listeners: Number(a.listeners) || 0, mbid: a.mbid || null });
  await sleep(250);
}
for (const country of ["spain", "united kingdom", "mexico", "italy", "france", "germany", "united states", "south korea", "portugal", "argentina", "colombia", "netherlands", "chile", "peru", "brazil", "ireland", "belgium", "poland"]) {
  for (let page = 1; page <= 3; page++) {
    const d = await getJson(`https://ws.audioscrobbler.com/2.0/?method=geo.gettopartists&country=${encodeURIComponent(country)}&limit=100&page=${page}&format=json&api_key=${LASTFM}`);
    for (const a of d.topartists?.artist ?? []) cands.push({ name: a.name, listeners: Number(a.listeners) || 0, mbid: a.mbid || null });
    await sleep(250);
  }
}
console.log(`Candidatos de Last.fm: ${cands.length}`);

// 2) Lista manual: imprescindibles, extras, festivales y deporte (siempre ⭐⭐ como mínimo).
const manual = JSON.parse(readFileSync("data/entities.manual.json", "utf8"));
const BOOST = 50_000_000;
for (const n of [...manual.tier2_extra, ...manual.festivals, ...manual.sports]) cands.push({ name: n, listeners: BOOST });
const ranked = rankEntities(cands, manual.tier3, { tier2: 300, limit: Math.round(LIMIT * 1.4) });
const mbidOf = new Map(cands.filter((c) => c.mbid).map((c) => [c.name, c.mbid!]));

// 3) Índice de atracciones a partir de los feeds (sin gastar cuota de la API).
const attractions = new Map<string, FeedAttraction>();
for (const cc of ["GB", "ES", "FR", "DE", "IT", "NL", "BE", "IE", "US", "MX", "BR"]) {
  for await (const e of iterateFeed(cc, TM) as AsyncIterable<any>) {
    for (const w of e.attractions ?? []) {
      const a = w.attraction ?? {};
      if (!a.attractionId) continue;
      const prev = attractions.get(a.attractionId);
      attractions.set(a.attractionId, {
        attractionId: a.attractionId,
        attractionName: a.attractionName ?? "",
        musicbrainz_id: a.externalLinks?.musicbrainz_id ?? null,
        events: (prev?.events ?? 0) + 1,
      });
    }
  }
  console.log(`Índice tras ${cc}: ${attractions.size} atracciones`);
}
const index = buildAttractionIndex([...attractions.values()]);

// 4) Resolver: feed primero; API de Ticketmaster como respaldo (con tope de llamadas).
const previous: any[] = JSON.parse(readFileSync("data/artists.resolved.json", "utf8"));
const prevByName = new Map(previous.map((p) => [p.name, p]));
let apiCalls = 0;
const out: any[] = [];
const unresolved: string[] = [];
for (const r of ranked) {
  if (out.length >= LIMIT) break;
  let id: string | null = prevByName.get(r.name)?.tmAttractionId ?? resolveEntity(r.name, mbidOf.get(r.name), index);
  if (!id && apiCalls < 1200) {
    apiCalls++;
    const d = await getJson(`https://app.ticketmaster.com/discovery/v2/attractions.json?keyword=${encodeURIComponent(r.name)}&size=10&apikey=${TM}`);
    const tmCands: TmCandidate[] = (d._embedded?.attractions ?? []).map((a: any) => ({
      id: a.id, name: a.name, upcomingEvents: a.upcomingEvents?._total ?? 0, segment: a.classifications?.[0]?.segment?.name ?? "",
    }));
    const isSport = manual.sports.includes(r.name) || manual.festivals.includes(r.name);
    const pick = pickAttraction(r.name, isSport ? tmCands.map((c) => ({ ...c, segment: "Music" })) : tmCands);
    id = "id" in pick ? pick.id : null;
    await sleep(250);
  }
  if (!id) {
    unresolved.push(r.name);
    continue;
  }
  if (out.some((o) => o.tmAttractionId === id)) continue;
  const p = prevByName.get(r.name);
  out.push({ name: r.name, tier: r.tier, tmAttractionId: id, mbid: p?.mbid ?? mbidOf.get(r.name) ?? null, deezerId: p?.deezerId ?? null, deezerFans: p?.deezerFans ?? null });
}
writeFileSync("data/artists.resolved.json", JSON.stringify(out, null, 1) + "\n");
const tiers = [3, 2, 1].map((t) => out.filter((o) => o.tier === t).length);
console.log(`Entidades: ${out.length} (⭐⭐⭐ ${tiers[0]} · ⭐⭐ ${tiers[1]} · ⭐ ${tiers[2]}) · llamadas API ${apiCalls}`);
console.log(`Sin resolver (${unresolved.length}): ${unresolved.slice(0, 60).join(", ")}`);
