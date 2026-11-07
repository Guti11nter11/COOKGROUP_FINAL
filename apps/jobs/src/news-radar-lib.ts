/** Radar de noticias: qué artistas seguidos aparecen en un titular. Funciones puras. */

const fold = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "");
const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export interface NameMatcher {
  match: (text: string) => string[];
}

/**
 * Coincidencia por palabra completa. Los nombres cortos (≤ 4 letras: "U2", "Yes", "HIM") exigen
 * mayúsculas exactas para no confundirse con palabras normales; la IA confirma después.
 */
export function nameMatcher(names: string[]): NameMatcher {
  const rules = names
    .filter((n) => n.trim().length >= 2)
    .map((n) => ({ name: n, re: new RegExp(`(^|[^\\p{L}\\p{N}])${esc(fold(n))}(?=$|[^\\p{L}\\p{N}])`, n.length <= 4 ? "u" : "iu") }));
  return { match: (text) => [...new Set(rules.filter((r) => r.re.test(fold(text))).map((r) => r.name))] };
}

export const CATEGORIES = ["tour_announced", "extra_date", "presale", "signup", "on_sale", "sold_out", "price", "other"] as const;
export type NewsCategory = (typeof CATEGORIES)[number];

/** Búsquedas generales por país (además de una por artista ⭐⭐⭐). */
export const GENERAL_QUERIES: [string, string][] = [
  ["ES", "gira 2027 entradas"],
  ["ES", "preventa entradas concierto"],
  ["ES", "fecha extra concierto"],
  ["ES", "anuncia conciertos en España 2027"],
  ["GB", "tour 2027 tickets presale"],
  ["GB", "extra date added tour"],
  ["GB", "announces UK tour 2027"],
  ["GB", "stadium tour tickets on sale"],
  ["FR", "tournée 2027 billets prévente"],
  ["DE", "Tour 2027 Tickets Vorverkauf"],
  ["IT", "tour 2027 biglietti prevendita"],
  ["NL", "tour 2027 tickets voorverkoop"],
  ["PT", "concerto 2027 bilhetes Portugal"],
];
