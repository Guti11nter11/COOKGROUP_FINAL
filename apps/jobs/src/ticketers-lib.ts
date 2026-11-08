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
  // El Corte Inglés y AXS: la búsqueda renderizada no devolvió fichas (ECI) o tarda ~1 min y da 422 (AXS);
  // desactivadas hasta ajustar la URL de búsqueda.
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
