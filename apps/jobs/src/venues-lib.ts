/** Aforo de recintos a partir de Wikidata (propiedad P1083, "capacidad máxima"). Funciones puras. */

/** País ISO → elemento de Wikidata (Fase 1 + EE. UU.). */
export const COUNTRY_QID: Record<string, string> = {
  ES: "Q29", GB: "Q145", IE: "Q27", FR: "Q142", DE: "Q183", IT: "Q38", NL: "Q55", BE: "Q31", PT: "Q45", AT: "Q40",
  CH: "Q39", DK: "Q35", SE: "Q34", NO: "Q20", FI: "Q33", PL: "Q36", CZ: "Q213", LU: "Q32", HU: "Q28", GR: "Q41",
  RO: "Q218", HR: "Q224", SK: "Q214", SI: "Q215", RS: "Q403", IS: "Q189", US: "Q30", CA: "Q16", MX: "Q96",
};

/** Idioma de la Wikipedia local de cada país (además de la inglesa). */
export const COUNTRY_LANG: Record<string, string> = {
  ES: "es", FR: "fr", DE: "de", AT: "de", CH: "de", IT: "it", NL: "nl", BE: "nl", PT: "pt", DK: "da", SE: "sv", NO: "no",
  FI: "fi", PL: "pl", CZ: "cs", HU: "hu", GR: "el", RO: "ro", HR: "hr", SK: "sk", SI: "sl", MX: "es",
};

type Claim = { rank?: string; mainsnak?: { datavalue?: { value?: unknown } } };
export interface WdEntity {
  id: string;
  labels?: Record<string, { value: string }>;
  aliases?: Record<string, { value: string }[]>;
  claims?: Record<string, Claim[]>;
}

/** Capacidad: la de rango preferido si existe; si no, la mayor (los conciertos suelen superar el aforo deportivo). */
export function capacityOf(e: WdEntity): number | null {
  const claims = (e.claims?.P1083 ?? []).filter((c) => c.rank !== "deprecated");
  const amount = (c: Claim) => Number(String((c.mainsnak?.datavalue?.value as { amount?: string } | undefined)?.amount ?? "").replace("+", ""));
  const values = (claims.some((c) => c.rank === "preferred") ? claims.filter((c) => c.rank === "preferred") : claims).map(amount).filter((n) => n > 0 && n < 400_000);
  return values.length ? Math.max(...values) : null;
}

export function countryOf(e: WdEntity): string[] {
  return (e.claims?.P17 ?? []).map((c) => String((c.mainsnak?.datavalue?.value as { id?: string } | undefined)?.id ?? ""));
}

const GENERIC = new Set([
  "stadium", "stadion", "estadio", "stade", "stadio", "arena", "the", "de", "del", "la", "le", "el", "of", "and", "y", "hall", "centre", "center",
  "park", "parc", "parque", "live", "dome", "palacio", "palau", "deportes", "sports", "music", "theatre", "theater", "teatro", "club",
]);
const fold = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export const tokens = (t: string) => fold(t).split(/[^a-z0-9]+/).filter((w) => w.length >= 2 && !GENERIC.has(w));

/** El elemento de Wikidata es el recinto: está en el país y comparte alguna palabra distintiva con su nombre. */
export function matchesVenue(e: WdEntity, venue: { name: string; country: string }): boolean {
  const qid = COUNTRY_QID[venue.country];
  if (qid && !countryOf(e).includes(qid)) return false;
  const names = [...Object.values(e.labels ?? {}).map((l) => l.value), ...Object.values(e.aliases ?? {}).flat().map((a) => a.value)];
  const mine = new Set(tokens(venue.name));
  if (!mine.size) return false;
  return names.some((n) => tokens(n).some((w) => mine.has(w)));
}

const KIND: [RegExp, string][] = [
  [/stadium|stadion|estadio|stade|stadio|estadi\b|field|ground|park/i, "stadium"],
  [/arena|dome|hall|centre|center|palacio|palau|pavilion|forum|o2\b/i, "arena"],
];
const kindOf = (t: string) => KIND.find(([re]) => re.test(t))?.[1] ?? null;

/** Puntuación de un candidato: palabras distintivas compartidas + mismo tipo de recinto (estadio/arena). */
function score(e: WdEntity, venue: { name: string }): number {
  const names = [...Object.values(e.labels ?? {}).map((l) => l.value), ...Object.values(e.aliases ?? {}).flat().map((a) => a.value)];
  const mine = new Set(tokens(venue.name));
  const shared = Math.max(0, ...names.map((n) => new Set(tokens(n).filter((w) => mine.has(w))).size));
  const kind = kindOf(venue.name);
  const sameKind = kind !== null && names.some((n) => kindOf(n) === kind) ? 0.5 : 0;
  return shared + sameKind;
}

/** El candidato que mejor encaja con el recinto (en el país, con aforo); a igualdad, el primero de la búsqueda. */
export function pickVenue(candidates: WdEntity[], venue: { name: string; country: string }): { id: string; capacity: number } | null {
  let best: { id: string; capacity: number; score: number } | null = null;
  for (const e of candidates) {
    const capacity = capacityOf(e);
    if (!capacity || !matchesVenue(e, venue)) continue;
    const sc = score(e, venue);
    if (!best || sc > best.score) best = { id: e.id, capacity, score: sc };
  }
  return best ? { id: best.id, capacity: best.capacity } : null;
}

/** Aforo del cuadro de datos de un artículo de Wikipedia ("| capacity = 23,500"), como respaldo. */
export function capacityFromWikitext(text: string): number | null {
  const m = /\|\s*(?:capacity|capacidad|kapazität|capacité|capienza|capaciteit)\s*=\s*(?:\{\{\w+\|)?(?:[^\d|\n]{0,40})?([\d][\d,.\s]{2,9}\d)/i.exec(text);
  if (!m) return null;
  const n = Number(m[1]!.replace(/[,.\s]/g, ""));
  return n >= 500 && n < 400_000 ? n : null;
}
