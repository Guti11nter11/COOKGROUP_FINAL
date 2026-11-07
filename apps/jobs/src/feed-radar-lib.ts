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
