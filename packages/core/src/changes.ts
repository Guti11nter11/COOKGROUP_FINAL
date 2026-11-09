import { PROMO } from "./sheet";
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
  /** Si se indica, solo se avisa de lo accionable: nada cuyas ventas ya hayan pasado. */
  now?: Date;
}

const RECENT_ONSALE_MS = 24 * 60 * 60 * 1000;
const SERIOUS_STATUS = new Set(["cancelled", "postponed", "rescheduled"]);

/** FNV-1a de 32 bits: huella estable y barata (deduplicar avisos, detectar fichas sin cambios). */
export function stableHash(text: string): string {
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
    dedupeKey: `${kind}:${next.sourceId}:${stableHash(JSON.stringify(detail))}`,
    ...(startsAt ? { startsAt } : {}),
    detail,
  });

  const now = ctx.now?.getTime();
  const future = (iso: string | null) => now === undefined || !iso || Date.parse(iso) > now;

  if (!prev) {
    if (ctx.bootstrap) return [];
    // Una fecha "nueva" cuyas ventas pasaron hace más de 24 h no es noticia (ya estaba a la venta).
    const timed = next.sales.filter((w) => w.startsAt && !PROMO.test(w.label) && w.kind !== "official_resale");
    // Ya a la venta (la venta general empezó hace más de 24 h): no es noticia aunque traiga promociones.
    const onSaleLongAgo = now !== undefined && next.sales.some((w) => w.kind === "general" && w.startsAt && Date.parse(w.startsAt) <= now - RECENT_ONSALE_MS);
    const actionable =
      !onSaleLongAgo && (now === undefined || timed.length === 0 || timed.some((w) => Date.parse(w.startsAt!) > now - RECENT_ONSALE_MS) || next.sales.some((w) => !w.startsAt && w.kind === "general"));
    if (!actionable) return [];
    const firstSale = next.sales.find((s) => s.startsAt)?.startsAt ?? null;
    const kind: AlertKind = ctx.knownDatesInCountry > 0 ? "extra_date" : "new_event";
    return [make(kind, { localDate: next.localDate, venue: next.venue.name }, firstSale)];
  }

  const alerts: Alert[] = [];
  // Solo cambios de estado serios (cancelado, aplazado, nueva fecha); el vaivén onsale ↔ offsale es ruido.
  if (prev.status !== next.status && (SERIOUS_STATUS.has(next.status) || SERIOUS_STATUS.has(prev.status))) {
    alerts.push(make("status_changed", { before: prev.status, after: next.status }));
  }

  // Emparejar ventanas: primero las idénticas (etiqueta + hora); las que quedan sueltas con la misma
  // etiqueta se consideran un cambio de hora; las demás, ventanas nuevas.
  const exact = (w: SaleWindow) => `${saleId(w)}|${w.startsAt ?? ""}`;
  const nextKeys = new Set(next.sales.map(exact));
  const orphans = prev.sales.filter((w) => !nextKeys.has(exact(w)));
  const prevKeys = new Set(prev.sales.map(exact));
  for (const w of next.sales) {
    if (prevKeys.has(exact(w))) continue;
    const i = orphans.findIndex((o) => saleId(o) === saleId(w));
    // Venta general "por confirmar" (sin fecha): no es noticia por sí sola; avisará cuando tenga hora.
    if (!w.startsAt && w.kind === "general") {
      if (i >= 0) orphans.splice(i, 1);
      continue;
    }
    if (!future(w.startsAt)) {
      if (i >= 0) orphans.splice(i, 1);
      continue; // ventana que ya empezó: no es accionable
    }
    // Promociones u ofertas de un evento que ya está a la venta: no son una salida de entradas.
    if (PROMO.test(w.label) || (now !== undefined && next.sales.some((g) => g.kind === "general" && g.startsAt && Date.parse(g.startsAt) <= now))) {
      if (i >= 0) orphans.splice(i, 1);
      continue;
    }
    if (i < 0) {
      alerts.push(make("sale_added", { label: w.label, kind: w.kind, at: madrid(w.startsAt) }, w.startsAt));
      continue;
    }
    const old = orphans.splice(i, 1)[0]!;
    alerts.push(
      make(
        "sale_changed",
        { label: w.label, kind: w.kind, before: madrid(old.startsAt), after: madrid(w.startsAt), afterIso: w.startsAt ?? "" },
        w.startsAt,
      ),
    );
  }
  return alerts;
}
