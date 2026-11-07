import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { localDateIn, MADRID, normalizeFeedEvent, type Show } from "@gira/core";
import { chunkByArtist, diffFeed, pickFollowed } from "./feed-radar-lib";
import { FEED_COUNTRIES, iterateFeed } from "./tm-feed";

const KEY = process.env.TICKETMASTER_API_KEY;
const GIRA = process.env.GIRA_URL ?? "https://gira-core.eleven-snk-11.workers.dev";
const STATE = ".feed-state/state.json";
if (!KEY) throw new Error("Falta TICKETMASTER_API_KEY");
const token = createHash("sha256").update(`gira-ingest:${KEY}`).digest("hex");

const follows: { tmAttractionId: string | null }[] = JSON.parse(readFileSync("data/artists.resolved.json", "utf8"));
const followed = new Set(follows.map((f) => f.tmAttractionId).filter((x): x is string => !!x));
const today = localDateIn(new Date(), MADRID);

const all: Show[] = [];
const failed: string[] = [];
for (const cc of FEED_COUNTRIES) {
  let total = 0;
  const mine: Show[] = [];
  try {
    for await (const raw of iterateFeed(cc, KEY)) {
      total++;
      const s = normalizeFeedEvent(raw);
      if (s && s.localDate >= today) mine.push(...pickFollowed([s], followed));
    }
  } catch (e) {
    failed.push(cc);
    console.log(`⚠️ ${cc}: ${String(e)} — se reintentará en la próxima hora`);
    continue;
  }
  all.push(...mine);
  console.log(`${cc}: ${total} eventos · ${mine.length} de entidades seguidas`);
  await new Promise((r) => setTimeout(r, 3000)); // no encadenar descargas (evita 429)
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
for (const chunk of chunkByArtist(changed, 40)) alerts += (await post({ shows: chunk })).alerts;
// Solo con una lectura completa (todos los países) las entidades quedan "arrancadas" (también las
// que no tienen fechas, para que su primera gira futura sí avise).
if (failed.length === 0) {
  const ids = [...followed];
  for (let i = 0; i < ids.length; i += 500) await post({ shows: [], markBootstrapped: ids.slice(i, i + 500) });
} else {
  console.log(`Arranque pendiente: fallaron ${failed.join(", ")}`);
}
writeFileSync(STATE, JSON.stringify(state));
console.log(`Avisos nuevos: ${alerts}`);
