/**
 * DICE (dice.fm): solo páginas públicas que robots.txt permite — la del artista (sus eventos, en
 * JSON-LD) y la de cada evento (datos de venta en __NEXT_DATA__). Nunca su búsqueda ni APIs internas.
 * Muchos conciertos íntimos del Reino Unido solo se venden aquí (Charli xcx en Apple Music Hall).
 */
import { classifySaleLabel } from "./presale";
import type { SaleWindow, Show, ShowStatus } from "./ticketmaster";

const iso = (t: unknown): string | null => {
  if (typeof t !== "string" || !t) return null;
  const ms = Date.parse(t);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
};

/** Eventos futuros de la página de un artista en DICE (JSON-LD PerformingGroup.event). */
export function diceArtistEvents(html: string, now: Date): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const d = JSON.parse(m[1]!) as { "@type"?: string; event?: { url?: string; startDate?: string }[] };
      if (d["@type"] !== "PerformingGroup") continue;
      for (const e of d.event ?? []) {
        const at = e.startDate ? Date.parse(e.startDate) : NaN;
        if (e.url && /^https:\/\/dice\.fm\/event\//.test(e.url) && at > now.getTime()) out.push(e.url);
      }
    } catch {
      /* bloque no válido */
    }
  }
  return [...new Set(out)];
}

const STATUS: Record<string, ShowStatus> = { "sold-out": "offsale", "off-sale": "offsale", cancelled: "cancelled", postponed: "postponed", rescheduled: "rescheduled" };

/** Un evento de DICE como fecha de GIRA (mismo formato que Ticketmaster). Null si faltan datos. */
export function parseDiceEvent(html: string, attractionId: string, url: string): Show | null {
  const m = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i.exec(html);
  if (!m) return null;
  try {
    const next = JSON.parse(m[1]!) as { props?: { pageProps?: { initialState?: string | object } } };
    const raw = next.props?.pageProps?.initialState;
    const state = (typeof raw === "string" ? JSON.parse(raw) : raw) as { event?: { event?: Record<string, any> } };
    const ev = state?.event?.event;
    if (!ev?.id || !ev.dates) return null;
    const venue = (ev.venues ?? [])[0] ?? {};
    const tz: string | null = ev.dates.timezone ?? venue.city?.location?.place ?? null;
    const startsAt = iso(ev.dates.event_start_date);
    if (!startsAt) return null;
    const localDate = new Intl.DateTimeFormat("en-CA", { timeZone: tz ?? "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(startsAt));
    const sales: SaleWindow[] = [];
    const pre = iso(ev.dates.pre_sale_start_date);
    if (pre) sales.push({ kind: "ticketer", label: "Preventa DICE", startsAt: pre, endsAt: null, url: null, orderRank: classifySaleLabel("Ticketmaster Presale").orderRank });
    const gen = iso(ev.dates.sale_start_date);
    if (gen) sales.push({ kind: "general", label: "Venta general", startsAt: gen, endsAt: null, url: null, orderRank: classifySaleLabel("Venta general").orderRank });
    const amount = typeof ev.price?.amount === "number" ? ev.price.amount / 100 : null;
    return {
      source: "dice",
      sourceId: `dice:${ev.id}`,
      name: String(ev.name ?? ""),
      attractionIds: [attractionId],
      venue: { tmId: `dice:${venue.id ?? ev.id}`, name: String(venue.name ?? ""), city: String(venue.city?.name ?? "").trim(), country: String(venue.city?.country_code ?? ""), tz },
      startsAt,
      localDate,
      status: STATUS[String(ev.status)] ?? "onsale",
      ticketLimit: typeof ev.max_tickets === "number" ? `Límite de ${ev.max_tickets} entradas por persona (DICE).` : null,
      url,
      isPackage: false,
      sales,
      segment: "Music",
      ...(amount && amount > 0 ? { price: { min: amount, max: amount, currency: String(ev.price.currency ?? "GBP") } } : {}),
    };
  } catch {
    return null;
  }
}
