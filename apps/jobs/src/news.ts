/**
 * Búsqueda de noticias por RSS (uso personal): Bing News (enlaces directos a la fuente) y Google
 * News (más cobertura). Solo lectura de titulares y artículos públicos, con pausas.
 */
import { UA } from "./gira-client";

export interface NewsItem {
  title: string;
  link: string;
  description: string;
  pubDate: string | null;
  source: string;
}

const decode = (t: string) =>
  t
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
const tag = (xml: string, name: string) => {
  const m = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i").exec(xml);
  return m ? decode(m[1]!).trim() : "";
};
export const stripHtml = (html: string) =>
  decode(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();

/** Enlace real de un resultado de Bing (viene envuelto en apiclick.aspx?url=…). */
export function unwrapBing(link: string): string {
  try {
    const u = new URL(link);
    return u.searchParams.get("url") ?? link;
  } catch {
    return link;
  }
}

export function parseRss(xml: string): NewsItem[] {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(([, it]) => {
    const link = unwrapBing(tag(it!, "link"));
    let source = tag(it!, "source") || tag(it!, "News:Source");
    if (!source) {
      try {
        source = new URL(link).hostname.replace(/^www\./, "");
      } catch {
        source = "";
      }
    }
    return { title: stripHtml(tag(it!, "title")), link, description: stripHtml(tag(it!, "description")), pubDate: tag(it!, "pubDate") || null, source };
  });
}

const LOCALE: Record<string, { hl: string; gl: string; bing: string }> = {
  ES: { hl: "es", gl: "ES", bing: "es-ES" },
  GB: { hl: "en-GB", gl: "GB", bing: "en-GB" },
  IE: { hl: "en-IE", gl: "IE", bing: "en-IE" },
  FR: { hl: "fr", gl: "FR", bing: "fr-FR" },
  DE: { hl: "de", gl: "DE", bing: "de-DE" },
  IT: { hl: "it", gl: "IT", bing: "it-IT" },
  NL: { hl: "nl", gl: "NL", bing: "nl-NL" },
  PT: { hl: "pt-PT", gl: "PT", bing: "pt-PT" },
  US: { hl: "en-US", gl: "US", bing: "en-US" },
  MX: { hl: "es-419", gl: "MX", bing: "es-MX" },
  AR: { hl: "es-419", gl: "AR", bing: "es-AR" },
  CL: { hl: "es-419", gl: "CL", bing: "es-CL" },
  CO: { hl: "es-419", gl: "CO", bing: "es-CO" },
  PE: { hl: "es-419", gl: "PE", bing: "es-PE" },
  BR: { hl: "pt-BR", gl: "BR", bing: "pt-BR" },
};

async function get(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/rss+xml, text/xml, text/html" }, signal: AbortSignal.timeout(20000) });
    return res.ok ? await res.text() : null;
  } catch {
    return null; // conexión cortada o lenta: se ignora esa fuente
  }
}

export async function searchNews(q: string, country = "ES"): Promise<NewsItem[]> {
  const loc = LOCALE[country] ?? LOCALE.GB!;
  const [bing, google] = await Promise.all([
    get(`https://www.bing.com/news/search?q=${encodeURIComponent(q)}&format=rss&mkt=${loc.bing}`),
    get(`https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=${loc.hl}&gl=${loc.gl}&ceid=${loc.gl}:${loc.hl.split("-")[0]}`),
  ]);
  const items = [...parseRss(bing ?? ""), ...parseRss(google ?? "")];
  const seen = new Set<string>();
  return items.filter((i) => {
    const k = i.title.toLowerCase().slice(0, 80);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Texto de un artículo (solo si el enlace es directo a la fuente). */
export async function articleText(link: string): Promise<string | null> {
  if (/news\.google\.com/.test(link)) return null;
  const html = await get(link);
  return html ? stripHtml(html) : null;
}
