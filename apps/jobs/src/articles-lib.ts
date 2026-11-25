/** Artículos de los blogs oficiales de Ticketmaster: feed RSS y enlaces de registro. Funciones puras. */
import { cleanUrl, labelFor, SHORT } from "./signups-lib";

export interface FeedItem {
  title: string;
  link: string;
  pubDate: string;
  description: string;
}

const tag = (xml: string, name: string) => {
  const m = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i").exec(xml);
  return (m?.[1] ?? "").replace(/^<!\[CDATA\[|\]\]>$/g, "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#8217;|&rsquo;/g, "’").replace(/\s+/g, " ").trim();
};

export function parseFeed(xml: string): FeedItem[] {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map((m) => ({
    title: tag(m[1]!, "title"),
    link: tag(m[1]!, "link"),
    pubDate: tag(m[1]!, "pubDate"),
    description: tag(m[1]!, "description"),
  }));
}

/** Enlaces de registro de preventa que trae un artículo (plataformas conocidas o enlaces cortos de preventa). */
export function articleLinks(html: string): { url: string; label: string }[] {
  const out = new Map<string, { url: string; label: string }>();
  for (const m of html.matchAll(/<a\s[^>]*href=["']([^"']+)["']/gi)) {
    const url = cleanUrl(m[1]!.replace(/&amp;/g, "&"));
    if (!url) continue;
    const host = new URL(url).hostname.replace(/^www\./, "");
    const label = labelFor(url) ?? (SHORT.test(host) && /pre-?sale|preventa|sign-?up|register/i.test(new URL(url).pathname) ? "Registro de preventa" : null);
    // Solo registros: las fichas de venta (Ticketmaster, AXS…) y los programas de tarjeta/operadora ya los cubre la ficha.
    if (!label || /Tienda oficial|Bandsintown/.test(label)) continue;
    out.set(url, { url, label });
  }
  return [...out.values()];
}
