import { classifySaleLabel, type SaleKind } from "./presale";

export interface SaleWindow {
  kind: SaleKind;
  label: string;
  startsAt: string | null;
  endsAt: string | null;
  url: string | null;
  orderRank: number;
}

export type ShowStatus = "onsale" | "offsale" | "cancelled" | "postponed" | "rescheduled";

export interface Show {
  source: "ticketmaster";
  sourceId: string;
  name: string;
  attractionIds: string[];
  venue: { tmId: string; name: string; city: string; country: string; tz: string | null };
  startsAt: string | null;
  localDate: string;
  status: ShowStatus;
  ticketLimit: string | null;
  url: string;
  isPackage: boolean;
  sales: SaleWindow[];
  /** Clasificación de Ticketmaster (para enrutar música / deporte). */
  segment?: string;
  genre?: string;
  subGenre?: string;
  promoters?: string[];
  /** Página oficial del artista en la ticketera (enlaces de lanzamiento). */
  artistUrl?: string;
  /** Ticketmaster la marca como evento de alta demanda (feed: hotEvent). */
  hot?: boolean;
  /** Rango de precio oficial publicado por la ticketera (face value). */
  price?: ShowPrice;
}

export interface ShowPrice {
  min: number;
  max: number;
  currency: string;
}

/** Rango de precios de un evento: `priceRanges` (API) o `minPrice`/`maxPrice` (feed). Null si no es creíble. */
export function priceOf(raw: unknown): ShowPrice | null {
  const e = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const ranges = Array.isArray(e.priceRanges) ? (e.priceRanges as Record<string, unknown>[]) : [];
  const r = ranges.find((x) => x && x.type === "standard") ?? ranges[0];
  const min = Number(r ? r.min : e.minPrice);
  const max = Number(r ? r.max : e.maxPrice);
  const currency = String((r ? r.currency : e.currency) ?? "");
  if (!(min > 0) || !(max >= min) || !/^[A-Z]{3}$/.test(currency)) return null;
  return { min, max, currency };
}

/**
 * Listados accesorios de una fecha (paquetes VIP, hospitality, parking, entradas premium, palcos): no son
 * fechas nuevas ni entradas normales (decisión del propietario, 2026-11-11: siempre el enlace de las normales).
 */
const PACKAGE_RE =
  /\|\s*[^|]*\b(VIP|Packages?|Paquetes?)\b|\b(hospitality|parking|aparcamiento|estacionamento|car park|hotell?rom|hotel ?rooms?|hotelzimmer|hotel package|accommodation|alojamiento|overnatting|shuttle|coach travel|bus package|merch(andise)? bundle|upgrade|premium|suites?|logen(-seat)?|box seats?|club seats?|lounge|meet ?(&|and) ?greet)\b/i;
const STATUS: Record<string, ShowStatus> = {
  onsale: "onsale",
  offsale: "offsale",
  canceled: "cancelled",
  cancelled: "cancelled",
  postponed: "postponed",
  rescheduled: "rescheduled",
};

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" ? (v as Obj) : {});
const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);

/** Quita parámetros de cola (`queueittoken`) de una URL oficial: nunca se comparten pases de cola. */
export const isPackageName = (name: string) => PACKAGE_RE.test(name);

export function stripQueueToken(url: string): string {
  try {
    const u = new URL(url);
    for (const k of [...u.searchParams.keys()]) if (k.toLowerCase() === "queueittoken") u.searchParams.delete(k);
    return u.toString();
  } catch {
    return url;
  }
}

function saleWindow(label: string, raw: Obj, url: string | null): SaleWindow {
  const { kind, orderRank } = classifySaleLabel(label);
  return { kind, label, startsAt: str(raw.startDateTime), endsAt: str(raw.endDateTime), url, orderRank };
}

/** Convierte un evento crudo de Discovery v2 en un Show; null si le falta recinto o fecha. */
export function normalizeTmEvent(raw: unknown): Show | null {
  const e = obj(raw);
  const id = str(e.id);
  const emb = obj(e._embedded);
  const v = obj((emb.venues as unknown[] | undefined)?.[0]);
  const start = obj(obj(e.dates).start);
  const localDate = str(start.localDate);
  const venueId = str(v.id);
  if (!id || !venueId || !localDate) return null;

  const timeUnknown = start.timeTBA === true || start.noSpecificTime === true || start.dateTBD === true;
  const sales = obj(e.sales);
  const windows: SaleWindow[] = ((sales.presales as unknown[] | undefined) ?? []).map((p) => {
    const po = obj(p);
    const url = str(po.url);
    return saleWindow(str(po.name) ?? "Preventa", po, url ? stripQueueToken(url) : null);
  });
  const pub = obj(sales.public);
  if (str(pub.startDateTime) && pub.startTBD !== true && pub.startTBA !== true) {
    windows.push({ ...saleWindow("Venta general", pub, null), kind: "general", orderRank: 90 });
  } else if ((pub.startTBD === true || pub.startTBA === true) && !["cancelled", "postponed"].includes(STATUS[str(obj(obj(e.dates).status).code) ?? ""] ?? "")) {
    // Gira anunciada con la venta "por confirmar": es justo lo que interesa saber pronto.
    windows.push({ kind: "general", label: "Venta general", startsAt: null, endsAt: null, url: null, orderRank: 90 });
  }
  windows.sort((x, y) => x.orderRank - y.orderRank || (x.startsAt ?? "").localeCompare(y.startsAt ?? ""));

  const name = str(e.name) ?? "";
  return {
    source: "ticketmaster",
    sourceId: id,
    name,
    attractionIds: ((emb.attractions as unknown[] | undefined) ?? []).map((a) => str(obj(a).id)).filter((x): x is string => !!x),
    venue: {
      tmId: venueId,
      name: str(v.name) ?? "",
      city: str(obj(v.city).name) ?? "",
      country: str(obj(v.country).countryCode) ?? "",
      tz: str(v.timezone) ?? str(obj(e.dates).timezone),
    },
    startsAt: timeUnknown ? null : str(start.dateTime),
    localDate,
    status: STATUS[str(obj(obj(e.dates).status).code) ?? ""] ?? "onsale",
    ticketLimit: str(obj(e.ticketLimit).info),
    url: stripQueueToken(str(e.url) ?? ""),
    isPackage: PACKAGE_RE.test(name),
    sales: windows,
    ...classification((e.classifications as unknown[] | undefined)?.[0]),
    ...(str(obj((emb.attractions as unknown[] | undefined)?.[0]).url) ? { artistUrl: str(obj((emb.attractions as unknown[] | undefined)?.[0]).url)! } : {}),
    ...(priceOf(e) ? { price: priceOf(e)! } : {}),
  };
}

const meaningful = (v: string | null) => (v && v !== "Undefined" && v !== "Miscellaneous" ? v : undefined);

function classification(raw: unknown): { segment?: string; genre?: string; subGenre?: string } {
  const c = obj(raw);
  const out: { segment?: string; genre?: string; subGenre?: string } = {};
  const seg = meaningful(str(obj(c.segment).name));
  const gen = meaningful(str(obj(c.genre).name));
  const sub = meaningful(str(obj(c.subGenre).name));
  if (seg) out.segment = seg;
  if (gen) out.genre = gen;
  if (sub) out.subGenre = sub;
  return out;
}

/** Identidad de una fecha: artista principal + recinto + día local (agrupa variantes VIP). */
export function showKey(s: Show): string {
  return `${s.attractionIds[0] ?? "?"}:${s.venue.tmId}:${s.localDate}`;
}
