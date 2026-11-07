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
