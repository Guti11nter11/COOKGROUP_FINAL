import { createReadStream } from "node:fs";
import { writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createGunzip } from "node:zlib";
import StreamJson from "stream-json";
import Pick from "stream-json/filters/Pick.js";
import StreamArray from "stream-json/streamers/StreamArray.js";

/**
 * Países del Discovery Feed en cada pasada (los de más giras). Ticketmaster limita las descargas
 * (~20 por hora), así que el resto va por turnos (ROTATING_COUNTRIES, 4 por pasada). Un país sin
 * feed (404/400) se salta sin error.
 */
export const FEED_COUNTRIES = ["GB", "IE", "ES", "FR", "DE", "IT", "NL", "BE", "US", "MX"];
export const ROTATING_COUNTRIES = ["AT", "CH", "DK", "SE", "NO", "FI", "PL", "CZ", "TR", "BR", "CA", "AR", "CL", "CO", "PE", "UY"];
/** Países que ya se leían antes de guardar esta lista (su próxima lectura no es línea base). */
export const ALREADY_READ = ["GB", "IE", "ES", "FR", "DE", "IT", "NL", "BE", "AT", "CH", "DK", "SE", "NO", "FI", "PL", "CZ", "TR", "MX", "BR", "AR"];
/** Los países por turnos de esta pasada (4, rotando cada hora). */
export function rotatingTurn(now: number, per = 4): string[] {
  const start = (Math.floor(now / 3600_000) * per) % ROTATING_COUNTRIES.length;
  return Array.from({ length: per }, (_, i) => ROTATING_COUNTRIES[(start + i) % ROTATING_COUNTRIES.length]!);
}

/**
 * Recorre el Discovery Feed de un país evento a evento. Primero descarga el fichero completo a
 * disco (con reintentos: el servidor corta conexiones lentas) y después lo lee en streaming (el de
 * EE. UU. descomprimido supera el tamaño máximo de una cadena en Node).
 */
export async function* iterateFeed(countryCode: string, apiKey: string, attempts = 3): AsyncGenerator<unknown> {
  let file: string | null = null;
  let gz = false;
  for (let i = 1; i <= attempts && !file; i++) {
    try {
      const res = await fetch(`https://app.ticketmaster.com/discovery-feed/v2/events.json?apikey=${apiKey}&countryCode=${countryCode}`);
      if (res.status === 404 || res.status === 400) return;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      gz = (res.headers.get("content-type") ?? "").includes("gzip");
      const path = join(tmpdir(), `gira-feed-${countryCode}-${process.pid}.json${gz ? ".gz" : ""}`);
      await writeFile(path, Buffer.from(await res.arrayBuffer()));
      file = path;
    } catch (e) {
      if (i === attempts) throw new Error(`Feed ${countryCode}: ${String(e)}`);
      await new Promise((r) => setTimeout(r, 30_000 * i)); // 429 de Ticketmaster: esperar más
    }
  }
  try {
    yield* parseFeedStream(createReadStream(file!), gz);
  } finally {
    await rm(file!, { force: true });
  }
}

/** Eventos de un fichero del feed (`{ "events": [...] }`), opcionalmente comprimido con gzip. */
export async function* parseFeedStream(input: NodeJS.ReadableStream, gzipped: boolean): AsyncGenerator<unknown> {
  const stream = gzipped ? input.pipe(createGunzip()) : input;
  const pipeline = stream.pipe(StreamJson.parser()).pipe(Pick.pick({ filter: "events" })).pipe(StreamArray.streamArray());
  for await (const item of pipeline as AsyncIterable<{ value: unknown }>) yield item.value;
}
