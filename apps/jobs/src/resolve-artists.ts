import { readFileSync, writeFileSync } from "node:fs";
import { normalizeName, pickAttraction, pickDeezer, type Candidate } from "./resolve";

const TM = process.env.TICKETMASTER_API_KEY;
if (!TM) throw new Error("Falta TICKETMASTER_API_KEY");
const UA = "GIRA/0.1 (+https://github.com/Guti11nter11/COOKGROUP_FINAL)";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Seed = { name: string; tier: 1 | 2 | 3 };
type Resolved = Seed & { tmAttractionId: string | null; mbid: string | null; deezerId: number | null; deezerFans: number | null };

async function json(url: string): Promise<any> {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url.replace(/apikey=[^&]+/, "apikey=***")}`);
  return res.json();
}

async function ticketmaster(name: string): Promise<Candidate[]> {
  const d = await json(
    `https://app.ticketmaster.com/discovery/v2/attractions.json?keyword=${encodeURIComponent(name)}&size=10&apikey=${TM}`,
  );
  return (d._embedded?.attractions ?? []).map((a: any) => ({
    id: a.id,
    name: a.name,
    upcomingEvents: a.upcomingEvents?._total ?? 0,
    segment: a.classifications?.[0]?.segment?.name ?? "",
  }));
}

async function musicbrainz(name: string): Promise<string | null> {
  const d = await json(`https://musicbrainz.org/ws/2/artist?query=${encodeURIComponent(`artist:"${name}"`)}&fmt=json&limit=5`);
  const hit = (d.artists ?? []).find((a: any) => a.score >= 95 && normalizeName(a.name) === normalizeName(name));
  return hit?.id ?? null;
}

async function deezer(name: string): Promise<{ id: number; fans: number } | null> {
  const d = await json(`https://api.deezer.com/search/artist?q=${encodeURIComponent(name)}&limit=10`);
  return pickDeezer(name, d.data ?? []);
}

const seed: Seed[] = JSON.parse(readFileSync("data/artists.seed.json", "utf8"));
const out: Resolved[] = [];
const unresolved: string[] = [];
for (const s of seed) {
  const pick = pickAttraction(s.name, await ticketmaster(s.name));
  await sleep(300);
  const mbid = await musicbrainz(s.name).catch(() => null);
  await sleep(1100); // MusicBrainz: 1 petición por segundo
  const dz = await deezer(s.name).catch(() => null);
  const tmAttractionId = "id" in pick ? pick.id : null;
  if (!tmAttractionId) unresolved.push(s.name);
  out.push({ ...s, tmAttractionId, mbid, deezerId: dz?.id ?? null, deezerFans: dz?.fans ?? null });
  console.log(`${tmAttractionId ? "✅" : "❓"} ${s.name} · TM ${tmAttractionId ?? "-"} · MB ${mbid ? "sí" : "-"} · Deezer ${dz?.fans ?? "-"}`);
}
writeFileSync("data/artists.resolved.json", JSON.stringify(out, null, 1) + "\n");
console.log(`\nResueltos en Ticketmaster: ${out.length - unresolved.length}/${out.length}`);
if (unresolved.length) console.log(`Por revisar: ${unresolved.join(", ")}`);
