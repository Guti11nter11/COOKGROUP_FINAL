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

const NOT_ARTIST =
  /(tribute|tributo|homenaje|hommage|experience|candlelight|the music of|plays the music|orchestra plays|symphonic tribute|cover band|revival|karaoke|tour package|parking|hotel|festival|\bfest\b|navidad|christmas|xmas|lucha|wrestling|\bsala\b|auditorio|teatro|theatre|congreso|celebrando|musical|ballet|circo|circus|magic|comedy|stand ?up|infantil|kids|disney|on ice|bellas artes)/i;

export interface Discovery {
  tmAttractionId: string;
  name: string;
  hotDates: number;
  countries: string[];
}

/** Estadios y grandes recintos al aire libre (por nombre): una fecha basta para considerarla gira grande. */
export const STADIUM =
  /\b(stadium|stadion|stadio|estadio|est[aá]dio|stade|foro sol|ippodromo|hip[oó]dromo|aut[oó]dromo|hyde park|marlay park|wembley|san siro|bernab[eé]u|metropolitano|cartuja|allianz|field|fenway park|rose bowl|metlife|sofi)\b/i;

/** Recintos de arena o estadio (por nombre): lo que define una gira grande. */
export const BIG_VENUE =
  /\b(arena|stadium|stadion|stadio|estadio|est[aá]dio|stade|dome|palacio de (los )?deportes|palau sant jordi|wizink|ziggo|accor|the o2|o2 arena|forum|sportpaleis|unipol|ippodromo|hip[oó]dromo|aut[oó]dromo|foro sol|hyde park|marlay park|velodrom|olympiahalle|lanxess|uber arena|mercedes-benz|movistar arena|allianz|wembley|san siro|bernab[eé]u|metropolitano|cartuja|madison square garden|td garden|united center|barclays center|chase center|kia forum|sphere|field|bowl)\b/i;

/**
 * Descubrimiento sin lista cerrada: entidades no seguidas con fechas de alta demanda (hotEvent) o con
 * una gira grande a punto de salir a la venta (un estadio, o arenas en ≥ 2 países). Se descartan
 * tributos, paquetes y lo que no es música ni deporte. Primero las de más fechas.
 */
export function discoverHot(
  events: { attractionId: string | null; attractionName: string | null; hot: boolean; country: string; segment?: string; isPackage: boolean; upcomingSale?: boolean; bigVenue?: boolean; stadium?: boolean }[],
  followed: Set<string>,
  max = 10,
): Discovery[] {
  const by = new Map<string, Discovery & { sale: number; big: number; stadium: number; hot: boolean }>();
  for (const e of events) {
    if (e.isPackage || !e.attractionId || !e.attractionName || followed.has(e.attractionId)) continue;
    if (!e.hot && !e.upcomingSale) continue;
    // Sin "alta demanda" de Ticketmaster, solo música (el deporte entra por lista o por hotEvent).
    if (e.segment && e.segment !== "Music" && (e.segment !== "Sports" || !e.hot)) continue;
    if (NOT_ARTIST.test(e.attractionName)) continue;
    const d = by.get(e.attractionId) ?? { tmAttractionId: e.attractionId, name: e.attractionName, hotDates: 0, countries: [], sale: 0, big: 0, stadium: 0, hot: false };
    if (e.hot) {
      d.hotDates++;
      d.hot = true;
    }
    if (e.upcomingSale) d.sale++;
    if (e.upcomingSale && e.bigVenue) d.big++;
    if (e.upcomingSale && e.stadium) d.stadium++;
    if (!d.countries.includes(e.country)) d.countries.push(e.country);
    by.set(e.attractionId, d);
  }
  return [...by.values()]
    .filter((d) => d.hot || d.stadium >= 1 || (d.big >= 2 && d.countries.length >= 2))
    .sort((a, b) => b.hotDates - a.hotDates || b.stadium - a.stadium || b.big - a.big || b.countries.length - a.countries.length)
    .slice(0, max)
    .map(({ tmAttractionId, name, hotDates, countries }) => ({ tmAttractionId, name, hotDates, countries }));
}
