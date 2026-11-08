import { semanticHash, type Show } from "@gira/core";

/** Fechas en las que participa alguna entidad seguida (artista, festival, equipo, competición). */
export function pickFollowed(shows: Show[], followed: Set<string>): Show[] {
  return shows.filter((s) => s.attractionIds.some((id) => followed.has(id)));
}

/** Compara con el estado anterior (sourceId → hash semántico) y devuelve solo lo que cambió. */
export function diffFeed(prev: Record<string, string>, shows: Show[]): { changed: Show[]; state: Record<string, string> } {
  const state: Record<string, string> = {};
  const changed: Show[] = [];
  for (const s of shows) {
    const h = semanticHash(s);
    state[s.sourceId] = h;
    if (prev[s.sourceId] !== h) changed.push(s);
  }
  return { changed, state };
}

/** Lotes de envío que nunca separan las fechas de un mismo artista (el arranque depende de ello). */
export function chunkByArtist(shows: Show[], max: number): Show[][] {
  const groups = new Map<string, Show[]>();
  for (const s of shows) {
    const k = s.attractionIds[0] ?? "?";
    groups.set(k, [...(groups.get(k) ?? []), s]);
  }
  const chunks: Show[][] = [];
  let current: Show[] = [];
  for (const g of groups.values()) {
    if (current.length && current.length + g.length > max) {
      chunks.push(current);
      current = [];
    }
    current.push(...g);
  }
  if (current.length) chunks.push(current);
  return chunks;
}

const NOT_ARTIST = /(tribute|homenaje|hommage|experience|candlelight|the music of|plays the music|orchestra plays|symphonic tribute|cover band|revival|karaoke|tour package|parking|hotel)/i;

export interface Discovery {
  tmAttractionId: string;
  name: string;
  hotDates: number;
  countries: string[];
}

/** Recintos de arena o estadio (por nombre): lo que define una gira grande. */
export const BIG_VENUE =
  /\b(arena|stadium|stadion|stadio|estadio|est[aá]dio|stade|dome|palacio de (los )?deportes|palau sant jordi|wizink|ziggo|accor|the o2|o2 arena|forum|sportpaleis|unipol|ippodromo|hip[oó]dromo|aut[oó]dromo|foro sol|hyde park|marlay park|velodrom|olympiahalle|lanxess|uber arena|mercedes-benz|movistar arena|allianz|wembley|san siro|bernab[eé]u|metropolitano|cartuja)\b/i;

/**
 * Descubrimiento sin lista cerrada: entidades no seguidas con fechas de alta demanda (hotEvent) o con
 * una gira grande a punto de salir a la venta (≥ 2 fechas en arenas/estadios con venta por llegar, o
 * una arena/estadio dentro de ≥ 3 fechas en ≥ 2 países). Se descartan
 * tributos, paquetes y lo que no es música ni deporte. Primero las de más fechas.
 */
export function discoverHot(
  events: { attractionId: string | null; attractionName: string | null; hot: boolean; country: string; segment?: string; isPackage: boolean; upcomingSale?: boolean; bigVenue?: boolean }[],
  followed: Set<string>,
  max = 40,
): Discovery[] {
  const by = new Map<string, Discovery & { sale: number; big: number; hot: boolean }>();
  for (const e of events) {
    if (e.isPackage || !e.attractionId || !e.attractionName || followed.has(e.attractionId)) continue;
    if (!e.hot && !e.upcomingSale) continue;
    if (e.segment && e.segment !== "Music" && e.segment !== "Sports") continue;
    if (NOT_ARTIST.test(e.attractionName)) continue;
    const d = by.get(e.attractionId) ?? { tmAttractionId: e.attractionId, name: e.attractionName, hotDates: 0, countries: [], sale: 0, big: 0, hot: false };
    if (e.hot) {
      d.hotDates++;
      d.hot = true;
    }
    if (e.upcomingSale) d.sale++;
    if (e.upcomingSale && e.bigVenue) d.big++;
    if (!d.countries.includes(e.country)) d.countries.push(e.country);
    by.set(e.attractionId, d);
  }
  return [...by.values()]
    .filter((d) => d.hot || d.big >= 2 || (d.big >= 1 && d.sale >= 3 && d.countries.length >= 2))
    .sort((a, b) => b.hotDates - a.hotDates || b.big - a.big || b.sale - a.sale || b.countries.length - a.countries.length)
    .slice(0, max)
    .map(({ tmAttractionId, name, hotDates, countries }) => ({ tmAttractionId, name, hotDates, countries }));
}
