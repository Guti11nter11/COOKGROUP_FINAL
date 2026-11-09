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
  // Latinoamérica (Ticketmaster y ticketeras locales).
  ["MX", "preventa boletos concierto 2027"],
  ["MX", "anuncia gira 2027 fechas México boletos"],
  ["AR", "entradas recital 2027 preventa"],
  ["CL", "entradas concierto 2027 preventa Chile"],
  ["CO", "boletas concierto 2027 preventa Colombia"],
  ["PE", "entradas concierto 2027 preventa Lima"],
  ["BR", "ingressos show 2027 pré-venda"],
  // EE. UU. y Canadá.
  ["US", "2027 tour presale tickets announced"],
  ["US", "announces North American stadium tour 2027"],
  ["US", "adds new dates due to overwhelming demand"],
  ["US", "Verified Fan registration tour"],
];

/** Deporte y festivales de alta demanda: nombres con los que aparecen en prensa (además de las entidades seguidas). */
export const EVENT_NAMES = [
  "Champions League", "Liga de Campeones", "Europa League", "Conference League", "Fórmula 1", "Formula 1", "F1", "Gran Premio",
  "Wimbledon", "Roland Garros", "US Open", "Mutua Madrid Open", "ATP Finals", "Copa Davis", "Final Four", "Euroliga",
  "Mundial 2030", "Eurocopa", "Juegos Olímpicos", "LA 2028", "NFL", "NBA", "UFC", "WWE", "PDC", "Premier League Darts",
  "Seis Naciones", "Six Nations", "Real Madrid", "FC Barcelona", "Atlético de Madrid", "Selección española",
  "Mad Cool", "Primavera Sound", "BBK Live", "Sónar", "Glastonbury", "Tomorrowland", "Rock in Rio", "NOS Alive",
];

export const SPORT_QUERIES: [string, string][] = [
  ["ES", "entradas final Champions sorteo UEFA"],
  ["ES", "entradas Fórmula 1 Madrid 2027 venta"],
  ["ES", "entradas NFL Madrid partido venta"],
  ["ES", "entradas Mutua Madrid Open 2027 venta"],
  ["ES", "entradas Mundial 2030 venta FIFA"],
  ["GB", "Wimbledon ballot 2027"],
  ["GB", "NFL London games 2027 tickets"],
  ["GB", "Premier League Darts 2027 tickets on sale"],
  ["GB", "F1 British Grand Prix 2027 tickets"],
  ["FR", "billetterie Roland-Garros 2027"],
  ["GB", "Glastonbury 2027 tickets registration"],
  ["ES", "abonos festival 2027 a la venta"],
];

/** Ofertas de viaje (hotel, paquetes, hospitality): fuera de alcance de GIRA. Pura. */
const TRAVEL_RE = /\b(hotel(es|s)?|hoteles|package(s)?|paquetes?|hospitality|short breaks?|city breaks?|travel deals?|holiday deals?|vuelo\s*\+\s*hotel)\b/i;
export const isTravelOffer = (text: string) => TRAVEL_RE.test(fold(text));
