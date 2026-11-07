import { stableHash } from "./changes";
import { classifySaleLabel } from "./presale";
import { isPackageName, stripQueueToken, type SaleWindow, type Show, type ShowStatus } from "./ticketmaster";

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" ? (v as Obj) : {});
const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);
const meaningful = (v: string | null | undefined) => (v && v !== "Undefined" && v !== "Miscellaneous" ? v : undefined);

const STATUS: Record<string, ShowStatus> = {
  onsale: "onsale", offsale: "offsale", canceled: "cancelled", cancelled: "cancelled", postponed: "postponed", rescheduled: "rescheduled",
};

const LIMIT_RE = /[^.]*\b(max(imum)? of \d+ tickets|limit of \d+ tickets|\d+ tickets? (per|max)|l[ií]mite de \d+ entradas|m[aá]ximo de \d+ entradas)[^.]*\./i;

/** Frase con el límite de entradas dentro de un texto libre ("A max of 12 tickets…", "Límite de 4 entradas…"). */
export function extractTicketLimit(text: string | null | undefined): string | null {
  const m = text ? LIMIT_RE.exec(text) : null;
  return m ? m[0].trim() : null;
}

/** Convierte un evento del Discovery Feed (fichero por país) en un Show; null si le falta lo esencial. */
export function normalizeFeedEvent(raw: unknown): Show | null {
  const e = obj(raw);
  const id = str(e.eventId);
  const v = obj(e.venue);
  const venueId = str(v.venueId);
  const localDate = str(e.eventStartLocalDate);
  if (!id || !venueId || !localDate) return null;

  const attractions = ((e.attractions as unknown[] | undefined) ?? []).map((a) => obj(obj(a).attraction));
  const first = attractions[0] ?? {};
  const windows: SaleWindow[] = ((e.presales as unknown[] | undefined) ?? []).map((p) => {
    const po = obj(obj(p).presale);
    const label = str(po.name) ?? "Preventa";
    const { kind, orderRank } = classifySaleLabel(label);
    const url = str(po.url);
    return { kind, label, startsAt: str(po.startDatetime), endsAt: str(po.endDatetime), url: url ? stripQueueToken(url) : null, orderRank };
  });
  const onsale = str(e.onsaleStartDateTime);
  if (onsale) windows.push({ kind: "general", label: "Venta general", startsAt: onsale, endsAt: str(e.onsaleEndDateTime), url: null, orderRank: 90 });
  windows.sort((x, y) => x.orderRank - y.orderRank || (x.startsAt ?? "").localeCompare(y.startsAt ?? ""));

  const name = str(e.eventName) ?? "";
  const show: Show = {
    source: "ticketmaster",
    sourceId: id,
    name,
    attractionIds: attractions.map((a) => str(a.attractionId)).filter((x): x is string => !!x),
    venue: {
      tmId: venueId,
      name: str(v.venueName) ?? "",
      city: str(v.venueCity) ?? "",
      country: str(v.venueCountryCode) ?? "",
      tz: str(v.venueTimezone),
    },
    startsAt: str(e.eventStartDateTime),
    localDate,
    status: STATUS[str(e.eventStatus) ?? ""] ?? "onsale",
    ticketLimit: extractTicketLimit(str(e.pleaseNote)) ?? extractTicketLimit(str(e.eventInfo)),
    url: stripQueueToken(str(e.primaryEventUrl) ?? ""),
    isPackage: isPackageName(name),
    sales: windows,
    promoters: ((e.promoters as unknown[] | undefined) ?? []).map((p) => str(obj(obj(p).promoter).name)).filter((x): x is string => !!x),
  };
  const segment = meaningful(str(e.classificationSegment)) ?? meaningful(str(first.classificationSegment));
  const genre = meaningful(str(first.classificationGenre)) ?? meaningful(str(e.classificationGenre));
  const subGenre = meaningful(str(first.classificationSubGenre)) ?? meaningful(str(e.classificationSubGenre));
  const artistUrl = str(first.attractionUrl);
  if (artistUrl) show.artistUrl = artistUrl;
  if (segment) show.segment = segment;
  if (genre) show.genre = genre;
  if (subGenre) show.subGenre = subGenre;
  return show;
}

export type Topic = "music" | "nfl" | "football" | "f1" | "tennis" | "other_sport" | "other";

/** Tema de una fecha para enrutar el aviso al canal adecuado. */
export function topicOf(s: Pick<Show, "segment" | "genre" | "subGenre">): Topic {
  if (s.segment === "Music") return "music";
  if (s.segment !== "Sports") return "other";
  const g = `${s.genre ?? ""} ${s.subGenre ?? ""}`.toLowerCase();
  if (g.includes("nfl")) return "nfl";
  if (g.includes("soccer")) return "football";
  if (g.includes("formula 1") || g.includes("formula one")) return "f1";
  if (g.includes("tennis")) return "tennis";
  return "other_sport";
}

/** Huella de lo que importa de una fecha (estado, fecha, recinto, ventanas): igual venga de la API o del feed. */
export function semanticHash(s: Show): string {
  const sales = s.sales.map((w) => `${w.kind}|${w.label}|${w.startsAt ?? ""}`).sort();
  return stableHash(JSON.stringify([s.status, s.startsAt, s.localDate, s.venue.tmId, s.isPackage, sales]));
}
