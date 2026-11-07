import type { Alert } from "./changes";
import type { Topic } from "./feed";
import { decideDelivery, type AlertKind } from "./quiet";
import type { Show } from "./ticketmaster";
import { formatDateIn, formatHHmm, formatMadridDate, formatTriple, MADRID } from "./time";

/** Tipos de canal de Discord usados. */
export const TEXT = 0;
export const ANNOUNCEMENT = 5;
export const FORUM = 15;
const CATEGORY = 4;

type ChannelSpec = { name: string; kind: "text" | "announcement" | "forum"; topic: string };

/**
 * Estructura cerrada del servidor GIRA. Nunca hay canales por artista ni por concierto: la
 * información se recopila en estos canales temáticos; cada gira vive como publicación del foro
 * `fichas` mientras tenga fechas futuras y después se resume en `#archivo`.
 */
export const LAYOUT: { name: string; channels: ChannelSpec[] }[] = [
  { name: "📌 INICIO", channels: [
    { name: "bienvenida", kind: "text", topic: "Qué es GIRA y cómo usarla" },
    { name: "estado", kind: "text", topic: "Salud del radar (automático)" },
  ] },
  { name: "📅 CALENDARIO", channels: [
    { name: "daily-release", kind: "announcement", topic: "Resumen diario 21:00 (Madrid)" },
    { name: "esta-semana", kind: "text", topic: "Ventanas de venta de los próximos 7 días" },
    { name: "recordatorios", kind: "text", topic: "Recordatorios T-24 h, T-1 h, T-10 min" },
  ] },
  { name: "🚨 ALERTAS", channels: [
    { name: "nuevas-giras", kind: "text", topic: "Giras y fechas nuevas de artistas seguidos" },
    { name: "fechas-extra", kind: "text", topic: "Fechas añadidas a giras ya anunciadas" },
    { name: "preventas", kind: "text", topic: "Preventas y ventas generales, con hora de Madrid y Londres" },
    { name: "registros-abiertos", kind: "text", topic: "Registros para preventas, con fecha de cierre" },
  ] },
  { name: "🎤 GIRAS", channels: [
    { name: "fichas", kind: "forum", topic: "Una ficha por gira con fechas futuras. Al terminar, pasa a #archivo." },
  ] },
  { name: "🌍 POR REGIÓN", channels: [
    { name: "europa", kind: "text", topic: "Europa continental" },
    { name: "reino-unido", kind: "text", topic: "Reino Unido e Irlanda" },
  ] },
  { name: "📰 NOTICIAS", channels: [
    { name: "noticias", kind: "text", topic: "Noticias confirmadas" },
    { name: "rumores", kind: "text", topic: "Rumores con su nivel de certeza" },
  ] },
  { name: "🎟️ TICKETERAS", channels: [
    { name: "ticketmaster", kind: "text", topic: "Ticketmaster" },
    { name: "live-nation", kind: "text", topic: "Live Nation" },
    { name: "eventim", kind: "text", topic: "Eventim / Entradas.com / TicketOne" },
    { name: "dice", kind: "text", topic: "Dice" },
    { name: "axs", kind: "text", topic: "AXS" },
    { name: "otras", kind: "text", topic: "See Tickets, Blueticket, El Corte Inglés y demás" },
  ] },
  { name: "🏟️ DEPORTES", channels: [
    { name: "nfl", kind: "text", topic: "NFL (partidos internacionales en Europa)" },
    { name: "f1", kind: "text", topic: "Fórmula 1" },
    { name: "futbol", kind: "text", topic: "Fútbol" },
    { name: "tenis", kind: "text", topic: "Tenis" },
    { name: "otros-deportes", kind: "text", topic: "UFC, boxeo, dardos, Euroleague, LoL…" },
  ] },
  { name: "📦 ARCHIVO", channels: [
    { name: "archivo", kind: "text", topic: "Resumen de cada gira cuando pasa su última fecha" },
  ] },
];

export interface ExistingChannel {
  id: string;
  name: string;
  type: number;
  parent_id: string | null;
}

export type LayoutOp =
  | { op: "create_category"; name: string }
  | { op: "create_channel"; name: string; type: 0 | 5 | 15; parent: string; topic: string };

/** Operaciones para completar el layout. Idempotente y solo de creación: nunca borra ni renombra. */
export function planGuildLayout(existing: ExistingChannel[], hasCommunity: boolean): LayoutOp[] {
  const ops: LayoutOp[] = [];
  for (const cat of LAYOUT) {
    const catId = existing.find((c) => c.type === CATEGORY && c.name === cat.name)?.id ?? null;
    if (!catId) ops.push({ op: "create_category", name: cat.name });
    for (const ch of cat.channels) {
      const exists = catId !== null && existing.some((c) => c.name === ch.name && c.parent_id === catId);
      if (exists) continue;
      const type = !hasCommunity ? TEXT : ch.kind === "forum" ? FORUM : ch.kind === "announcement" ? ANNOUNCEMENT : TEXT;
      ops.push({ op: "create_channel", name: ch.name, type, parent: cat.name, topic: ch.topic });
    }
  }
  return ops;
}

export type AlertChannel = "nuevas-giras" | "fechas-extra" | "preventas" | "nfl" | "futbol" | "f1" | "tenis" | "otros-deportes";

const SPORT_CHANNEL: Partial<Record<Topic, AlertChannel>> = {
  nfl: "nfl", football: "futbol", f1: "f1", tennis: "tenis", other_sport: "otros-deportes",
};

/** Canal de un aviso: el deporte va a su canal; la música, por tipo de aviso. */
export function channelFor(kind: AlertKind, topic: Topic = "music"): AlertChannel {
  const sport = SPORT_CHANNEL[topic];
  if (sport) return sport;
  if (kind === "extra_date") return "fechas-extra";
  if (kind === "new_event" || kind === "status_changed") return "nuevas-giras";
  return "preventas";
}

const TITLES: Record<AlertKind, string> = {
  new_event: "🆕 Fecha nueva",
  extra_date: "➕ Fecha extra",
  status_changed: "⚠️ Cambio de estado",
  sale_added: "🎟️ Nueva venta",
  sale_changed: "🕒 Cambia la hora de venta",
  sale_soon: "⏰ Venta a punto de empezar",
  waiting_room: "🚪 Sala de espera abierta",
};
const COLORS: Record<AlertKind, number> = {
  new_event: 0x2e46e6,
  extra_date: 0xb86a00,
  status_changed: 0xb3261e,
  sale_added: 0x187a4a,
  sale_changed: 0xb86a00,
  sale_soon: 0xb3261e,
  waiting_room: 0xb3261e,
};
const STATUS_ES: Record<string, string> = {
  onsale: "a la venta", offsale: "sin venta", cancelled: "cancelado", postponed: "aplazado", rescheduled: "nueva fecha",
};

function saleLine(label: string, startsAt: string | null, tz: string | null): string {
  if (!startsAt) return `• **${label}**: hora por confirmar`;
  const t = formatTriple(startsAt, tz);
  const local = t.local ? ` · local ${t.local}` : "";
  return `• **${label}**: ${formatMadridDate(startsAt)} — Madrid ${t.madrid} · Londres ${t.london}${local} (<t:${Date.parse(startsAt) / 1000}:F>)`;
}

/** Fecha del concierto: hora local del recinto (etiquetada si no es Madrid) y su equivalencia en Madrid. */
function showWhen(s: Show): string {
  if (!s.startsAt) return `${s.localDate} (hora por confirmar)`;
  if (!s.venue.tz || s.venue.tz === MADRID) return formatMadridDate(s.startsAt);
  return `${formatDateIn(s.startsAt, s.venue.tz)} (hora local) · ${formatHHmm(s.startsAt, MADRID)} en Madrid`;
}

/** Mensaje de Discord para un aviso. De noche y sin urgencia va en silencio (flags 4096). */
export function renderAlertMessage(
  a: Alert,
  s: Show,
  nowUtc: Date,
): { content: string; embeds: object[]; flags?: 4096 } {
  const when = showWhen(s);
  const fields: { name: string; value: string; inline?: boolean }[] = [];
  if (a.kind === "status_changed") {
    fields.push({ name: "Estado", value: `${STATUS_ES[a.detail.before ?? ""] ?? a.detail.before} → **${STATUS_ES[a.detail.after ?? ""] ?? a.detail.after}**` });
  }
  if (a.kind === "sale_changed") {
    fields.push({ name: a.detail.label ?? "Venta", value: `Antes ${a.detail.before} → ahora **${a.detail.after}** (Madrid)` });
  }
  if (s.sales.length) {
    fields.push({
      name: "Ventas en orden (hora de Madrid · Londres)",
      value: s.sales.map((w) => saleLine(w.label, w.startsAt, s.venue.tz)).join("\n").slice(0, 1024),
    });
  }
  if (s.ticketLimit) fields.push({ name: "Límite de entradas", value: s.ticketLimit.slice(0, 1024) });
  fields.push({ name: "Entradas (oficial)", value: s.url || "—" });

  const embed = {
    title: `${TITLES[a.kind]} · ${a.artistName}`.slice(0, 256),
    url: s.url || undefined,
    description: `**${s.name}**\n${s.venue.name}, ${s.venue.city} (${s.venue.country}) · ${when}`.slice(0, 4096),
    color: COLORS[a.kind],
    fields,
    footer: { text: `GIRA · Ticketmaster · ${"⭐".repeat(a.tier)}` },
  };
  const silent = decideDelivery(a, nowUtc) === "silent";
  return { content: "", embeds: [embed], ...(silent ? { flags: 4096 as const } : {}) };
}
