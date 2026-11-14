/**
 * Páginas públicas de evento de Live Nation (livenation.es/.co.uk/…/event/…-edpNNN): traen las ventas
 * con su hora exacta (p. ej. "Preventa Registrados LiveNation.es", que Ticketmaster no publica en su
 * API) y enlazan al resto de fechas de la gira. Solo se leen esas páginas, con un User-Agent que dice
 * quién somos; nunca la búsqueda interna del sitio. Funciones puras.
 */
import type { SaleWindow, Show } from "./ticketmaster";
import { classifySaleLabel } from "./presale";

export interface LnSale {
  label: string;
  startsAt: string;
  /** Id numérico (o hexadecimal) del evento en Ticketmaster, sacado del enlace de compra. */
  tmEventId: string | null;
}

export const LN_EVENT_URL = /^https:\/\/www\.livenation\.[a-z.]{2,6}\/(?:[a-z]{2}\/)?event\/[a-z0-9-]+-edp\d+$/i;
const NOT_A_PRESALE = /(vip|paquete|package|experienc|hospitality|platinum|premium|a la venta|general|on ?sale|registro$)/i;

export function parseLnEvent(html: string, pageUrl: string): { sales: LnSale[]; siblings: string[]; lastDate: string | null } {
  const text = html.replace(/\\"/g, '"').replace(/\\u0026/g, "&");
  const sales = new Map<string, LnSale>();
  let lastDate: string | null = null;
  const re = /"type":"([^"]{2,120})","typeId":\d+,"ticketStatus":\d+,"ticketUrl":"([^"]*)","validFromUtc":"([^"]+)","validToUtc":"([^"]+)"/g;
  for (const m of text.matchAll(re)) {
    const [, label, ticketUrl, from, to] = m as unknown as [string, string, string, string, string];
    if (!lastDate || to > lastDate) lastDate = to;
    if (NOT_A_PRESALE.test(label) || Number.isNaN(Date.parse(from))) continue;
    const tm = ticketUrl.match(/ticketmaster\.[a-z.]+\/(?:[^/?"]+\/)?event\/(?:[^/?"]+\/)?(\d{6,}|[0-9A-F]{16})/i);
    const key = `${label}|${from}`;
    if (!sales.has(key)) sales.set(key, { label, startsAt: new Date(from).toISOString(), tmEventId: tm?.[1] ?? null });
  }
  const origin = new URL(pageUrl).origin;
  const siblings = [...new Set([...text.matchAll(/href="(\/(?:[a-z]{2}\/)?event\/[a-z0-9-]+-edp\d+)"/gi)].map((m) => origin + m[1]))].filter((u) => LN_EVENT_URL.test(u) && u !== pageUrl);
  return { sales: [...sales.values()], siblings, lastDate };
}

/** Une a una fecha las ventas de Live Nation que no trae Ticketmaster (misma etiqueta y hora no se repite). */
export function withExtraSales(show: Show, extra: { label: string; startsAt: string; url: string | null }[]): Show {
  if (!extra.length) return show;
  const have = new Set(show.sales.map((w) => `${w.label.toLowerCase()}|${w.startsAt ?? ""}`));
  const added: SaleWindow[] = extra
    .filter((e) => !have.has(`${e.label.toLowerCase()}|${e.startsAt}`))
    .map((e) => {
      const santander = /santander|s\.?\s?s\.?\s?music/i.test(e.label);
      const ln = /live ?nation/i.test(e.label);
      const { kind, orderRank } = classifySaleLabel(e.label);
      return { label: e.label, startsAt: e.startsAt, endsAt: null, url: e.url, kind: santander ? "card" : ln ? "promoter" : kind, orderRank: santander ? classifySaleLabel("visa").orderRank : ln ? classifySaleLabel("live nation").orderRank : orderRank };
    });
  return added.length ? { ...show, sales: [...show.sales, ...added] } : show;
}
