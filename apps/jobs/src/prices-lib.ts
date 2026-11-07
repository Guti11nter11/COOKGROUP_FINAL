/** Precios oficiales desde prensa: fragmentos con cifras y validación anti-invención. Funciones puras. */

const CURRENCY_RE = /(€|euros?|eur\b|£|libras|pounds?|gbp|\$|usd|chf|kr\b|zł)/i;

/** Frases de un artículo que hablan de precios de entradas (para no mandar el artículo entero a la IA). */
export function priceSnippets(text: string, max = 25): string[] {
  const sentences = text.split(/(?<=[.!?])\s+|\s+·\s+/);
  return sentences
    .filter((s) => CURRENCY_RE.test(s) && /\d/.test(s) && /(entrada|ticket|billet|biglietti|karten|precio|price|prix|prezz|preis|coste|cost|desde|from)/i.test(s))
    .map((s) => s.trim().slice(0, 400))
    .slice(0, max);
}

export interface ExtractedPrice {
  city: string;
  min: number;
  max: number;
  currency: string;
  quote: string;
  url: string;
  zones?: { name: string; price: number }[];
}

const fold = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const digits = (n: number) => [String(n), String(n).replace(/\B(?=(\d{3})+(?!\d))/g, "."), String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",")];
/** Formas en que una cifra puede aparecer en el texto ("181,50", "181.50", "1.200", "85"). */
const priceForms = (n: number) =>
  Number.isInteger(n) ? digits(n) : [n.toFixed(2).replace(".", ","), n.toFixed(2), n.toFixed(1).replace(".", ","), n.toFixed(1)];

/**
 * Se queda solo con precios creíbles: la cita existe literalmente en el texto de esa fuente y contiene
 * las cifras; rango razonable para una entrada (no paquetes de miles salvo que sea coherente).
 */
export function validPrices(found: ExtractedPrice[], sources: { url: string; text: string }[]): ExtractedPrice[] {
  return found.filter((p) => {
    if (!(p.min > 0 && p.max >= p.min && p.max <= 5000 && p.max / p.min <= 40)) return false;
    if (!/^[A-Z]{3}$/.test(p.currency)) return false;
    const src = sources.find((s) => s.url === p.url);
    if (!src || !p.quote || p.quote.length < 12) return false;
    const quote = fold(p.quote);
    if (!fold(src.text).includes(quote)) return false;
    return priceForms(p.min).some((d) => quote.includes(d)) || digits(Math.round(p.min)).some((d) => quote.includes(d));
  }).map((p) => {
    // Zonas: solo las que tienen su cifra en el texto de la fuente; el rango sale de ellas.
    const src = fold(sources.find((s) => s.url === p.url)!.text);
    const zones = (p.zones ?? []).filter((z) => z.name && z.price > 0 && z.price <= 5000 && priceForms(z.price).some((d) => src.includes(d)));
    if (!zones.length) return { ...p, zones: undefined };
    const prices = zones.map((z) => z.price);
    return { ...p, zones, min: Math.min(...prices), max: Math.max(...prices) };
  }).map(({ zones, ...rest }) => (zones ? { ...rest, zones } : rest));
}

/** Asigna cada precio a las fechas de su ciudad. */
export function assignToShows(prices: ExtractedPrice[], shows: { sourceId: string; city: string }[]): Map<string, ExtractedPrice> {
  const out = new Map<string, ExtractedPrice>();
  for (const s of shows) {
    const city = fold(s.city);
    const p = prices.find((x) => {
      const c = fold(x.city);
      return c.length >= 3 && (city.includes(c) || c.includes(city));
    });
    if (p) out.set(s.sourceId, p);
  }
  return out;
}

export const PRICE_QUERY: Record<string, string> = {
  ES: "precios entradas", GB: "ticket prices", IE: "ticket prices", FR: "prix billets", DE: "Tickets Preise", AT: "Tickets Preise",
  CH: "Tickets Preise", IT: "prezzi biglietti", NL: "ticketprijzen", BE: "tickets prix", PT: "preços bilhetes",
};
