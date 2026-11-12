import table from "../../../data/presale-kinds.json";
import programs from "../../../data/presale-programs.json";

export type SaleKind =
  | "fanclub" | "artist" | "card" | "telco" | "platform" | "promoter" | "ticketer"
  | "venue" | "registration" | "lottery" | "general" | "official_resale" | "unknown";

const RULES = table.rules.map((r) => ({ kind: r.kind as SaleKind, re: new RegExp(r.pattern, "i") }));
const RANKS = table.ranks as Record<SaleKind, number>;

/** Normaliza la etiqueta cruda de una ventana de venta (cualquier idioma) a su tipo y orden. */
export function classifySaleLabel(label: string): { kind: SaleKind; orderRank: number } {
  const kind = RULES.find((r) => r.re.test(label))?.kind ?? "unknown";
  return { kind, orderRank: RANKS[kind] };
}

const PROGRAMS = programs.programs.map((p) => ({ re: new RegExp(p.match, "i"), how: p.how, url: p.url ?? null, byCountry: (p as { urlByCountry?: Record<string, string> }).urlByCountry ?? {} }));

/** Cómo entrar en un programa de preventa conocido (Mastercard, O2, MOJO, Live Nation…), con su web oficial. */
export function presaleGuide(label: string, country?: string): { how: string; url: string | null } | null {
  const p = PROGRAMS.find((x) => x.re.test(label));
  if (!p) return null;
  return { how: p.how, url: (country && p.byCountry[country]) || p.url };
}

/** Programas de preventa que la prensa nombra ("preventa de Live Nation", "Visa", "O2"…). */
const PROGRAM_WORDS: [RegExp, string][] = [
  [/live ?nation/i, "Live Nation"],
  [/ticketmaster/i, "Ticketmaster"],
  [/\bvisa\b/i, "Visa"],
  [/mastercard|priceless/i, "Mastercard"],
  [/american express|\bamex\b/i, "American Express"],
  [/\bo2\b/i, "O2"],
  [/vodafone/i, "Vodafone"],
  [/movistar(?! arena)/i, "Movistar"],
  [/santander/i, "Santander"],
  [/\bbbva\b/i, "BBVA"],
  [/caixa/i, "CaixaBank"],
  [/corte ingl/i, "El Corte Inglés"],
  [/spotify/i, "Spotify"],
  [/fan ?club|club de fans/i, "fan club"],
  [/seated/i, "Seated"],
  [/laylo/i, "Laylo"],
];

/**
 * Una preventa que la prensa anuncia y que la ficha no tiene (p. ej. la de Live Nation en España, que
 * Ticketmaster no publica en su API): el nombre del programa, o null si la ficha ya la cuenta.
 */
export function uncoveredPresale(text: string, labels: string[]): string | null {
  const have = labels.join(" | ");
  for (const [re, name] of PROGRAM_WORDS) if (re.test(text) && !re.test(have)) return name;
  return null;
}
