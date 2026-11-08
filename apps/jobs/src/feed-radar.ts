import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { localDateIn, MADRID, normalizeFeedEvent, type Show } from "@gira/core";
import { BIG_VENUE, STADIUM, chunkByArtist, diffFeed, discoverHot, pickFollowed } from "./feed-radar-lib";
import { ALREADY_READ, FEED_COUNTRIES, iterateFeed, rotatingTurn } from "./tm-feed";

const KEY = process.env.TICKETMASTER_API_KEY;
const GIRA = process.env.GIRA_URL ?? "https://gira-core.eleven-snk-11.workers.dev";
const STATE = ".feed-state/state.json";
if (!KEY) throw new Error("Falta TICKETMASTER_API_KEY");
const token = createHash("sha256").update(`gira-ingest:${KEY}`).digest("hex");

const follows: { tmAttractionId: string | null }[] = JSON.parse(readFileSync("data/artists.resolved.json", "utf8"));
const followed = new Set(follows.map((f) => f.tmAttractionId).filter((x): x is string => !!x));
// Más las entidades descubiertas (seguidas solo en D1).
try {
  const res = await fetch(`${GIRA}/enrich/follows`, { headers: { authorization: `Bearer ${token}` } });
  if (res.ok) for (const id of ((await res.json()) as { ids: string[] }).ids) followed.add(id);
} catch {
  console.log("⚠️ no se pudo leer la lista de seguidas del Worker; sigo con la del repo");
}
const hotSeen: Parameters<typeof discoverHot>[0] = [];
const today = localDateIn(new Date(), MADRID);
const nowMs = Date.now();

const all: Show[] = [];
const failed: string[] = [];
// Países por turnos (4 por pasada, sin reintentos: si Ticketmaster limita, se leen en otra pasada).
const turn = rotatingTurn(Date.now());
// Países ya leídos alguna vez: la primera lectura de uno nuevo (p. ej. EE. UU.) es solo línea base.
const SEEN_FILE = ".feed-state/countries.json";
const seenCountries = new Set<string>(existsSync(SEEN_FILE) ? (JSON.parse(readFileSync(SEEN_FILE, "utf8")) as string[]) : ALREADY_READ);
const readOk: string[] = [];
for (const cc of [...FEED_COUNTRIES, ...turn]) {
  let total = 0;
  const mine: Show[] = [];
  try {
    for await (const raw of iterateFeed(cc, KEY, turn.includes(cc) ? 1 : 3)) {
      total++;
      const s = normalizeFeedEvent(raw);
      if (s && s.localDate >= today) {
        mine.push(...pickFollowed([s], followed));
        // Candidatas a descubrir: alta demanda o con venta por llegar (gira que está a punto de salir).
        const upcomingSale = s.sales.some((w) => w.kind !== "official_resale" && w.startsAt && Date.parse(w.startsAt) > nowMs);
        if (s.hot || upcomingSale) {
          const att = (raw as { attractions?: { attraction?: { attractionId?: string; attractionName?: string } }[] }).attractions?.[0]?.attraction;
          if (att?.attractionId && !followed.has(att.attractionId)) {
            hotSeen.push({ attractionId: att.attractionId, attractionName: att.attractionName ?? null, hot: s.hot === true, country: s.venue.country, segment: s.segment, isPackage: s.isPackage, upcomingSale, bigVenue: BIG_VENUE.test(s.venue.name), stadium: STADIUM.test(s.venue.name) });
          }
        }
      }
    }
  } catch (e) {
    failed.push(cc);
    console.log(`⚠️ ${cc}: ${String(e)} — se reintentará en la próxima hora`);
    continue;
  }
  all.push(...mine);
  readOk.push(cc);
  console.log(`${cc}: ${total} eventos · ${mine.length} de entidades seguidas${seenCountries.has(cc) ? "" : " (primera lectura: línea base, sin avisos)"}`);
  await new Promise((r) => setTimeout(r, 3000)); // no encadenar descargas (evita 429)
}

// Descubrimiento: giras de alta demanda de entidades que aún no seguimos → se siguen (⭐⭐) y la
// próxima lectura las trae (sus fechas con ventas por llegar sí avisan).
const found = discoverHot(hotSeen, followed);
if (found.length) {
  const res = await fetch(`${GIRA}/enrich/discover`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ entities: found }),
  }).catch(() => null);
  console.log(`Descubiertas ${found.length}: ${found.map((d) => `${d.name} (${d.countries.join("/")})`).join(", ")} → ${res?.status ?? "sin respuesta"}`);
}

const prev = existsSync(STATE) ? (JSON.parse(readFileSync(STATE, "utf8")) as Record<string, string>) : {};
const { changed, state } = diffFeed(prev, all);
console.log(`Total seguidas: ${all.length} · cambios desde la última lectura: ${changed.length}`);

async function post(body: unknown): Promise<{ stored: number; alerts: number }> {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(`${GIRA}/ingest`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    if (res.ok) return (await res.json()) as { stored: number; alerts: number };
    if (res.status === 401) throw new Error("El Worker rechazó el token de ingesta (¿clave de TM rotada sin redesplegar?)");
    await new Promise((r) => setTimeout(r, 2000 * attempt));
  }
  throw new Error("No se pudo enviar al Worker tras 4 intentos");
}

let alerts = 0;
const isNew = (s: Show) => !seenCountries.has(s.venue.country);
for (const chunk of chunkByArtist(changed.filter((s) => !isNew(s)), 40)) alerts += (await post({ shows: chunk })).alerts;
for (const chunk of chunkByArtist(changed.filter(isNew), 40)) await post({ shows: chunk, baseline: true });
// Solo con una lectura completa (todos los países) las entidades quedan "arrancadas" (también las
// que no tienen fechas, para que su primera gira futura sí avise).
// Solo bloquea el arranque un fallo de los países de cada pasada (los de por turnos se reintentan solos).
if (failed.filter((cc) => FEED_COUNTRIES.includes(cc)).length === 0) {
  const ids = [...followed];
  for (let i = 0; i < ids.length; i += 500) await post({ shows: [], markBootstrapped: ids.slice(i, i + 500) });
} else {
  console.log(`Arranque pendiente: fallaron ${failed.join(", ")}`);
}
// Los países por turnos no se leen en cada pasada: se conserva su última huella para no reenviarlos.
writeFileSync(STATE, JSON.stringify({ ...prev, ...state }));
writeFileSync(SEEN_FILE, JSON.stringify([...new Set([...seenCountries, ...readOk])]));
console.log(`Avisos nuevos: ${alerts}`);
