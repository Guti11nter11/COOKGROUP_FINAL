/**
 * Calendario de ventas: recordatorios (T-24 h, T-1 h, T-10 min), resumen diario, "esta semana" y .ics.
 * Todo parte de las ventanas de venta futuras de las fichas activas. Funciones puras.
 */
import { flag } from "./sheet";
import { formatHHmm, LONDON, MADRID } from "./time";

export interface SaleSlot {
  artistId: string;
  artist: string;
  channelId: string | null;
  label: string;
  startsAt: string;
  dates: { city: string; country: string; localDate: string; url: string }[];
}

/** Sin "mañana a esta hora": de eso ya avisa el resumen diario de las 22:00. */
export const REMINDERS = [
  { key: "1h", ms: 3600_000, text: "en 1 hora" },
  { key: "10m", ms: 10 * 60_000, text: "en 10 minutos" },
] as const;

export const slotKey = (s: Pick<SaleSlot, "artistId" | "label" | "startsAt">) => `${s.artistId}|${s.label.toLowerCase()}|${s.startsAt}`;

/**
 * Recordatorios que tocan ahora: para cada venta, solo el más cercano ya alcanzado y no enviado. Los
 * anteriores no enviados se dan por enviados (no se manda "mañana" si quedan 5 minutos).
 */
export function remindersDue(slots: SaleSlot[], sent: Set<string>, now: Date): { slot: SaleSlot; reminder: (typeof REMINDERS)[number]; skip: string[] }[] {
  const out: { slot: SaleSlot; reminder: (typeof REMINDERS)[number]; skip: string[] }[] = [];
  for (const slot of slots) {
    const left = Date.parse(slot.startsAt) - now.getTime();
    if (left <= 0) continue;
    const reached = REMINDERS.filter((r) => left <= r.ms);
    const last = reached[reached.length - 1];
    if (!last) continue;
    const key = `${slotKey(slot)}|${last.key}`;
    if (sent.has(key)) continue;
    out.push({ slot, reminder: last, skip: reached.slice(0, -1).map((r) => `${slotKey(slot)}|${r.key}`) });
  }
  return out;
}

const cities = (s: SaleSlot) => [...new Map(s.dates.map((d) => [d.city, `${flag(d.country)} ${d.city}`])).values()].join(", ");
const chan = (s: SaleSlot) => (s.channelId ? ` → <#${s.channelId}>` : "");
const dayFmt = new Intl.DateTimeFormat("es-ES", { timeZone: MADRID, weekday: "long", day: "numeric", month: "long" });
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: MADRID, year: "numeric", month: "2-digit", day: "2-digit" });

/**
 * Un recordatorio para todas las ventas que empiezan a la misma hora: una línea por artista con sus
 * preventas, ciudades y canal. La hora va como marca de Discord (cada uno la ve en su zona).
 */
export function renderReminder(group: { slot: SaleSlot; labels: string[] }[], text: string): string {
  const at = group[0]!.slot.startsAt;
  const lines = group.map(({ slot, labels }) => `• **${slot.artist}** · ${labels.join(" · ")} · ${cities(slot)}${chan(slot)}`);
  return [`⏰ **${text[0]!.toUpperCase()}${text.slice(1)}** · <t:${Date.parse(at) / 1000}:F>`, ...lines].join("\n");
}

/** Ventas agrupadas por día (hora de Madrid), en orden. */
function byDay(slots: SaleSlot[]): [string, SaleSlot[]][] {
  const days = new Map<string, SaleSlot[]>();
  for (const s of [...slots].sort((a, b) => a.startsAt.localeCompare(b.startsAt))) {
    const k = dayKey.format(new Date(s.startsAt));
    days.set(k, [...(days.get(k) ?? []), s]);
  }
  return [...days];
}

/**
 * Una línea por artista y día: sus ventas a la misma hora juntas (etiquetas y ciudades sin repetir) y,
 * si tiene otra hora ese día, en la misma línea tras "—". En orden por la primera hora.
 */
export function artistLines(list: SaleSlot[]): string[] {
  const byArtist = new Map<string, SaleSlot[]>();
  for (const s of list) byArtist.set(s.artistId, [...(byArtist.get(s.artistId) ?? []), s]);
  return [...byArtist.values()]
    .sort((a, b) => a[0]!.startsAt.localeCompare(b[0]!.startsAt))
    .map((ss) => {
      const times = [...new Set(ss.map((s) => s.startsAt))].sort();
      const segs = times.map((t) => {
        const at = ss.filter((s) => s.startsAt === t);
        const labels = [...new Set(at.map((s) => s.label))];
        const places = [...new Map(at.flatMap((s) => s.dates).map((d) => [d.city, `${flag(d.country)} ${d.city}`])).values()];
        const shown = places.length > 6 ? `${places.slice(0, 6).join(", ")} y ${places.length - 6} más` : places.join(", ");
        return `\`${formatHHmm(t, MADRID)}\` ${labels.join(" · ")} · ${shown}`;
      });
      const [first, ...rest] = segs;
      const head = first!.replace(/^(`[^`]+`) /, `$1 **${ss[0]!.artist}** · `);
      return [head, ...rest].join(" — ") + chan(ss[0]!);
    });
}

/** Resumen diario (una vez, a las 22:00): ventas de las próximas 48 h y giras nuevas del día. */
export function renderDigest(slots: SaleSlot[], news: { artist: string; text: string; channelId: string | null }[], now: Date): string[] {
  const horizon = now.getTime() + 48 * 3600_000;
  const next = slots.filter((s) => Date.parse(s.startsAt) > now.getTime() && Date.parse(s.startsAt) <= horizon);
  const parts: string[] = [`# 🌙 Resumen del día · ${dayFmt.format(now)}`];
  if (news.length) parts.push(["## 🆕 Novedades", ...news.slice(0, 15).map((n) => `• **${n.artist}** · ${n.text}${n.channelId ? ` → <#${n.channelId}>` : ""}`)].join("\n"));
  if (next.length) {
    for (const [, list] of byDay(next)) parts.push([`## 📅 ${dayFmt.format(new Date(list[0]!.startsAt))}`, ...artistLines(list)].join("\n"));
  } else parts.push("Sin preventas ni ventas en las próximas 48 h.");
  parts.push("-# Horas de Madrid · GIRA · solo información, compras tú");
  return packText(parts);
}

/** Mensaje fijo de #esta-semana (se edita en sitio). */
export function renderWeek(slots: SaleSlot[], now: Date): string[] {
  const horizon = now.getTime() + 7 * 86_400_000;
  const next = slots.filter((s) => Date.parse(s.startsAt) > now.getTime() && Date.parse(s.startsAt) <= horizon);
  const parts = [`# 🗓️ Esta semana · ventas de los próximos 7 días`];
  if (!next.length) parts.push("Nada a la vista todavía.");
  for (const [, list] of byDay(next)) parts.push([`## ${dayFmt.format(new Date(list[0]!.startsAt))}`, ...artistLines(list)].join("\n"));
  parts.push(`-# Actualizado <t:${Math.floor(now.getTime() / 1000)}:R> · horas de Madrid`);
  return packText(parts);
}

/**
 * Empaqueta bloques en mensajes de ≤ max caracteres: entre bloques (días) una línea en blanco y, si un
 * día no cabe entero, se parte por líneas sin huecos entre ellas (como un día corto).
 */
function packText(blocks: string[], max = 1900): string[] {
  const pieces = blocks.flatMap((b) => {
    if (b.length <= max) return [b];
    const parts: string[] = [];
    let cur = "";
    for (const line of b.split("\n")) {
      if (cur && cur.length + 1 + line.length > max) {
        parts.push(cur);
        cur = line;
      } else cur = cur ? `${cur}\n${line}` : line;
    }
    if (cur) parts.push(cur);
    return parts;
  });
  const out: string[] = [];
  let cur = "";
  for (const b of pieces) {
    const add = cur ? `\n\n${b}` : b;
    if (cur && cur.length + add.length > max) {
      out.push(cur);
      cur = b;
    } else cur += add;
  }
  if (cur) out.push(cur);
  return out;
}

const icsText = (t: string) => t.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
const icsDate = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
function fold75(line: string): string {
  // Plegado de líneas .ics por puntos de código (nunca parte un emoji) y con margen para UTF-8.
  const cps = Array.from(line);
  const out: string[] = [];
  for (let i = 0; i < cps.length; i += i === 0 ? 60 : 59) out.push((i === 0 ? "" : " ") + cps.slice(i, i + (i === 0 ? 60 : 59)).join(""));
  return out.join("\r\n");
}

/** Calendario suscribible: una entrada de 15 min por venta, con aviso 10 min antes. */
export function toIcs(slots: SaleSlot[], now: Date): string {
  const stamp = icsDate(now.toISOString());
  const events = slots.map((s) => {
    const end = new Date(Date.parse(s.startsAt) + 15 * 60_000).toISOString();
    const desc = [`${s.label} · ${s.artist}`, ...s.dates.map((d) => `${d.city} ${d.localDate}: ${d.url}`)].join("\n");
    return [
      "BEGIN:VEVENT",
      `UID:${icsText(slotKey(s)).replace(/[^A-Za-z0-9@._-]/g, "-")}@gira`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${icsDate(s.startsAt)}`,
      `DTEND:${icsDate(end)}`,
      `SUMMARY:${icsText(`🎟️ ${s.artist} · ${s.label}`)}`,
      `DESCRIPTION:${icsText(desc)}`,
      ...(s.dates[0] ? [`URL:${s.dates[0].url}`] : []),
      "BEGIN:VALARM",
      "TRIGGER:-PT10M",
      "ACTION:DISPLAY",
      `DESCRIPTION:${icsText(`${s.artist} · ${s.label} en 10 minutos`)}`,
      "END:VALARM",
      "END:VEVENT",
    ];
  });
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//GIRA//Radar personal//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:GIRA · preventas",
    "X-WR-TIMEZONE:Europe/Madrid",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    ...events.flat(),
    "END:VCALENDAR",
  ]
    .map(fold75)
    .join("\r\n");
}
