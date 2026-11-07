import { gunzipSync } from "node:zlib";

/** Países de la Fase 1 que tienen Discovery Feed (Portugal no lo tiene). */
export const FEED_COUNTRIES = ["GB", "IE", "ES", "FR", "DE", "IT", "NL", "BE", "AT", "CH", "DK", "SE", "NO", "FI", "PL", "CZ", "TR"];

/** Descarga el Discovery Feed de un país (fichero completo, JSON comprimido). */
export async function downloadFeed(countryCode: string, apiKey: string): Promise<unknown[]> {
  const res = await fetch(`https://app.ticketmaster.com/discovery-feed/v2/events.json?apikey=${apiKey}&countryCode=${countryCode}`);
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`Feed ${countryCode}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const text = buf[0] === 0x1f && buf[1] === 0x8b ? gunzipSync(buf).toString("utf8") : buf.toString("utf8");
  return (JSON.parse(text) as { events?: unknown[] }).events ?? [];
}
