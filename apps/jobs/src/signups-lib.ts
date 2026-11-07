/** Enlaces de registro/preventa en la web oficial de un artista. Funciones puras. */
import type { SignupLink } from "@gira/core";

const HOSTS: [RegExp, string][] = [
  [/(^|\.)bandsintown\.com$/, "Bandsintown"],
  [/(^|\.)laylo\.com$/, "Laylo"],
  [/^signup\.livenation\.com$/, "Live Nation (registro)"],
  [/^signup\.ticketmaster\./, "Ticketmaster (registro)"],
  [/^verifiedfan\.ticketmaster\./, "Ticketmaster Verified Fan"],
  [/(^|\.)seated\.com$/, "Seated"],
  [/(^|\.)fanclub|(^|\.)fan-club/, "Fan club"],
  [/^presale\./, "Preventa oficial"],
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
    if (!known && !TEXT.test(`${r.text} ${new URL(url).pathname}`)) continue;
    if (!known && /ticketmaster\.|livenation\.|axs\.com|seetickets|eventim|dice\.fm/.test(host)) continue; // fichas de venta: ya las tenemos
    const ctx = fold(r.context);
    const city = shows.find((s) => s.city && ctx.includes(fold(s.city)))?.city ?? null;
    const dated = shows.filter((s) => (!city || s.city === city) && mentionsDate(r.context, s.localDate));
    // Enlaces por fecha de plataformas de giras (Bandsintown /t/, link.seated.com): solo si son de una fecha nuestra.
    if (!city && (/bandsintown\.com\/t\//.test(url) || /^link\.seated\.com$/.test(host))) continue;
    const label = known?.[1] ?? (host === pageHost ? (r.text.trim().slice(0, 40) || "Registro en la web oficial") : host);
    out.set(url, { url, label, city, localDate: dated.length === 1 ? dated[0]!.localDate : null });
  }
  return [...out.values()];
}
