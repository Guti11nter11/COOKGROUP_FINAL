import type { AlertKind } from "./quiet";
import { showKey, type SaleWindow, type Show } from "./ticketmaster";
import { formatHHmm, MADRID } from "./time";

export interface Alert {
  kind: AlertKind;
  showKey: string;
  sourceId: string;
  artistName: string;
  tier: 1 | 2 | 3;
  dedupeKey: string;
  startsAt?: string;
  detail: Record<string, string>;
}

export interface ChangeContext {
  /** Primera vez que se ve al artista: se guarda en silencio. */
  bootstrap: boolean;
  /** Fechas ya conocidas del artista en el mismo país (para distinguir fecha extra). */
  knownDatesInCountry: number;
  artistName: string;
  tier: 1 | 2 | 3;
}

/** FNV-1a de 32 bits: huella estable y barata para deduplicar avisos. */
function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

const saleId = (w: SaleWindow) => `${w.kind}|${w.label}`;
const madrid = (iso: string | null) => (iso ? formatHHmm(iso, MADRID) : "por confirmar");

/** Avisos que provoca pasar de `prev` (lo guardado) a `next` (lo recién leído). */
export function detectAlerts(prev: Show | null, next: Show, ctx: ChangeContext): Alert[] {
  if (next.isPackage) return [];
  const make = (kind: AlertKind, detail: Record<string, string>, startsAt?: string | null): Alert => ({
    kind,
    showKey: showKey(next),
    sourceId: next.sourceId,
    artistName: ctx.artistName,
    tier: ctx.tier,
    dedupeKey: `${kind}:${next.sourceId}:${fnv1a(JSON.stringify(detail))}`,
    ...(startsAt ? { startsAt } : {}),
    detail,
  });

  if (!prev) {
    if (ctx.bootstrap) return [];
    const firstSale = next.sales.find((s) => s.startsAt)?.startsAt ?? null;
    const kind: AlertKind = ctx.knownDatesInCountry > 0 ? "extra_date" : "new_event";
    return [make(kind, { localDate: next.localDate, venue: next.venue.name }, firstSale)];
  }

  const alerts: Alert[] = [];
  if (prev.status !== next.status) alerts.push(make("status_changed", { before: prev.status, after: next.status }));

  const before = new Map(prev.sales.map((w) => [saleId(w), w]));
  for (const w of next.sales) {
    const old = before.get(saleId(w));
    if (!old) {
      alerts.push(make("sale_added", { label: w.label, kind: w.kind, at: madrid(w.startsAt) }, w.startsAt));
    } else if (old.startsAt !== w.startsAt) {
      alerts.push(
        make(
          "sale_changed",
          { label: w.label, kind: w.kind, before: madrid(old.startsAt), after: madrid(w.startsAt), afterIso: w.startsAt ?? "" },
          w.startsAt,
        ),
      );
    }
  }
  return alerts;
}
