export const MADRID = "Europe/Madrid";
export const LONDON = "Europe/London";

const hhmmCache = new Map<string, Intl.DateTimeFormat>();

function hhmmFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = hhmmCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("es-ES", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    hhmmCache.set(timeZone, f);
  }
  return f;
}

/** "HH:mm" de un instante UTC en una zona horaria. */
export function formatHHmm(isoUtc: string, timeZone: string): string {
  return hhmmFormatter(timeZone).format(new Date(isoUtc));
}

/** Hora en Madrid, Londres y, si el recinto está en otro huso, hora local. */
export function formatTriple(
  isoUtc: string,
  eventTz?: string,
): { madrid: string; london: string; local: string | null } {
  const local = eventTz && eventTz !== MADRID && eventTz !== LONDON ? formatHHmm(isoUtc, eventTz) : null;
  return { madrid: formatHHmm(isoUtc, MADRID), london: formatHHmm(isoUtc, LONDON), local };
}

const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  timeZone: MADRID,
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Fecha legible en Madrid: "jue 3 dic 2026, 10:00". */
export function formatMadridDate(isoUtc: string): string {
  const p = Object.fromEntries(dateFormatter.formatToParts(new Date(isoUtc)).map((x) => [x.type, x.value]));
  const clean = (s: string | undefined) => (s ?? "").replace(/\.$/, "");
  return `${clean(p.weekday)} ${p.day} ${clean(p.month)} ${p.year}, ${p.hour}:${p.minute}`;
}

/** Fecha local "YYYY-MM-DD" de un instante en una zona horaria. */
export function localDateIn(instant: string | Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    typeof instant === "string" ? new Date(instant) : instant,
  );
}
