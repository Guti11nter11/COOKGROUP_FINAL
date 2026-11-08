import { countryCode } from "./resale-lib";

/** Mercado de reventa en SeatGeek (API oficial y gratuita; necesita SEATGEEK_CLIENT_ID). */
export interface SeatGeekMarket {
  country: string;
  city: string;
  localDate: string;
  median: number;
  p25: number;
  p75: number;
  currency: string;
  listings: number;
  source: string;
}

type SgEvent = {
  datetime_local?: string;
  performers?: { name?: string }[];
  venue?: { city?: string; country?: string };
  stats?: { lowest_price?: number | null; median_price?: number | null; average_price?: number | null; highest_price?: number | null; listing_count?: number | null };
};

/** Fechas del artista con anuncios en SeatGeek, como datos de mercado (USD). Pura. */
export function marketsFromSeatGeek(artist: string, events: SgEvent[]): SeatGeekMarket[] {
  const fold = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const me = fold(artist);
  return events
    .filter((e) => e.performers?.some((p) => fold(p.name ?? "") === me) && (e.stats?.listing_count ?? 0) >= 5)
    .filter((e) => e.stats?.median_price && e.stats.lowest_price && e.datetime_local)
    .map((e) => ({
      country: countryCode(e.venue?.country ?? ""),
      city: e.venue?.city ?? "",
      localDate: e.datetime_local!.slice(0, 10),
      median: Math.round(e.stats!.median_price!),
      // SeatGeek no da percentiles: mínimo y media como banda orientativa.
      p25: Math.round(e.stats!.lowest_price!),
      p75: Math.round(e.stats!.average_price ?? e.stats!.median_price!),
      currency: "USD",
      listings: e.stats!.listing_count!,
      source: "SeatGeek",
    }));
}

export async function seatGeekMarkets(artist: string): Promise<SeatGeekMarket[]> {
  const id = process.env.SEATGEEK_CLIENT_ID;
  if (!id) return [];
  const q = new URLSearchParams({ q: artist, per_page: "25", client_id: id });
  try {
    const res = await fetch(`https://api.seatgeek.com/2/events?${q}`, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return [];
    return marketsFromSeatGeek(artist, ((await res.json()) as { events?: SgEvent[] }).events ?? []).slice(0, 4);
  } catch {
    return [];
  }
}
