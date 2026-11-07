import { Readable } from "node:stream";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { createGunzip } from "node:zlib";
import StreamJson from "stream-json";
import Pick from "stream-json/filters/Pick.js";
import StreamArray from "stream-json/streamers/StreamArray.js";

/** Países de la Fase 1 que tienen Discovery Feed (Portugal no lo tiene). */
export const FEED_COUNTRIES = ["GB", "IE", "ES", "FR", "DE", "IT", "NL", "BE", "AT", "CH", "DK", "SE", "NO", "FI", "PL", "CZ", "TR"];

/**
 * Recorre el Discovery Feed de un país evento a evento (en streaming: el de EE. UU. descomprimido
 * supera el tamaño máximo de una cadena en Node).
 */
export async function* iterateFeed(countryCode: string, apiKey: string): AsyncGenerator<unknown> {
  const res = await fetch(`https://app.ticketmaster.com/discovery-feed/v2/events.json?apikey=${apiKey}&countryCode=${countryCode}`);
  if (res.status === 404) return;
  if (!res.ok || !res.body) throw new Error(`Feed ${countryCode}: HTTP ${res.status}`);
  const gz = (res.headers.get("content-type") ?? "").includes("gzip");
  yield* parseFeedStream(Readable.fromWeb(res.body as unknown as WebReadableStream), gz);
}

/** Eventos de un fichero del feed (`{ "events": [...] }`), opcionalmente comprimido con gzip. */
export async function* parseFeedStream(input: NodeJS.ReadableStream, gzipped: boolean): AsyncGenerator<unknown> {
  const stream = gzipped ? input.pipe(createGunzip()) : input;
  const pipeline = stream.pipe(StreamJson.parser()).pipe(Pick.pick({ filter: "events" })).pipe(StreamArray.streamArray());
  for await (const item of pipeline as AsyncIterable<{ value: unknown }>) yield item.value;
}
