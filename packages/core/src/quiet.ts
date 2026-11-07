import { MADRID } from "./time";

export type AlertKind =
  | "new_event"
  | "extra_date"
  | "status_changed"
  | "sale_added"
  | "sale_changed"
  | "sale_soon"
  | "waiting_room";

const QUIET_START_HOUR = 1; // 01:00 Madrid
const QUIET_END_HOUR = 8; // 08:00 Madrid (excluida)
const URGENT_WINDOW_MS = 60 * 60 * 1000; // venta en < 1 h

const hourFormatter = new Intl.DateTimeFormat("en-GB", { timeZone: MADRID, hour: "2-digit", hourCycle: "h23" });

/** True entre 01:00 y 07:59 en Europe/Madrid. */
export function isQuietTime(nowUtc: Date): boolean {
  const hour = Number(hourFormatter.format(nowUtc));
  return hour >= QUIET_START_HOUR && hour < QUIET_END_HOUR;
}

/** Urgente: venta en < 1 h, sala de espera abierta o fecha extra de un artista seguido. */
export function isUrgent(a: { kind: AlertKind; startsAt?: string }, nowUtc: Date): boolean {
  if (a.kind === "waiting_room" || a.kind === "extra_date") return true;
  if (a.startsAt && (a.kind === "sale_soon" || a.kind === "sale_added" || a.kind === "sale_changed")) {
    const delta = Date.parse(a.startsAt) - nowUtc.getTime();
    return delta >= 0 && delta < URGENT_WINDOW_MS;
  }
  return false;
}

/**
 * "now" = notificar normalmente. "silent" = publicar sin notificación (Discord flags 4096)
 * y dejarlo para el resumen de la mañana.
 */
export function decideDelivery(a: { kind: AlertKind; startsAt?: string }, nowUtc: Date): "now" | "silent" {
  if (!isQuietTime(nowUtc)) return "now";
  return isUrgent(a, nowUtc) ? "now" : "silent";
}
