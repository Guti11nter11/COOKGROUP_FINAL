import type { SaleKind } from "./presale";
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

/** Una ficha está activa si alguna venta está por llegar (o sin hora confirmada). */
export function isSheetActive(shows: Show[], now: Date): boolean {
  return shows.some((s) => s.sales.some((w) => !w.startsAt || Date.parse(w.startsAt) > now.getTime()));
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
const millions = (n: number) => `${(n / 1_000_000).toFixed(1).replace(".", ",")} M`;

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

/**
 * Ficha de un artista para su canal (estilo Akari, más clara): cabecera con datos y enlaces, y un
 * bloque por preventa y hora con todas sus fechas y enlaces juntos. Solo ventas futuras.
 */
export function renderArtistSheet(artist: { name: string; deezerFans?: number | null }, shows: Show[], now: Date): string[] {
  const live = shows.filter((s) => !s.isPackage).sort((a, b) => a.localDate.localeCompare(b.localDate));
  const tour = mostCommon(live.map((s) => s.name.replace(/\s*\|.*$/, "").trim())) ?? artist.name;
  const title = tour.toLowerCase().startsWith(artist.name.toLowerCase()) ? tour.replace(/^[^-–:]*[-–:]\s*/, "") : tour;
  const countries = [...new Map(live.map((s) => [s.venue.country, flag(s.venue.country)])).values()];
  const limit = ticketLimitNumber(live.map((s) => s.ticketLimit));
  const official = [...new Map(live.filter((s) => s.artistUrl).map((s) => [ticketerName(s.artistUrl!), s.artistUrl!])).entries()];
  const q = encodeURIComponent(artist.name);

  const head = [
    `# 🎤 ${artist.name} — ${title}`,
    `${countries.join(" ")} · ${live.length} ${live.length === 1 ? "fecha" : "fechas"} en Europa`,
    "",
    `**Límite de entradas:** ${limit ?? "—"}`,
    `**Precios:** pendiente de publicar`,
    ...(artist.deezerFans ? [`**Popularidad:** ${millions(artist.deezerFans)} fans en Deezer`] : []),
    `**Reventa (solo referencia):** [Viagogo](https://www.viagogo.com/secure/search?q=${q}) · [Vivid Seats](https://www.vividseats.com/search?searchTerm=${q})`,
    ...(official.length ? ["", "**Enlaces oficiales**", official.map(([n, u]) => `[${n}](${u})`).join(" · ")] : []),
  ].join("\n");

  // Agrupar ventanas futuras por etiqueta + hora (una venta UK a otra hora va en su propio bloque).
  const groups = new Map<string, { w: SaleWindow; shows: Show[] }>();
  for (const s of live) {
    for (const w of s.sales) {
      if (w.startsAt && Date.parse(w.startsAt) <= now.getTime()) continue;
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
    const links = ss.map((s) => `${flag(s.venue.country)} [${s.venue.city} · ${showDay(s.localDate)}](${s.url})`);
    return [`## 🎟️ ${w.label}`, when, `*${REQUIREMENT[w.kind]}*`, ...links].join("\n");
  });
  if (!blocks.length) {
    blocks.push(["## ✅ Todas las ventas ya han empezado", ...live.map((s) => `${flag(s.venue.country)} [${s.venue.city} · ${showDay(s.localDate)}](${s.url})`)].join("\n"));
  }
  return pack([head, ...blocks, `-# Actualizado <t:${Math.floor(now.getTime() / 1000)}:R> · GIRA · solo información, compras tú`]);
}
