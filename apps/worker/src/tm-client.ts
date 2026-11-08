import type { Env } from "./env";

export class RateLimited extends Error {}

/** Centro de Europa (48N 8E, geohash) y radio que cubre de Islandia y Canarias a Turquía. */
export const EUROPE_GEOPOINT = "u0t9n4";
export const EUROPE_RADIUS_KM = 3500;
/** Centro de EE. UU. (Kansas) y radio que cubre EE. UU. continental, el sur de Canadá y México. */
export const AMERICA_GEOPOINT = "9yd";
export const AMERICA_RADIUS_KM = 3000;
export const PAGE_SIZE = 50;

/** Una página de eventos de Ticketmaster para un lote de artistas (attractionId separados por comas). */
export async function fetchTmPage(
  ids: string[],
  page: number,
  env: Pick<Env, "TICKETMASTER_API_KEY">,
  region: "eu" | "am" = "eu",
): Promise<{ events: unknown[]; totalPages: number; rateLimitAvailable: number | null }> {
  const q = new URLSearchParams({
    attractionId: ids.join(","),
    classificationName: "music",
    size: String(PAGE_SIZE),
    page: String(page),
    sort: "date,asc",
    geoPoint: region === "am" ? AMERICA_GEOPOINT : EUROPE_GEOPOINT,
    radius: String(region === "am" ? AMERICA_RADIUS_KM : EUROPE_RADIUS_KM),
    unit: "km",
    apikey: env.TICKETMASTER_API_KEY,
  });
  const res = await fetch(`https://app.ticketmaster.com/discovery/v2/events.json?${q}`);
  if (res.status === 429) throw new RateLimited("Ticketmaster 429");
  if (!res.ok) throw new Error(`Ticketmaster HTTP ${res.status}`);
  const d = (await res.json()) as { _embedded?: { events?: unknown[] }; page?: { totalPages?: number } };
  const avail = res.headers.get("rate-limit-available");
  return { events: d._embedded?.events ?? [], totalPages: d.page?.totalPages ?? 1, rateLimitAvailable: avail ? Number(avail) : null };
}
