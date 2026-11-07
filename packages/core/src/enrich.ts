import type { PriceInfo, ResaleInfo } from "./sheet";

/** Lo que los trabajos de enriquecimiento (GitHub Actions) tienen que buscar. */
export interface EnrichTodo {
  venues: { tmId: string; name: string; city: string; country: string }[];
  shows: { sourceId: string; artistId: string; artist: string; name: string; city: string; country: string; localDate: string; venue: string }[];
  artists: {
    artistId: string;
    name: string;
    tier: number;
    dates: number;
    countries: string[];
    venues: { tmId: string; name: string; country: string }[];
    hot: boolean;
    firstSale: string | null;
  }[];
}

export interface EnrichInput {
  venues?: { tmId: string; name: string; city?: string; country?: string; capacity: number | null; wikidataId?: string | null; source?: string }[];
  prices?: ({ sourceId: string } & PriceInfo)[];
  resale?: { artistId: string; info: ResaleInfo }[];
}

