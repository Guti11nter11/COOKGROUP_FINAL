/** Ticketeras sin API: búsqueda por artista y extracción de fichas de evento. Funciones puras. */

export interface Ticketer {
  id: string;
  name: string;
  country: string;
  search: (artist: string) => string;
  /** Rutas que son fichas de evento o de artista en esa ticketera. */
  eventPath: RegExp;
  /** false = pendiente de ajustar (no se lee para no gastar tiempo de navegador). */
  enabled?: boolean;
}

export const TICKETERS: Ticketer[] = [
  { id: "entradas", name: "Entradas.com (Eventim ES)", country: "ES", search: (a) => `https://www.entradas.com/search/?affiliate=EES&searchterm=${encodeURIComponent(a)}`, eventPath: /\/(event|artist|eventseries)\//i },
  // El Corte Inglés: la búsqueda renderizada no devolvió fichas; pendiente de ajustar. AXS se lee por sus
  // sitemaps públicos (ver axsEventsFor), no con el navegador.
  { enabled: false, id: "eci", name: "El Corte Inglés", country: "ES", search: (a) => `https://www.elcorteingles.es/entradas/buscar/?term=${encodeURIComponent(a)}`, eventPath: /\/entradas\/(conciertos|musica|festivales|teatro|deportes)\/.+/i },
  { id: "seetickets", name: "See Tickets", country: "GB", search: (a) => `https://www.seetickets.com/search?q=${encodeURIComponent(a)}`, eventPath: /\/(event|tour)\//i },
  { enabled: false, id: "axs", name: "AXS", country: "GB", search: (a) => `https://www.axs.com/uk/search?q=${encodeURIComponent(a)}`, eventPath: /\/(events|artists)\/\d+/i },
];

const fold = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const slug = (t: string) => fold(t).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export interface Listing {
  url: string;
  text: string;
}

/** Fichas del artista en el HTML de la búsqueda: el enlace o su texto deben nombrar al artista. */
export function listingsFor(html: string, base: string, artist: string, t: Ticketer): Listing[] {
  const out = new Map<string, Listing>();
  const name = fold(artist);
  const s = slug(artist);
  for (const m of html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    let url: URL;
    try {
      url = new URL(m[1]!.replace(/&amp;/g, "&"), base);
    } catch {
      continue;
    }
    if (url.hostname !== new URL(base).hostname || !t.eventPath.test(url.pathname)) continue;
    if ([...url.searchParams.keys()].some((k) => /queueittoken/i.test(k))) continue;
    const text = m[2]!.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim().slice(0, 140);
    if (!fold(text).includes(name) && !url.pathname.toLowerCase().includes(s)) continue;
    url.hash = "";
    for (const k of [...url.searchParams.keys()]) if (/^(utm_|affiliate$)/i.test(k)) url.searchParams.delete(k);
    const key = url.toString();
    if (!out.has(key) || (out.get(key)!.text.length < text.length)) out.set(key, { url: key, text: text || url.pathname.split("/").filter(Boolean).pop()!.replace(/-/g, " ") });
  }
  return [...out.values()];
}

const AXS_NOT_ARTIST = /(tribute|parking|hotel|hospitality|package|vip|experience|reloaded|legacy|the-music-of|celebrating|-pass-|2-day|camping|shuttle|coach)/i;

export const axsSlug = (name: string) =>
  name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/**
 * Una sola pasada por el sitemap: cada evento se asigna al artista cuyo nombre es el prefijo más largo
 * de la URL ("metallica-tickets" → Metallica). Nombres cortos solo con "-tickets" justo detrás.
 */
export function axsMatchAll(xml: string, artists: string[]): Map<string, { url: string; id: number }[]> {
  const bySlug = new Map(artists.map((a) => [axsSlug(a), a] as const).filter(([sl]) => sl.length >= 2));
  const out = new Map<string, { url: string; id: number }[]>();
  for (const m of xml.matchAll(/<loc>(https:\/\/www\.axs\.com\/[a-z]{2}\/events\/(\d+)\/([a-z0-9-]+))<\/loc>/g)) {
    const seg = m[3]!;
    if (AXS_NOT_ARTIST.test(seg)) continue;
    const parts = seg.split("-");
    for (let n = Math.min(parts.length - 1, 8); n >= 1; n--) {
      const slug = parts.slice(0, n).join("-");
      const artist = bySlug.get(slug);
      if (!artist) continue;
      if (slug.length < 4 && parts[n] !== "tickets") break;
      out.set(artist, [...(out.get(artist) ?? []), { url: m[1]!, id: Number(m[2]) }]);
      break;
    }
  }
  return out;
}
