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
    /** Última estimación de reventa guardada (para no volver a muestrear el mercado cada vez). */
    resaleAt: string | null;
    /** Estimación guardada (para reutilizar el mercado leído sin volver a gastar). */
    resale: ResaleInfo | null;
    /** Países de sus fechas sin límite de entradas conocido (ni de la ticketera ni de prensa). */
    limitCountries?: string[];
    /** Precios oficiales conocidos de sus fechas. */
    prices: { country: string; city: string; min: number; max: number; currency: string; zones?: { name: string; price: number }[] }[];
  }[];
}

export interface EnrichInput {
  signups?: { artistId: string; homepage?: string | null; links: SignupLink[] }[];
  venues?: { tmId: string; name: string; city?: string; country?: string; capacity: number | null; wikidataId?: string | null; source?: string }[];
  prices?: ({ sourceId: string } & PriceInfo)[];
  resale?: { artistId: string; info: ResaleInfo }[];
  /** Límite de entradas por persona encontrado en prensa. */
  limits?: { artistId: string; country: string; limit: number }[];
}

