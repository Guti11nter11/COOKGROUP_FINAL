/**
 * Horario de GIRA (hora de Madrid), decidido con el propietario (2026-11-08): las preventas de
 * Europa y Reino Unido salen sobre todo entre las 09:00 y las 14:00; las de EE. UU. (fase 2) entre
 * las 16:00 y las 21:00; de 00:00 a 08:00 no hace falta mirar nada (Asia/Australia, más adelante).
 */
import { MADRID } from "./time";

const hm = new Intl.DateTimeFormat("en-GB", { timeZone: MADRID, hour: "2-digit", minute: "2-digit", hour12: false });
const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: MADRID, year: "numeric", month: "2-digit", day: "2-digit" });

/** Minutos desde la medianoche de Madrid. */
export function madridMinutes(now: Date): number {
  const [h, m] = hm.format(now).split(":").map(Number) as [number, number];
  return (h % 24) * 60 + m;
}
export const madridDay = (now: Date) => ymd.format(now);

/** Cada cuántos minutos se barre Ticketmaster en esta franja; 0 = no se barre. */
export function sweepEveryMin(now: Date): number {
  const m = madridMinutes(now);
  if (m < 8 * 60) return 0; // 00:00–08:00: nada
  if (m < 8 * 60 + 30) return 15;
  if (m < 14 * 60 + 30) return 10; // 08:30–14:30: preventas EU/UK (cada 10 min, decisión del propietario)
  if (m < 16 * 60) return 15;
  if (m < 21 * 60 + 30) return 10; // 16:00–21:30: preventas de EE. UU. (fase 2), también cada 10 min
  return 30; // 21:30–24:00
}

/** ¿Toca barrer en este tic del cron (cada 5 min)? */
export function isSweepTick(now: Date): boolean {
  const every = sweepEveryMin(now);
  return every > 0 && madridMinutes(now) % every < 5;
}

/** Horas fijas (Madrid) a las que el Worker lanza los trabajos de GitHub. */
export const JOB_SLOTS: Record<string, string[]> = {
  "feed-radar.yml": ["08:30", "09:30", "10:30", "11:30", "12:30", "13:30", "14:30", "16:30", "18:30", "20:30", "22:30"],
  "news-radar.yml": ["08:15", "10:15", "12:15", "14:15", "17:15", "20:15"],
  "enrich.yml": ["09:00", "13:00", "19:00"],
  "ticketers.yml": ["10:00", "20:00"],
  "social.yml": ["11:30"],
  "sports.yml": ["09:45", "18:45"],
  "livenation.yml": ["08:40", "12:40", "17:40", "21:10"],
};

/**
 * Hora fija que toca ahora: la última ya alcanzada hoy, aún no lanzada y de hace menos de 60 min
 * (si el Worker estuvo parado, no se recuperan pasadas antiguas). Null si no toca nada.
 */
export function slotDue(slots: string[], now: Date, done: Set<string>): string | null {
  const m = madridMinutes(now);
  const reached = slots.filter((s) => {
    const [h, mm] = s.split(":").map(Number) as [number, number];
    const at = h * 60 + mm;
    return at <= m && m - at < 60;
  });
  const last = reached[reached.length - 1];
  return last && !done.has(last) ? last : null;
}
