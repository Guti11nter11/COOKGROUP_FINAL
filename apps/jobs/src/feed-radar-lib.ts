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

/**
 * Descubrimiento: entidades no seguidas con fechas que Ticketmaster marca como de alta demanda
 * (hotEvent) en los países de la fase. Se descartan tributos y accesorios. Las de más fechas primero.
 */
export function discoverHot(events: { attractionId: string | null; attractionName: string | null; hot: boolean; country: string; segment?: string; isPackage: boolean }[], followed: Set<string>, max = 15): Discovery[] {
  const by = new Map<string, Discovery>();
  for (const e of events) {
    if (!e.hot || e.isPackage || !e.attractionId || !e.attractionName || followed.has(e.attractionId)) continue;
    if (e.segment && e.segment !== "Music" && e.segment !== "Sports") continue;
    if (NOT_ARTIST.test(e.attractionName)) continue;
    const d = by.get(e.attractionId) ?? { tmAttractionId: e.attractionId, name: e.attractionName, hotDates: 0, countries: [] };
    d.hotDates++;
    if (!d.countries.includes(e.country)) d.countries.push(e.country);
    by.set(e.attractionId, d);
  }
  return [...by.values()].sort((a, b) => b.hotDates - a.hotDates || b.countries.length - a.countries.length).slice(0, max);
}
