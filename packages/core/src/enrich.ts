import type { PriceInfo, ResaleInfo, SignupLink } from "./sheet";

/** Lo que los trabajos de enriquecimiento (GitHub Actions) tienen que buscar. */
export interface EnrichTodo {
  venues: { tmId: string; name: string; city: string; country: string }[];
  shows: { sourceId: string; artistId: string; artist: string; name: string; city: string; country: string; localDate: string; venue: string }[];
  artists: {
    artistId: string;
    mbid: string | null;
    homepage: string | null;
    /** Tiene preventas del artista/fan club/registro por llegar (hay que buscar dónde registrarse). */
    needsSignup: boolean;
    name: string;
    tier: number;
    dates: number;
    /** Ciudad y día de cada fecha (para asociar enlaces de registro). */
    when: { city: string; localDate: string }[];
    countries: string[];
    venues: { tmId: string; name: string; country: string }[];
    hot: boolean;
    firstSale: string | null;
  }[];
}

export interface EnrichInput {
  signups?: { artistId: string; homepage?: string | null; links: SignupLink[] }[];
  venues?: { tmId: string; name: string; city?: string; country?: string; capacity: number | null; wikidataId?: string | null; source?: string }[];
  prices?: ({ sourceId: string } & PriceInfo)[];
  resale?: { artistId: string; info: ResaleInfo }[];
}

