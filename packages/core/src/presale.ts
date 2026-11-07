import table from "../../../data/presale-kinds.json";

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
