import { presaleGuide, type SaleKind } from "./presale";
import type { SaleWindow, Show } from "./ticketmaster";

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
  const slug = me.replace(/[^a-z0-9]+/g, "-");
  const mine = (s: Show) => fold(s.name).includes(me) || fold(s.url).includes(slug);
  const kept = shows.filter(
    (s) => !s.isPackage && !/[/-](package|packages|vip-package|hospitality)[-/]/i.test(s.url) && !(FESTIVAL_RE.test(s.name) && !fold(s.name).includes(me)),
  );
  // Misma fecha y recinto listados dos veces (p. ej. el día del festival y el concierto): se queda el del artista.
  const byDate = new Map<string, Show>();
  for (const s of kept) {
    const k = `${s.venue.tmId}|${s.localDate}`;
    const prev = byDate.get(k);
    if (!prev || (!mine(prev) && mine(s))) byDate.set(k, s);
  }
  return kept.filter((s) => byDate.get(`${s.venue.tmId}|${s.localDate}`) === s);
}

/** Promociones sobre un evento ya a la venta (no son una salida de entradas). */
export const PROMO =
  /(holiday|gift|black friday|cyber monday|day of show|promo|\boffer\b|discount|\bdeal\b|flash sale|2 ?for ?1|\bbogo\b|buy one|student|military|teacher|nurse|first responder|group sales?|upsell|add-?on|parking|merch|hotel|package|upgrade|last chance|lucky seat|ticket drop|\$\d+ tickets|value tickets|price drop)/i;

/**
 * Ventanas que sirven para conseguir entradas: preventas y venta general por llegar. Si la venta
 * general ya empezó, el evento ya está a la venta y lo que venga después (promociones, ofertas) no
 * cuenta. Tampoco la reventa oficial ni las promociones. Regla única para fichas, avisos y calendario.
 */
export function actionableSales(show: Pick<Show, "sales">, now: Date): SaleWindow[] {
  const t = now.getTime();
  if (show.sales.some((w) => w.kind === "general" && w.startsAt && Date.parse(w.startsAt) <= t)) return [];
  return show.sales.filter(
    (w) =>
      w.kind !== "official_resale" &&
      !PROMO.test(w.label) &&
      (w.kind !== "unknown" || SALE_WORDS.test(w.label)) &&
      (!w.startsAt || Date.parse(w.startsAt) > t),
  );
}
/** Una etiqueta desconocida solo cuenta si dice claramente que es una venta. */
const SALE_WORDS = /(pre-?sale|preventa|pré-?vente|vorverkauf|prevendita|on ?sale|onsale|public sale|venta|early access|verified|exclusive access|fan access|tickets? (go )?on sale)/i;

/** Una ficha está activa si alguna preventa o venta general está por llegar. */
export function isSheetActive(shows: Show[], now: Date): boolean {
  return shows.some((s) => actionableSales(s, now).length > 0);
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
  /** Lo difícil que será conseguir entrada en la venta oficial. */
  difficulty?: "baja" | "media" | "alta" | "muy alta";
  /** Mercado actual por fecha muestreada (también de otros países, para comparar). */
  markets?: { country: string; city: string; localDate: string; median: number; p25: number; p75: number; currency: string; listings: number; source: string }[];
  /** Datos de reventa de giras anteriores (prensa), con su fuente. */
  history?: { text: string; source: string }[];
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
  /** Límite de entradas por persona encontrado en prensa, por país. */
  limits?: Record<string, number>;
  /** Otras ticketeras de venta oficial del artista (SeatGeek en EE. UU…), con su página. */
  ticketers?: { name: string; url: string }[];
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
/** Otras ticketeras de venta oficial (no de reventa). */
const PRIMARY: Record<string, string> = { "seatgeek.com": "SeatGeek", "axs.com": "AXS", "seetickets.com": "See Tickets", "dice.fm": "DICE" };

function ticketerName(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return TM_DOMAINS[host] ? `Ticketmaster ${TM_DOMAINS[host]}` : PRIMARY[host] ?? host;
  } catch {
    return "Ficha oficial";
  }
}

const dayFmt = new Intl.DateTimeFormat("es-ES", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short", year: "numeric" });
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

/** Preventas que se abren con un enlace único enviado al registrado (no con la página del evento). */
const UNIQUE_LINK = new Set<SaleKind>(["fanclub", "artist", "registration", "lottery", "unknown"]);
/** A partir de cuántas fechas la ficha usa el formato compacto. */
const COMPACT_FROM = 8;
const ARTIST_KINDS = new Set<SaleKind>(["artist", "fanclub", "registration", "unknown", "lottery"]);
const linkDay = (d: string) => clean(new Intl.DateTimeFormat("es-ES", { timeZone: "UTC", day: "numeric", month: "short" }).format(new Date(`${d}T12:00:00Z`)));
const ts = (iso: string, style = "F") => `<t:${Math.floor(Date.parse(iso) / 1000)}:${style}>`;

/** Nombre del país en mayúsculas para el bloque de precios. */
const COUNTRY: Record<string, string> = {
  ES: "ESPAÑA", GB: "REINO UNIDO", IE: "IRLANDA", FR: "FRANCIA", DE: "ALEMANIA", IT: "ITALIA", NL: "PAÍSES BAJOS", BE: "BÉLGICA",
  AT: "AUSTRIA", CH: "SUIZA", DK: "DINAMARCA", SE: "SUECIA", NO: "NORUEGA", FI: "FINLANDIA", PL: "POLONIA", CZ: "CHEQUIA",
  PT: "PORTUGAL", TR: "TURQUÍA", GR: "GRECIA", HU: "HUNGRÍA", US: "EE. UU.", CA: "CANADÁ", MX: "MÉXICO", BR: "BRASIL",
  AR: "ARGENTINA", CL: "CHILE", CO: "COLOMBIA", PE: "PERÚ", UY: "URUGUAY", EC: "ECUADOR", CR: "COSTA RICA", PA: "PANAMÁ",
  GT: "GUATEMALA", PR: "PUERTO RICO", DO: "REP. DOMINICANA", AU: "AUSTRALIA", NZ: "NUEVA ZELANDA", JP: "JAPÓN", KR: "COREA DEL SUR",
};
export const countryName = (cc: string) => COUNTRY[cc] ?? cc;

/**
 * Límite de entradas por persona: de la ticketera (por fecha) y, si no, de prensa (por país). Un país sin
 * dato toma el de la misma gira en otro país (suele ser el mismo en toda la gira).
 */
function limitText(live: Show[], limits: Record<string, number>): string | null {
  const byCountry = new Map<string, number>();
  for (const cc of new Set(live.map((s) => s.venue.country))) {
    const n = ticketLimitNumber(live.filter((s) => s.venue.country === cc).map((s) => s.ticketLimit)) ?? limits[cc] ?? null;
    if (n) byCountry.set(cc, n);
  }
  const fallback = mostCommon([...byCountry.values(), ...Object.values(limits)]);
  if (fallback) for (const cc of new Set(live.map((s) => s.venue.country))) if (!byCountry.has(cc)) byCountry.set(cc, fallback);
  const values = [...new Set(byCountry.values())];
  if (!values.length) return null;
  if (values.length === 1) return `**${values[0]}** por persona`;
  return [...byCountry].map(([cc, n]) => `${flag(cc)} **${n}**`).join(" · ") + " por persona";
}

export interface CountryPrices {
  country: string;
  name: string;
  currency: string;
  /** Zonas de la fecha con más detalle (en un país todas las ciudades tienen la misma tabla). */
  zones: { name: string; price: number }[];
  min: number;
  max: number;
}

/** Precios oficiales agrupados por país (sin fuentes). Lo usan el texto de la ficha y la imagen. */
export function pricesByCountry(entries: { country: string; min: number; max: number; currency: string; zones?: { name: string; price: number }[] }[]): CountryPrices[] {
  const byCountry = new Map<string, typeof entries>();
  for (const e of entries) byCountry.set(e.country, [...(byCountry.get(e.country) ?? []), e]);
  return [...byCountry].map(([cc, ps]) => {
    const zoned = [...ps].filter((p) => p.zones?.length).sort((a, b) => b.zones!.length - a.zones!.length)[0];
    const cur = zoned?.currency ?? ps[0]!.currency;
    const same = ps.filter((p) => p.currency === cur);
    const seen = new Set<string>();
    const zones = (zoned?.zones ?? []).filter((z) => !seen.has(z.name.toLowerCase()) && seen.add(z.name.toLowerCase()));
    return { country: cc, name: countryName(cc), currency: cur, zones, min: Math.min(...same.map((p) => p.min)), max: Math.max(...same.map((p) => p.max)) };
  });
}

/** Mensaje "💶 Precios oficiales": un bloque por país con sus zonas o, si no hay zonas, el rango. */
export function renderPrices(live: Show[], prices: Record<string, PriceInfo>): string | null {
  const rows = pricesByCountry(live.filter((s) => prices[s.sourceId]).map((s) => ({ ...prices[s.sourceId]!, country: s.venue.country })));
  if (!rows.length) return null;
  const parts = rows.map((c) =>
    c.zones.length
      ? [`${flag(c.country)} **${c.name}**`, ...c.zones.map((z) => `• ${z.name} · **${money(z.price, c.currency)}**`)].join("\n")
      : `${flag(c.country)} **${c.name}:** ${c.min === c.max ? `**${money(c.min, c.currency)}**` : `**${money(c.min, c.currency)}** – **${money(c.max, c.currency)}**`}`,
  );
  return ["## 💶 Precios oficiales", ...parts].join("\n\n");
}

/** Cómo entrar en una preventa: programa conocido, enlace propio o registro del artista. Una línea. */
function howToJoin(w: SaleWindow, ss: Show[], extras: SheetExtras): string {
  const parts: string[] = [];
  const guide = presaleGuide(w.label, ss[0]?.venue.country);
  if (guide) parts.push(`${guide.how}${guide.url ? ` **[AQUÍ](${guide.url})**` : ""}`);
  if (w.url) parts.push(`[enlace de la preventa](${w.url})`);
  if (!guide && ARTIST_KINDS.has(w.kind)) {
    const cities = new Set(ss.map((s) => fold(s.venue.city)));
    const dates = new Set(ss.map((s) => s.localDate));
    const all = extras.signups ?? [];
    const specific = all.filter((l) => (l.localDate && dates.has(l.localDate)) || (l.city && cities.has(fold(l.city))));
    const generic = all.filter((l) => !l.localDate && !l.city);
    const links = (specific.length ? specific : generic).slice(0, 6);
    if (links.length === 1) parts.push(`Registro **[AQUÍ](${links[0]!.url})**`);
    else if (links.length) parts.push(`Registro: ${links.map((l) => `[${l.label}${l.city ? ` · ${l.city}` : ""}${l.localDate ? ` ${linkDay(l.localDate)}` : ""}](${l.url})`).join(" · ")}`);
    else parts.push(`registro aún no localizado${extras.homepage ? ` — mira la [web oficial](${extras.homepage})` : " (GIRA lo sigue buscando)"}`);
  }
  if (!parts.length) parts.push(REQUIREMENT[w.kind]);
  return parts.join(" · ");
}

/** Empaqueta cada sección por separado: precios, sign up y ventas nunca comparten mensaje. */
const sections = (...xs: (string | string[] | null)[]) => xs.flatMap((x) => (x === null ? [] : pack(Array.isArray(x) ? x : [x])));

/**
 * Ficha de un artista para su canal (estilo Akari, más limpia). Mensajes separados: cabecera,
 * precios oficiales por país, sign up (cómo entrar en cada preventa) y un bloque por preventa y hora
 * con sus fechas. Solo ventas por llegar; la hora es la marca de Discord (cada uno la ve en su zona).
 */
export function renderArtistSheet(artist: { name: string; tier?: number }, shows: Show[], now: Date, extras: SheetExtras = {}): string[] {
  // Solo las fechas con alguna preventa o venta general por llegar: lo demás ya no es accionable.
  const live = sheetShows(artist.name, shows)
    .filter((s) => actionableSales(s, now).length > 0)
    .sort((a, b) => a.localDate.localeCompare(b.localDate));
  const tour = mostCommon(live.map((s) => s.name.replace(/\s*\|.*$/, "").trim())) ?? artist.name;
  const title = fold(tour).startsWith(fold(artist.name)) ? tour.slice(artist.name.length).replace(/^\s*[-–:]\s*/, "") || tour : tour;
  const countries = [...new Map(live.map((s) => [s.venue.country, flag(s.venue.country)])).values()];
  const limit = limitText(live, extras.limits ?? {});
  // Página del artista en cada ticketera, solo si es de verdad la suya (no la del festival en que actúa).
  const artistSlug = fold(artist.name).replace(/[^a-z0-9]+/g, "-");
  const official = [
    ...new Map(live.filter((s) => s.artistUrl && fold(s.artistUrl).includes(artistSlug)).map((s) => [ticketerName(s.artistUrl!), s.artistUrl!])).entries(),
  ];
  const venues = extras.venues ?? {};
  const capacity = (s: Show) => venues[s.venue.tmId]?.capacity ?? null;
  const r = extras.resale;
  const q = encodeURIComponent(artist.name);
  const stars = artist.tier ? ` ${"⭐".repeat(Math.min(3, artist.tier))}` : "";

  const head = [
    `${fold(title) === fold(artist.name) ? `# 🎤 ${artist.name}` : `# 🎤 ${artist.name} — ${title}`}${stars}`,
    `${countries.join(" ")} · ${live.length} ${live.length === 1 ? "fecha" : "fechas"}`,
    "",
    `**Límite de entradas:** ${limit ?? "sin confirmar todavía"}`,
    ...(r?.difficulty ? [`**Dificultad para conseguir entrada:** ${r.difficulty}`] : []),
    ...(r ? [`**Reventa estimada:** ${times(r.low)}–${times(r.high)} sobre el oficial`] : []),
    `**Reventa (para comparar):** [Viagogo](https://www.viagogo.com/secure/search?q=${q}) · [StubHub](https://www.stubhub.com/secure/search?q=${q}) · [Vivid Seats](https://www.vividseats.com/search?searchTerm=${q})`,
    ...(official.length || extras.homepage || extras.ticketers?.length
      ? ["", "**Enlaces oficiales**", [...(extras.homepage ? [`[Web oficial](${extras.homepage})`] : []), ...official.map(([n, u]) => `[${n}](${u})`), ...(extras.ticketers ?? []).map((t) => `[${t.name}](${t.url})`)].join(" · ")]
      : []),
  ].join("\n");

  const dateLine = (s: Show) => {
    const cap = capacity(s);
    return `${flag(s.venue.country)} [${s.venue.city} · ${showDay(s.localDate)}](${s.url}) · ${s.venue.name}${cap ? ` (${num(cap)})` : ""}`;
  };

  // Agrupar ventanas futuras por etiqueta + hora (una venta UK a otra hora va en su propio bloque).
  const groups = new Map<string, { w: SaleWindow; shows: Show[] }>();
  for (const s of live) {
    for (const w of actionableSales(s, now)) {
      const k = `${w.label.toLowerCase()}|${w.startsAt ?? ""}`;
      const g = groups.get(k) ?? { w, shows: [] };
      if (!g.shows.includes(s)) g.shows.push(s);
      groups.set(k, g);
    }
  }
  const ordered = [...groups.values()].sort(
    (a, b) => (a.w.startsAt ?? "9999").localeCompare(b.w.startsAt ?? "9999") || a.w.orderRank - b.w.orderRank,
  );

  // Sign up: una línea por preventa (no la venta general), con todas sus fechas para elegir el registro.
  const byLabel = new Map<string, { w: SaleWindow; shows: Show[] }>();
  for (const { w, shows: ss } of ordered) {
    if (w.kind === "general" || w.kind === "official_resale") continue;
    const k = w.label.toLowerCase();
    const g = byLabel.get(k) ?? { w, shows: [] };
    for (const s of ss) if (!g.shows.includes(s)) g.shows.push(s);
    if (!g.w.url && w.url) g.w = w;
    byLabel.set(k, g);
  }
  const signup = byLabel.size
    ? ["## 📝 Sign up · cómo entrar en cada preventa", ...[...byLabel.values()].map(({ w, shows: ss }) => `**${w.label}** → ${howToJoin(w, ss, extras)}`)].join("\n")
    : null;

  // Giras largas (típicas de EE. UU.): las fechas con enlace y recinto van una sola vez en su propio
  // mensaje y cada venta las cita en corto (ciudad y día, por país); si no, la ficha serían 10+ mensajes.
  const compact = live.length > COMPACT_FROM;
  const shortDates = (ss: Show[]) =>
    [...new Set(ss.map((s) => s.venue.country))]
      .map((cc) => `${flag(cc)} ${ss.filter((s) => s.venue.country === cc).map((s) => `${s.venue.city} ${linkDay(s.localDate)}`).join(" · ")}`)
      .join("\n");
  const datesMsg = compact ? [`## 📍 Fechas (${live.length})`, ...live.map(dateLine)].join("\n") : null;
  // Cómo se entra en cada venta: las preventas de fan club, artista o registro van por un enlace único
  // que llega por email/SMS (la página del evento no sirve); las de tarjeta, operadora o promotora se
  // abren en la página del evento con el código; la venta general, en la página del evento.
  const plainLine = (s: Show) => {
    const cap = capacity(s);
    return `${flag(s.venue.country)} ${s.venue.city} · ${showDay(s.localDate)} · ${s.venue.name}${cap ? ` (${num(cap)})` : ""}`;
  };
  const blocks = ordered.map(({ w, shows: ss }) => {
    const when = w.startsAt ? `🕙 ${ts(w.startsAt)}` : "📅 Fecha y hora por confirmar";
    const unique = UNIQUE_LINK.has(w.kind);
    const how =
      w.kind === "general"
        ? []
        : unique
          ? [`🔑 Enlace único: llega por email o SMS a quien se registró (ver Sign up)${w.url ? ` · [enlace de la preventa](${w.url})` : ""}`]
          : [`🔢 Se entra en la página del evento con el código o la tarjeta${w.url ? ` · [condiciones](${w.url})` : ""}`];
    const dates = compact ? [shortDates(ss)] : ss.map(unique ? plainLine : dateLine);
    // Solo el momento de salida (decisión del propietario: nunca "hasta").
    return [`## 🎟️ ${w.label}`, when, ...how, ...dates].join("\n");
  });
  return sections(head, renderPrices(live, extras.prices ?? {}), signup, datesMsg, [...blocks, `-# Actualizado <t:${Math.floor(now.getTime() / 1000)}:R> · GIRA · solo información, compras tú`]);
}
