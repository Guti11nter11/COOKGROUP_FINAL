/**
 * Límite de entradas por persona en textos de prensa ("máximo de 4 entradas por persona", "a limit of
 * four tickets per person"…). Solo frases que dicen "por persona/cliente/pedido": evita confundir el
 * número con precios o fechas. Puro.
 */
const WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, eight: 8, ten: 10,
  una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, ocho: 8, diez: 10,
  due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, otto: 8, dieci: 10,
  zwei: 2, drei: 3, vier: 4, "fünf": 5, sechs: 6, acht: 8, zehn: 10,
  deux: 2, trois: 3, quatre: 4, cinq: 5, huit: 8, dix: 10,
  twee: 2, drie: 3, zes: 6,
};
const N = `(\\d{1,2}|${Object.keys(WORDS).join("|")})`;
const PER = "(?:per|por|a|pro|par)\\s+(?:person[ae]?|persoon|personne|customer|household|transaction|order|account|utente|cliente|usuario|comprador|compra|transazione|kunde|bestellung|commande|foyer|klant|bestelling)";
const PATTERNS = [
  new RegExp(`(?:limit(?:ed)?(?:\\s+of)?|maximum(?:\\s+of)?|max\\.?|up to|restricted to)\\s+${N}\\s+tickets?\\s+${PER}`, "i"),
  new RegExp(`ticket limit(?:\\s+(?:of|is))?\\s+${N}\\s+${PER}`, "i"),
  new RegExp(`(?:m[aá]ximo|l[ií]mite)\\s+de\\s+${N}\\s+entradas?\\s+${PER}`, "i"),
  new RegExp(`(?:massimo|limite)\\s+(?:di\\s+)?${N}\\s+biglietti\\s+${PER}`, "i"),
  new RegExp(`(?:maximal|h[öo]chstens|max\\.?)\\s+${N}\\s+(?:tickets|karten)\\s+${PER}`, "i"),
  new RegExp(`(?:limite\\s+de|maximum\\s+de|max\\.?)\\s+${N}\\s+(?:billets|places)\\s+${PER}`, "i"),
  new RegExp(`(?:maximaal|max\\.?)\\s+${N}\\s+(?:tickets|kaarten)\\s+${PER}`, "i"),
  new RegExp(`${N}\\s+(?:tickets|entradas|biglietti|billets|karten)\\s+${PER}\\s+(?:maximum|m[aá]ximo|max)`, "i"),
];

export function limitFromText(text: string): number | null {
  for (const re of PATTERNS) {
    const m = re.exec(text);
    if (!m) continue;
    const raw = m[1]!.toLowerCase();
    const n = /^\d+$/.test(raw) ? Number(raw) : WORDS[raw] ?? null;
    if (n && n >= 1 && n <= 20) return n;
  }
  return null;
}

/** El valor más repetido entre fuentes (empate → el menor, el más prudente). */
export function consensus(values: number[]): number | null {
  const c = new Map<number, number>();
  for (const v of values) c.set(v, (c.get(v) ?? 0) + 1);
  return [...c].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? null;
}

/** Búsqueda de prensa por país (idioma local). */
export const LIMIT_QUERY: Record<string, string> = {
  ES: "límite entradas por persona",
  GB: "ticket limit per person",
  IE: "ticket limit per person",
  IT: "limite biglietti a persona",
  DE: "maximal Tickets pro Person",
  AT: "maximal Tickets pro Person",
  CH: "maximal Tickets pro Person",
  FR: "limite billets par personne",
  BE: "limite billets par personne",
  NL: "maximaal tickets per persoon",
  PT: "limite bilhetes por pessoa",
  MX: "límite de boletos por persona",
  US: "ticket limit per person",
  CA: "ticket limit per person",
};
