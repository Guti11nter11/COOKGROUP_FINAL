/** Enlaces de registro/preventa en la web oficial de un artista. Funciones puras. */
import type { SignupLink } from "@gira/core";

const HOSTS: [RegExp, string][] = [
  [/(^|\.)bandsintown\.com$/, "Bandsintown"],
  [/(^|\.)laylo\.com$/, "Laylo"],
  [/^signup\.livenation\.com$/, "Live Nation (registro)"],
  [/^signup\.ticketmaster\./, "Ticketmaster (registro)"],
  [/^verifiedfan\.ticketmaster\./, "Ticketmaster Verified Fan"],
  [/(^|\.)seated\.com$/, "Seated"],
  [/^drop\.cobrand\.com$/, "Cobrand (registro)"],
  [/(^|\.)fanlink\.(tv|to)$|(^|\.)fan\.link$/, "Registro de preventa"],
  [/(^|\.)fanclub|(^|\.)fan-club/, "Fan club"],
  [/^presale\./, "Preventa oficial"],
  // Tiendas oficiales donde comprar o reservar el disco da el código de la preventa (sobre todo Reino Unido).
  [/(^|\.)tmstor\.es$/, "Tienda oficial (código de preventa)"],
  [/(^|\.)townsendmusic\.com$/, "Tienda oficial (código de preventa)"],
  [/(^|\.)musicglue\.(com|store)$/, "Tienda oficial (código de preventa)"],
  [/(^|\.)myshopify\.com$/, "Tienda oficial"],
];
const SOCIAL = /(instagram|facebook|twitter|x\.com|tiktok|youtube|spotify|apple\.com|music\.amazon|deezer|soundcloud|threads\.net|snapchat|discord)\b/i;
const TEXT = /\b(pre-?sale|presale|sign ?up|register|registr|preventa|pr[ée]vente|vorverkauf|fan ?club|get access|early access|join the list|mailing list)\b/i;
/** En Bandsintown solo cuentan los enlaces de preventa (/t/ con release o /release), no "seguir" o "alertas". */
const BIT_OK = /bandsintown\.com\/(t\/|release)/i;
const DROP_PARAMS = /^(utm_|affil_code$|came_from$|signature$|spn$|bg-color$|border-color$|cta-|font$|text-color$|fbclid$|gclid$)/i;

export function cleanUrl(href: string): string | null {
  try {
    const u = new URL(href);
    if (u.protocol !== "https:") return null;
    for (const k of [...u.searchParams.keys()]) {
      if (/queueittoken/i.test(k)) return null; // nunca pases de cola
      if (DROP_PARAMS.test(k) || (k === "app_id" && /bandsintown\.com$/.test(u.hostname))) u.searchParams.delete(k);
    }
    return u.toString();
  } catch {
    return null;
  }
}

const fold = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const MONTHS = ["jan|ene|janv", "feb|fev|fevr", "mar|mars", "apr|abr|avr", "may|mai|mei", "jun|juin", "jul|juil", "aug|ago|aout", "sep|sept", "oct|okt", "nov", "dec|dic|dez"];

/** ¿El texto de alrededor menciona esta fecha? ("Jul. 5, 2027", "5 jul", "05/07/2027", "2027-07-05"). */
export function mentionsDate(context: string, localDate: string): boolean {
  const [y, m, d] = localDate.split("-").map(Number) as [number, number, number];
  const c = fold(context);
  const mon = MONTHS[m - 1]!;
  return (
    new RegExp(`\\b(${mon})[a-z]*\\.?\\s+0?${d}\\b`).test(c) ||
    new RegExp(`\\b0?${d}\\s+(de\\s+)?(${mon})`).test(c) ||
    c.includes(localDate) ||
    new RegExp(`\\b0?${d}[/.]0?${m}[/.](${y}|${String(y).slice(2)})\\b`).test(c)
  );
}

export interface RawLink {
  text: string;
  href: string;
  context: string;
}

/** Se queda con los enlaces de registro/preventa y los asocia a ciudad y fecha cuando el contexto lo dice. */
/** Acortadores y enlaces «inteligentes» (Linkfire, Linktree…): llevan a otra parte. */
export const SHORT = /(^|\.)(lnk\.to|ffm\.to|smarturl\.it|found\.ee|hypeddit\.com|bit\.ly|lnkfi\.re)$/;

/** Nombre de un registro según su plataforma (para un enlace corto ya resuelto). Pura. */
export function labelFor(url: string): string | null {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return HOSTS.find(([re]) => re.test(host))?.[1] ?? null;
  } catch {
    return null;
  }
}

/** Webs oficiales probables cuando MusicBrainz no la tiene («chaseatlantic.com»). Pura. */
export function homepageGuesses(name: string): string[] {
  const slug = fold(name).replace(/&/g, "and").replace(/[^a-z0-9]+/g, "");
  if (slug.length < 3) return [];
  return [`https://www.${slug}.com/`, `https://${slug}.com/`, `https://www.${slug}music.com/`, `https://www.${slug}official.com/`];
}

/** ¿El título de la página es la web del artista? (no un dominio aparcado ni una página por defecto). Pura. */
export function titleMatches(title: string, name: string): boolean {
  const t = fold(title);
  if (/for sale|parked|domain|coming soon|welcome to nginx|index of|default (web )?page/.test(t)) return false;
  const n = fold(name).replace(/[^a-z0-9]+/g, " ").trim();
  return !!n && t.replace(/[^a-z0-9]+/g, " ").includes(n);
}

export function pickSignups(raw: RawLink[], shows: { city: string; localDate: string }[], pageHost: string): SignupLink[] {
  const out = new Map<string, SignupLink>();
  for (const r of raw) {
    const url = cleanUrl(r.href);
    if (!url) continue;
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (SOCIAL.test(host)) continue;
    const known = HOSTS.find(([re]) => re.test(host));
    if (known && known[1] === "Bandsintown" && !BIT_OK.test(url)) continue;
    if (new URL(url).pathname.replace(/\/+$/, "") === "") continue; // portada de la plataforma, no un registro
    if (/\.ics$|add-to-calendar|\/calendar\//i.test(new URL(url).pathname)) continue; // archivo de calendario, no un registro
    if (/^\/(terms|privacy|cookies?|legal|help|faq|about|support|contact)(\/|$|-)/i.test(new URL(url).pathname)) continue; // páginas legales o de ayuda de la plataforma
    if (!known && !TEXT.test(`${r.text} ${new URL(url).pathname}`)) continue;
    if (!known && /ticketmaster\.|livenation\.|axs\.com|seetickets|eventim|dice\.fm/.test(host)) continue; // fichas de venta: ya las tenemos
    const ctx = fold(r.context);
    const city = shows.find((s) => s.city && ctx.includes(fold(s.city)))?.city ?? null;
    const dated = shows.filter((s) => (!city || s.city === city) && mentionsDate(r.context, s.localDate));
    // Enlaces por fecha de plataformas de giras (Bandsintown /t/, link.seated.com): solo si son de una fecha nuestra.
    if (!city && (/bandsintown\.com\/t\//.test(url) || /^link\.seated\.com$/.test(host))) continue;
    // Enlace corto (lnk.to/presale…): es el registro de la preventa, aunque no se sepa aún adónde lleva.
    const short = SHORT.test(host) && /pre-?sale|preventa|early-?access|sign-?up|register/i.test(new URL(url).pathname);
    if (SHORT.test(host) && !short) continue; // lnk.to/album, linktr.ee… sin preventa: música, no registro
    const label = known?.[1] ?? (short ? "Registro de preventa" : host === pageHost ? (r.text.replace(/\s+/g, " ").trim().slice(0, 40) || "Registro en la web oficial") : host);
    out.set(url, { url, label, city, localDate: dated.length === 1 ? dated[0]!.localDate : null });
  }
  return [...out.values()];
}

const PRESALE_WORDS = /\b(pre-?sale|presale|preventa|pr[ée]vente|vorverkauf|early access|get access|tour|tickets?|entradas|boletos|concerts?|live|sphere|stadium|estadio|arena)\b/i;
const STRONG = /\b(pre-?sale|presale|preventa|pr[ée]vente|vorverkauf|early access|get access|on ?sale)\b/i;
const MENU = /\b(shop|store|merch|videos|home)\b/i;
const NOT_PRESALE = /\b(newsletter|merch|store|shop|tienda|podcast|contest|competition|sorteo|giveaway)\b/i;

/**
 * Para artistas sin fechas todavía: solo enlaces que apuntan a una preventa o gira (plataformas de
 * registro conocidas o texto/contexto de gira), no la newsletter genérica de la web. Pura.
 */
export function presaleSignal(link: SignupLink, raw?: RawLink): boolean {
  if (outOfScope(link.url)) return false;
  const host = new URL(link.url).hostname.replace(/^www\./, "");
  const known = HOSTS.find(([re]) => re.test(host));
  if (known && known[1] !== "Bandsintown") return true;
  const text = `${raw?.text ?? link.label} ${new URL(link.url).pathname}`;
  if (NOT_PRESALE.test(text)) return false;
  // Enlaces "inteligentes" (lnk.to, linktr.ee…): casi siempre música; solo si el texto habla de preventa.
  if (/(^|\.)(lnk\.to|linktr\.ee|ffm\.to|smarturl\.it|found\.ee|hypeddit\.com)$/.test(host)) return /\b(pre-?sale|preventa|early access)\b/i.test(text);
  if (PRESALE_WORDS.test(text)) return true;
  // El texto de alrededor solo cuenta si habla de preventa o venta, o si no es el menú de la web
  // ("Home Music Videos Tour Shop Sign Up": la palabra "Tour" del menú no hace preventa a una newsletter).
  const ctx = raw?.context ?? "";
  return STRONG.test(ctx) || (PRESALE_WORDS.test(ctx) && !MENU.test(ctx));
}

/** Registros de países que GIRA no cubre (Australia, Nueva Zelanda, Asia): no sirven. Pura. */
export function outOfScope(url: string): boolean {
  const host = new URL(url).hostname;
  return /\.(com\.au|co\.nz|com\.sg|co\.jp|jp|com\.hk|co\.kr|com\.my|co\.th|com\.ph|ae)$/.test(host);
}

/** ¿El texto de la página dice que el registro ya no existe? Pura. */
export const deadPage = (text: string) =>
  /(page not found|isn['’]t on this page|no longer available|this (page|tour) (does not|doesn['’]t) exist|registration (is )?(now )?closed|404)/i.test(text);
