/** Selección de fechas a muestrear y precio oficial de referencia. Funciones puras. */
import type { EnrichTodo } from "@gira/core";

export interface StubEvent {
  eventUrl: string;
  eventDate: string;
  venueCity: string;
  venueCountry: string;
  venueName?: string;
}

const COUNTRY_CODE: Record<string, string> = {
  "united kingdom": "GB", spain: "ES", france: "FR", germany: "DE", italy: "IT", netherlands: "NL", belgium: "BE", portugal: "PT", ireland: "IE",
  austria: "AT", switzerland: "CH", denmark: "DK", sweden: "SE", norway: "NO", finland: "FI", poland: "PL", "czech republic": "CZ", czechia: "CZ",
  "united states": "US", usa: "US", canada: "CA", mexico: "MX", brazil: "BR", argentina: "AR", chile: "CL", colombia: "CO", australia: "AU",
  japan: "JP", "south korea": "KR", hungary: "HU", greece: "GR",
};
export const countryCode = (name: string) => COUNTRY_CODE[name.trim().toLowerCase()] ?? name.slice(0, 2).toUpperCase();

/** Hasta 2 fechas nuestras y 1 de otro país (para comparar cómo está la reventa fuera). */
export function chooseEvents(found: StubEvent[], when: { city: string; localDate: string }[], max = 3): StubEvent[] {
  const ours = new Set(when.map((w) => w.localDate));
  const mine = found.filter((e) => ours.has(e.eventDate)).slice(0, 2);
  const myCountries = new Set(mine.map((e) => e.venueCountry));
  const other = found.find((e) => !ours.has(e.eventDate) && !myCountries.has(e.venueCountry));
  return [...mine, ...(other ? [other] : [])].slice(0, max);
}

/** Precio oficial medio de referencia (media de zonas si las hay; si no, punto medio del rango). */
export function faceValue(prices: EnrichTodo["artists"][number]["prices"], country: string): { amount: number; currency: string } | null {
  const pick = prices.filter((p) => p.country === country);
  const list = pick.length ? pick : prices;
  if (!list.length) return null;
  const currency = list[0]!.currency;
  const values = list
    .filter((p) => p.currency === currency)
    .map((p) => (p.zones?.length ? p.zones.reduce((s, z) => s + z.price, 0) / p.zones.length : (p.min + p.max) / 2));
  return { amount: values.reduce((a, b) => a + b, 0) / values.length, currency };
}

/** Convierte con tasas del BCE (base EUR). */
export function convert(amount: number, from: string, to: string, ratesFromEur: Record<string, number>): number | null {
  const r = (c: string) => (c === "EUR" ? 1 : ratesFromEur[c]);
  const a = r(from);
  const b = r(to);
  return a && b ? (amount / a) * b : null;
}
