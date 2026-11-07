import { normalizeName } from "./resolve";

export interface Candidate {
  name: string;
  listeners: number;
  mbid?: string | null;
}

/**
 * Lista final de entidades: los imprescindibles (⭐⭐⭐) siempre; luego por oyentes, los
 * `tier2` primeros como ⭐⭐ y el resto como ⭐ hasta `limit`.
 */
export function rankEntities(
  candidates: Candidate[],
  mustHave: string[],
  opts: { tier2: number; limit: number },
): { name: string; tier: 1 | 2 | 3; listeners: number }[] {
  const best = new Map<string, Candidate>();
  for (const c of candidates) {
    const k = normalizeName(c.name);
    const prev = best.get(k);
    if (!prev || c.listeners > prev.listeners) best.set(k, c);
  }
  const must = new Set(mustHave.map(normalizeName));
  const out: { name: string; tier: 1 | 2 | 3; listeners: number }[] = [];
  for (const name of mustHave) {
    const c = best.get(normalizeName(name));
    out.push({ name: c?.name ?? name, tier: 3, listeners: c?.listeners ?? 0 });
  }
  const rest = [...best.entries()].filter(([k]) => !must.has(k)).map(([, c]) => c).sort((a, b) => b.listeners - a.listeners);
  for (const c of rest) {
    if (out.length >= opts.limit) break;
    const tier = out.filter((o) => o.tier === 2).length < opts.tier2 ? 2 : 1;
    out.push({ name: c.name, tier, listeners: c.listeners });
  }
  return out;
}

export interface FeedAttraction {
  attractionId: string;
  attractionName: string;
  musicbrainz_id: string | null;
  events: number;
}

export interface AttractionIndex {
  byMbid: Map<string, string>;
  byName: Map<string, FeedAttraction[]>;
}

export function buildAttractionIndex(list: FeedAttraction[]): AttractionIndex {
  const byMbid = new Map<string, string>();
  const byName = new Map<string, FeedAttraction[]>();
  for (const a of list) {
    if (a.musicbrainz_id) byMbid.set(a.musicbrainz_id, a.attractionId);
    const k = normalizeName(a.attractionName);
    byName.set(k, [...(byName.get(k) ?? []), a]);
  }
  return { byMbid, byName };
}

/** attractionId de Ticketmaster: por MBID si lo hay; si no, nombre exacto con más fechas; nunca se adivina. */
export function resolveEntity(name: string, mbid: string | null | undefined, index: AttractionIndex): string | null {
  if (mbid && index.byMbid.has(mbid)) return index.byMbid.get(mbid)!;
  const hits = index.byName.get(normalizeName(name)) ?? [];
  return hits.sort((a, b) => b.events - a.events)[0]?.attractionId ?? null;
}
