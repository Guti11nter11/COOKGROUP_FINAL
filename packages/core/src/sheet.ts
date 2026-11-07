import { presaleGuide, type SaleKind } from "./presale";
import type { SaleWindow, Show } from "./ticketmaster";
import { formatHHmm, LONDON, MADRID } from "./time";

/** Nombre de canal de Discord para una entidad: "Guns N' Roses" → "guns-n-roses". */
export function channelSlug(name: string): string {
  return (
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 90) || "artista"
  );
}

/** Bandera de un código de país ISO ("ES" → 🇪🇸). */
export function flag(cc: string): string {
  if (!/^[A-Z]{2}$/.test(cc)) return "🏳️";
  return String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

/** Número de entradas por persona más repetido en los textos de límite. */
export function ticketLimitNumber(texts: (string | null | undefined)[]): number | null {
  const counts = new Map<number, number>();
  for (const t of texts) {
    const m = t ? /(\d{1,2})\s*(tickets?|entradas|billets|biglietti|biljetter|billetter|karten|tickets)/i.exec(t) ?? /(?:max(?:imum)? of|l[ií]mite de|m[aá]ximo de)\s*(\d{1,2})/i.exec(t) : null;
    const n = m ? Number(m[1]) : NaN;
    if (n > 0) counts.set(n, (counts.get(n) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? null;
}

const FESTIVAL_RE = /\b(festival|fest|weekend|day pass|\d[- ]?day|tagesticket|dagsbillett|dagbillett|abono|pase de \d|camping)\b/i;
const fold = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/**
 * Fechas que pertenecen a la ficha de un artista: sin variantes (VIP, hotel, parking…) ni listados de
 * festivales ajenos en los que solo actúa (esos van en la ficha del festival).
 */
export function sheetShows(artistName: string, shows: Show[]): Show[] {
  const me = fold(artistName);
  return shows.filter((s) => !s.isPackage && !(FESTIVAL_RE.test(s.name) && !fold(s.name).includes(me)));
}

/** Ventana que importa para conseguir entradas: futura y que no sea reventa. */
const upcoming = (w: SaleWindow, now: Date) => w.kind !== "official_resale" && (!w.startsAt || Date.parse(w.startsAt) > now.getTime());

/** Una ficha está activa si alguna preventa o venta general está por llegar. */
export function isSheetActive(shows: Show[], now: Date): boolean {
  return shows.some((s) => s.sales.some((w) => upcoming(w, now)));
}

/** Datos de enriquecimiento de una ficha (cada uno con su fuente). */
export interface VenueInfo {
  capacity: number | null;
}
export interface PriceInfo {
  min: number;
  max: number;
  currency: string;
  source: string;
  /** Precio por zona, si la fuente lo publica. */
  zones?: { name: string; price: number }[];
}
export interface ResaleInfo {
  /** Multiplicador estimado sobre el precio oficial. */
  low: number;
  high: number;
  confidence: "baja" | "media" | "alta";
  basis: string;
  market?: { median: number; p25: number; p75: number; currency: string; listings: number; source: string };
}
/** Enlace de registro/preventa encontrado en la web oficial del artista (Bandsintown, Laylo, Live Nation…). */
export interface SignupLink {
  url: string;
  label: string;
  city?: string | null;
  localDate?: string | null;
}
export interface SheetExtras {
  /** Enlaces de registro de la web oficial y la propia web. */
  signups?: SignupLink[];
  homepage?: string | null;
  /** Por id de recinto de Ticketmaster. */
  venues?: Record<string, VenueInfo>;
  /** Por id de evento (sourceId). */
  prices?: Record<string, PriceInfo>;
  resale?: ResaleInfo | null;
}

const REQUIREMENT: Record<SaleKind, string> = {
  fanclub: "Membresía del fan club (normalmente de pago)",
  artist: "Registro o código del artista (email de la web oficial)",
  card: "Pagar con la tarjeta indicada",
  telco: "Cliente de la operadora (app o código)",
  platform: "Código enviado por la plataforma (Spotify, PayPal…)",
  promoter: "Registro en la promotora (Live Nation, etc.)",
  ticketer: "Cuenta y registro en la ticketera",
  venue: "Registro o newsletter del recinto",
  registration: "Registro previo (no es compra)",
  lottery: "Sorteo: inscribirse antes de la fecha límite",
  general: "Abierta a todos",
  official_resale: "Reventa oficial",
  unknown: "Ver condiciones en la ficha oficial",
};

const TM_DOMAINS: Record<string, string> = {
  "ticketmaster.es": "ES", "ticketmaster.co.uk": "UK", "ticketmaster.ie": "IE", "ticketmaster.fr": "FR", "ticketmaster.de": "DE",
  "ticketmaster.it": "IT", "ticketmaster.nl": "NL", "ticketmaster.be": "BE", "ticketmaster.at": "AT", "ticketmaster.ch": "CH",
  "ticketmaster.dk": "DK", "ticketmaster.se": "SE", "ticketmaster.no": "NO", "ticketmaster.fi": "FI", "ticketmaster.pl": "PL",
  "ticketmaster.cz": "CZ", "ticketmaster.com": "US", "ticketmaster.com.mx": "MX",
};

function ticketerName(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return TM_DOMAINS[host] ? `Ticketmaster ${TM_DOMAINS[host]}` : host;
  } catch {
    return "Ficha oficial";
  }
}

const dayFmt = new Intl.DateTimeFormat("es-ES", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short", year: "numeric" });
const saleDayFmt = new Intl.DateTimeFormat("es-ES", { timeZone: MADRID, weekday: "short", day: "numeric", month: "short" });
const clean = (s: string) => s.replace(/\./g, "").replace(/,/g, "").replace(/\s+/g, " ").trim();
const showDay = (localDate: string) => clean(dayFmt.format(new Date(`${localDate}T12:00:00Z`)));

function mostCommon<T>(xs: T[]): T | undefined {
  const c = new Map<T, number>();
  for (const x of xs) c.set(x, (c.get(x) ?? 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

/** Empaqueta bloques de texto en mensajes de Discord de como mucho `max` caracteres. */
function pack(blocks: string[], max = 1900): string[] {
  const out: string[] = [];
  let cur = "";
  for (const block of blocks) {
    const lines = block.length > max ? block.split("\n") : [block];
    for (const piece of lines) {
      const add = cur ? `\n\n${piece}` : piece;
      if (cur && cur.length + add.length > max) {
        out.push(cur);
        cur = piece;
      } else cur += add;
    }
  }
  if (cur) out.push(cur);
  return out;
}

const CURRENCY: Record<string, string> = { EUR: "€", GBP: "£", USD: "$", CHF: "CHF", SEK: "kr", NOK: "kr", DKK: "kr", PLN: "zł", CZK: "Kč" };
const num = (n: number) => {
  const [int, dec] = (Number.isInteger(n) ? String(n) : n.toFixed(2)).split(".");
  return int!.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + (dec ? `,${dec}` : "");
};
export function money(n: number, currency: string): string {
  const sym = CURRENCY[currency] ?? currency;
  return currency === "GBP" || currency === "USD" ? `${sym}${num(n)}` : `${num(n)} ${sym}`;
}
const times = (n: number) => `×${n.toFixed(1).replace(".", ",")}`;

/** "45–250 €" por país, a partir de los precios por fecha. */
function priceLine(live: Show[], prices: Record<string, PriceInfo>): string | null {
  const byCountry = new Map<string, { min: number; max: number; currency: string }>();
  for (const s of live) {
    const p = prices[s.sourceId];
    if (!p) continue;
    const c = byCountry.get(s.venue.country);
    if (!c) byCountry.set(s.venue.country, { min: p.min, max: p.max, currency: p.currency });
    else if (c.currency === p.currency) byCountry.set(s.venue.country, { ...c, min: Math.min(c.min, p.min), max: Math.max(c.max, p.max) });
  }
  if (!byCountry.size) return null;
  return [...byCountry]
    .map(([cc, p]) => `${flag(cc)} ${p.min === p.max ? money(p.min, p.currency) : `${money(p.min, p.currency).replace(/ \S+$/, "")}–${money(p.max, p.currency)}`}`)
    .join(" · ");
}

const ARTIST_KINDS = new Set<SaleKind>(["artist", "fanclub", "registration", "unknown", "lottery"]);
const linkDay = (d: string) => clean(new Intl.DateTimeFormat("es-ES", { timeZone: "UTC", day: "numeric", month: "short" }).format(new Date(`${d}T12:00:00Z`)));

/** Dónde registrarse o cómo entrar en una preventa: enlace propio, programa conocido o registro del artista. */
function howToJoin(w: SaleWindow, ss: Show[], extras: SheetExtras): string[] {
  const lines: string[] = [];
  const guide = presaleGuide(w.label, ss[0]?.venue.country);
  if (guide) lines.push(`📝 ${guide.how}${guide.url ? ` → [web oficial](${guide.url})` : ""}`);
  if (w.url) lines.push(`🔗 [Enlace de esta preventa](${w.url})`);
  if (!guide && ARTIST_KINDS.has(w.kind)) {
    const fold2 = (t: string) => fold(t);
    const cities = new Set(ss.map((s) => fold2(s.venue.city)));
    const dates = new Set(ss.map((s) => s.localDate));
    const all = extras.signups ?? [];
    const specific = all.filter((l) => (l.localDate && dates.has(l.localDate)) || (l.city && cities.has(fold2(l.city))));
    const generic = all.filter((l) => !l.localDate && !l.city);
    const links = (specific.length ? specific : generic).slice(0, 6);
    if (links.length) {
      lines.push(
        `📝 **Registro:** ${links
          .map((l) => `[${l.label}${l.city ? ` · ${l.city}` : ""}${l.localDate ? ` ${linkDay(l.localDate)}` : ""}](${l.url})`)
          .join(" · ")}`,
      );
    } else {
      lines.push(`📝 **Registro:** aún no localizado${extras.homepage ? ` — mira la [web oficial](${extras.homepage})` : " — GIRA lo sigue buscando"}`);
    }
  }
  return lines;
}

/**
 * Ficha de un artista para su canal (estilo Akari, más clara): cabecera con datos y enlaces, y un
 * bloque por preventa y hora con todas sus fechas y enlaces juntos. Solo ventas por llegar.
 */
export function renderArtistSheet(artist: { name: string }, shows: Show[], now: Date, extras: SheetExtras = {}): string[] {
  // Solo las fechas con alguna preventa o venta general por llegar: lo demás ya no es accionable.
  const live = sheetShows(artist.name, shows)
    .filter((s) => s.sales.some((w) => upcoming(w, now)))
    .sort((a, b) => a.localDate.localeCompare(b.localDate));
  const tour = mostCommon(live.map((s) => s.name.replace(/\s*\|.*$/, "").trim())) ?? artist.name;
  const title = fold(tour).startsWith(fold(artist.name)) ? tour.slice(artist.name.length).replace(/^\s*[-–:]\s*/, "") || tour : tour;
  const countries = [...new Map(live.map((s) => [s.venue.country, flag(s.venue.country)])).values()];
  const limit = ticketLimitNumber(live.map((s) => s.ticketLimit));
  const official = [...new Map(live.filter((s) => s.artistUrl).map((s) => [ticketerName(s.artistUrl!), s.artistUrl!])).entries()];
  const venues = extras.venues ?? {};
  const capacity = (s: Show) => venues[s.venue.tmId]?.capacity ?? null;
  const known = live.filter((s) => capacity(s));
  const total = known.reduce((n, s) => n + capacity(s)!, 0);
  const prices = priceLine(live, extras.prices ?? {});
  const r = extras.resale;
  const q = encodeURIComponent(artist.name);

  const head = [
    `# 🎤 ${artist.name} — ${title}`,
    `${countries.join(" ")} · ${live.length} ${live.length === 1 ? "fecha" : "fechas"} en Europa`,
    "",
    `**Límite de entradas:** ${limit ? `${limit} por persona` : "sin confirmar"}`,
    `**Precios oficiales:** ${prices ?? "aún sin publicar"}`,
    ...(known.length
      ? [`**Aforo:** ~${num(total)} entradas en ${known.length === live.length ? "total" : `${known.length} de ${live.length} fechas`} (aforo de cada recinto abajo)`]
      : []),
    ...(r
      ? [
          `**Reventa estimada:** ${times(r.low)}–${times(r.high)} sobre el oficial · confianza ${r.confidence}`,
          `-# ${r.basis}`,
          ...(r.market
            ? [`**Mercado ahora (${r.market.source}):** mediana ${money(r.market.median, r.market.currency)} · P25–P75 ${money(r.market.p25, r.market.currency)}–${money(r.market.p75, r.market.currency)} · ${r.market.listings} anuncios`]
            : []),
        ]
      : []),
    `**Reventa (para comparar):** [Viagogo](https://www.viagogo.com/secure/search?q=${q}) · [StubHub](https://www.stubhub.com/secure/search?q=${q}) · [Vivid Seats](https://www.vividseats.com/search?searchTerm=${q})`,
    ...(official.length || extras.homepage
      ? ["", "**Enlaces oficiales**", [...(extras.homepage ? [`[Web oficial](${extras.homepage})`] : []), ...official.map(([n, u]) => `[${n}](${u})`)].join(" · ")]
      : []),
  ].join("\n");

  // Precios por zona: una línea por grupo de ciudades con la misma tabla.
  const zoneGroups = new Map<string, { cities: string[]; flagCc: string; zones: string; source: string }>();
  for (const s of live) {
    const p = extras.prices?.[s.sourceId];
    if (!p?.zones?.length) continue;
    const zones = p.zones.map((z) => `${z.name} **${money(z.price, p.currency)}**`).join(" · ");
    const g = zoneGroups.get(zones) ?? { cities: [], flagCc: s.venue.country, zones, source: p.source };
    if (!g.cities.includes(s.venue.city)) g.cities.push(s.venue.city);
    zoneGroups.set(zones, g);
  }
  const zoneBlock = zoneGroups.size
    ? [
        "## 💶 Precios por zona",
        ...[...zoneGroups.values()].map((g) => `${flag(g.flagCc)} **${g.cities.join(" · ")}:** ${g.zones}\n-# Fuente: ${g.source}`),
      ].join("\n")
    : null;

  const dateLine = (s: Show) => {
    const cap = capacity(s);
    return `${flag(s.venue.country)} [${s.venue.city} · ${showDay(s.localDate)}](${s.url}) · ${s.venue.name}${cap ? ` (${num(cap)})` : ""}`;
  };

  // Agrupar ventanas futuras por etiqueta + hora (una venta UK a otra hora va en su propio bloque).
  const groups = new Map<string, { w: SaleWindow; shows: Show[] }>();
  for (const s of live) {
    for (const w of s.sales) {
      if (!upcoming(w, now)) continue;
      const k = `${w.label.toLowerCase()}|${w.startsAt ?? ""}`;
      const g = groups.get(k) ?? { w, shows: [] };
      if (!g.shows.includes(s)) g.shows.push(s);
      groups.set(k, g);
    }
  }
  const ordered = [...groups.values()].sort(
    (a, b) => (a.w.startsAt ?? "9999").localeCompare(b.w.startsAt ?? "9999") || a.w.orderRank - b.w.orderRank,
  );
  const blocks = ordered.map(({ w, shows: ss }) => {
    const when = w.startsAt
      ? `🇪🇸 **${clean(saleDayFmt.format(new Date(w.startsAt)))}, ${formatHHmm(w.startsAt, MADRID)}** Madrid · 🇬🇧 ${formatHHmm(w.startsAt, LONDON)} Londres · <t:${Date.parse(w.startsAt) / 1000}:F>`
      : "Hora por confirmar";
    return [`## 🎟️ ${w.label}`, when, `*${REQUIREMENT[w.kind]}*`, ...howToJoin(w, ss, extras), ...ss.map(dateLine)].join("\n");
  });
  return pack([head, ...(zoneBlock ? [zoneBlock] : []), ...blocks, `-# Actualizado <t:${Math.floor(now.getTime() / 1000)}:R> · GIRA · solo información, compras tú`]);
}
