import {
  formatHHmm,
  isQuietTime,
  localDateIn,
  MADRID,
  remindersDue,
  renderDigest,
  renderReminder,
  renderWeek,
  sheetShows,
  stableHash,
  toIcs,
  type Alert,
  type SaleSlot,
  type Show,
} from "@gira/core";
import { discordFetch } from "./discord-client";
import type { Env } from "./env";
import { setupToken } from "./auth";
import { pushAll } from "./push";
import { Guild } from "./sheets";

/** Ventas por llegar de las fichas activas, agrupadas por artista + etiqueta + hora. */
export async function loadSlots(env: Env, now: Date): Promise<SaleSlot[]> {
  const { results } = await env.DB.prepare(
    `SELECT s.artist_id, a.name, h.channel_id, s.snapshot_json FROM show s
       JOIN sheet h ON h.artist_id = s.artist_id AND h.status = 'active' JOIN artist a ON a.id = s.artist_id
      WHERE s.local_date >= ? AND s.is_package = 0`,
  )
    .bind(localDateIn(now, MADRID))
    .all<{ artist_id: string; name: string; channel_id: string; snapshot_json: string }>();
  const byArtist = new Map<string, { name: string; channel: string; shows: Show[] }>();
  for (const r of results) {
    const e = byArtist.get(r.artist_id) ?? { name: r.name, channel: r.channel_id, shows: [] };
    e.shows.push(JSON.parse(r.snapshot_json) as Show);
    byArtist.set(r.artist_id, e);
  }
  const slots = new Map<string, SaleSlot>();
  for (const [artistId, e] of byArtist) {
    for (const s of sheetShows(e.name, e.shows)) {
      for (const w of s.sales) {
        if (!w.startsAt || w.kind === "official_resale" || Date.parse(w.startsAt) <= now.getTime()) continue;
        const k = `${artistId}|${w.label.toLowerCase()}|${w.startsAt}`;
        const slot = slots.get(k) ?? { artistId, artist: e.name, channelId: e.channel, label: w.label, startsAt: w.startsAt, dates: [] };
        if (!slot.dates.some((d) => d.url === s.url)) slot.dates.push({ city: s.venue.city, country: s.venue.country, localDate: s.localDate, url: s.url });
        slots.set(k, slot);
      }
    }
  }
  return [...slots.values()].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

async function setting(env: Env, key: string): Promise<string | null> {
  return (await env.DB.prepare("SELECT value FROM setting WHERE key = ?").bind(key).first<{ value: string }>())?.value ?? null;
}
const putSetting = (env: Env, key: string, value: string) =>
  env.DB.prepare("INSERT INTO setting (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value").bind(key, value).run();

async function post(env: Env, channelId: string, content: string, silent: boolean): Promise<string | null> {
  const res = await discordFetch(env, "POST", `/channels/${channelId}/messages`, { content, allowed_mentions: { parse: [] }, flags: silent ? 4096 | 4 : 4 });
  return res.ok ? ((await res.json()) as { id: string }).id : null;
}

/** Novedades del día para el resumen: giras y fechas nuevas por artista (últimas 12 h). */
async function newsSince(env: Env, since: Date): Promise<{ artist: string; text: string; channelId: string | null }[]> {
  const { results } = await env.DB.prepare(
    `SELECT al.payload_json, h.channel_id FROM alert al JOIN show s ON s.source_id = al.source_id
       LEFT JOIN sheet h ON h.artist_id = s.artist_id AND h.status = 'active'
      WHERE al.created_at >= ? AND al.kind IN ('new_event', 'extra_date', 'sale_added') LIMIT 300`,
  )
    .bind(since.toISOString())
    .all<{ payload_json: string; channel_id: string | null }>();
  const by = new Map<string, { channel: string | null; counts: Map<string, number> }>();
  for (const r of results) {
    if (!r.channel_id) continue; // solo lo que tiene ventas por llegar (ficha activa)
    const a = (JSON.parse(r.payload_json) as { alert: Alert }).alert;
    const e = by.get(a.artistName) ?? { channel: r.channel_id, counts: new Map() };
    e.counts.set(a.kind, (e.counts.get(a.kind) ?? 0) + 1);
    by.set(a.artistName, e);
  }
  const words: Record<string, [string, string]> = { new_event: ["fecha nueva", "fechas nuevas"], extra_date: ["fecha extra", "fechas extra"], sale_added: ["venta nueva", "ventas nuevas"] };
  return [...by].map(([artist, e]) => ({
    artist,
    channelId: e.channel,
    text: [...e.counts].map(([k, n]) => `${n} ${words[k]![n === 1 ? 0 : 1]}`).join(" · "),
  }));
}

/**
 * Reloj de GIRA (cada 5 min): recordatorios T-24 h / T-1 h / T-10 min, resúmenes de las 21:00 y las
 * 08:00 (hora de Madrid) y el mensaje fijo de #esta-semana.
 */
export async function runCalendar(env: Env, now: Date): Promise<{ reminders: number; digest: boolean; week: boolean }> {
  if (env.DELIVERY_PAUSED === "1") return { reminders: 0, digest: false, week: false };
  const slots = await loadSlots(env, now);
  const guild = new Guild(env);
  const result = { reminders: 0, digest: false, week: false };

  // 1) Recordatorios.
  const { results: sentRows } = await env.DB.prepare("SELECT key FROM reminder_sent WHERE sent_at >= ?")
    .bind(new Date(now.getTime() - 3 * 86_400_000).toISOString())
    .all<{ key: string }>();
  const due = remindersDue(slots, new Set(sentRows.map((r) => r.key)), now);
  const rec = due.length ? await guild.byName("recordatorios") : undefined;
  // Un solo mensaje por artista, hora y tipo de recordatorio (p. ej. 4 preventas de RAYE a las 11:00).
  const groups = new Map<string, typeof due>();
  for (const d of due) {
    const k = `${d.slot.artistId}|${d.slot.startsAt}|${d.reminder.key}`;
    groups.set(k, [...(groups.get(k) ?? []), d]);
  }
  for (const group of [...groups.values()].slice(0, 6)) {
    if (!rec) break;
    const d = group[0]!;
    const labels = [...new Set(group.map((g) => g.slot.label))];
    const merged = { ...d.slot, dates: [...new Map(group.flatMap((g) => g.slot.dates).map((x) => [x.url, x])).values()] };
    // De noche (01–08) el de 24 h va en silencio; los de 1 h y 10 min siempre suenan (son urgentes).
    const silent = d.reminder.key === "24h" && isQuietTime(now);
    if (!(await post(env, rec.id, renderReminder(merged, d.reminder.text, labels), silent))) break;
    const iso = now.toISOString();
    await env.DB.batch(
      group
        .flatMap((g) => [`${g.slot.artistId}|${g.slot.label.toLowerCase()}|${g.slot.startsAt}|${g.reminder.key}`, ...g.skip])
        .map((k) => env.DB.prepare("INSERT OR IGNORE INTO reminder_sent (key, sent_at) VALUES (?, ?)").bind(k, iso)),
    );
    result.reminders++;
    if (!silent) {
      await pushAll(env, {
        title: `${d.slot.artist} · ${d.reminder.text}`,
        body: `${labels.join(", ")} a las ${formatHHmm(d.slot.startsAt, MADRID)} (Madrid) · ${merged.dates.map((x) => x.city).filter((c, i, a) => a.indexOf(c) === i).join(", ")}`,
        url: "/app/",
        tag: `r-${d.slot.artistId}-${d.reminder.key}`,
      }).catch(() => 0);
    }
  }

  // 2) Resumen diario a las 21:00 y a las 08:00 (Madrid), una vez.
  const hhmm = formatHHmm(now.toISOString(), MADRID);
  const slotName = hhmm >= "21:00" && hhmm < "21:15" ? "21:00" : hhmm >= "08:00" && hhmm < "08:15" ? "08:00" : null;
  if (slotName) {
    const key = `digest|${localDateIn(now, MADRID)}|${slotName}`;
    if (!(await setting(env, key))) {
      const ch = await guild.byName("daily-release");
      if (ch) {
        const msgs = renderDigest(slots, await newsSince(env, new Date(now.getTime() - 12 * 3600_000)), now, slotName);
        let ok = true;
        for (const m of msgs) ok = ok && !!(await post(env, ch.id, m, slotName === "08:00" ? false : isQuietTime(now)));
        if (ok) {
          await putSetting(env, key, now.toISOString());
          result.digest = true;
        }
      }
    }
  }

  // 3) #esta-semana: un mensaje fijo que se edita cuando cambia.
  const week = renderWeek(slots, now);
  const hash = stableHash(week.join("\u0000").replace(/<t:\d+:R>/, ""));
  if (hash !== (await setting(env, "week_hash"))) {
    const ch = await guild.byName("esta-semana");
    if (ch) {
      const ids: string[] = JSON.parse((await setting(env, "week_msgs")) ?? "[]");
      const next: string[] = [];
      for (let i = 0; i < week.length; i++) {
        const body = { content: week[i], allowed_mentions: { parse: [] }, flags: 4 };
        if (ids[i] && (await discordFetch(env, "PATCH", `/channels/${ch.id}/messages/${ids[i]}`, body)).ok) {
          next.push(ids[i]!);
          continue;
        }
        const id = await post(env, ch.id, week[i]!, true);
        if (id) next.push(id);
      }
      for (const old of ids.slice(week.length)) await discordFetch(env, "DELETE", `/channels/${ch.id}/messages/${old}`);
      await putSetting(env, "week_msgs", JSON.stringify(next));
      await putSetting(env, "week_hash", hash);
      result.week = true;
    }
  }
  return result;
}

/** Panel de salud en #estado: un mensaje fijo que se edita como mucho una vez por hora. */
export async function updateStatusPanel(env: Env, now: Date): Promise<boolean> {
  if (env.DELIVERY_PAUSED === "1") return false;
  const hourKey = now.toISOString().slice(0, 13);
  if ((await setting(env, "status_hour")) === hourKey) return false;
  const today = now.toISOString().slice(0, 10);
  const c = await env.DB.prepare(
    `SELECT (SELECT COUNT(*) FROM follow) AS follows, (SELECT COUNT(*) FROM show WHERE local_date >= ?) AS shows,
            (SELECT COUNT(*) FROM sheet WHERE status = 'active') AS sheets, (SELECT COUNT(*) FROM sheet WHERE status = 'archived') AS archived,
            (SELECT COUNT(*) FROM news WHERE created_at >= ?) AS news24, (SELECT COUNT(*) FROM delivery WHERE status = 'pending') AS pending,
            (SELECT COALESCE(SUM(calls), 0) FROM quota_usage WHERE service = 'ticketmaster' AND day = ?) AS tm,
            (SELECT COUNT(*) FROM push_sub) AS devices, (SELECT COUNT(*) FROM show_price) AS priced,
            (SELECT COUNT(*) FROM venue_info WHERE capacity IS NOT NULL) AS venues`,
  )
    .bind(today, new Date(now.getTime() - 86_400_000).toISOString(), today)
    .first<Record<string, number>>();
  const last = await env.DB.prepare("SELECT started_at, ok FROM job_run ORDER BY id DESC LIMIT 1").first<{ started_at: string; ok: number | null }>();
  const ok = last?.ok === 1 && now.getTime() - Date.parse(last.started_at) < 15 * 60_000;
  const text = [
    `## ${ok ? "🟢" : "🟠"} Estado de GIRA`,
    `Último ciclo: <t:${Math.floor(Date.parse(last?.started_at ?? now.toISOString()) / 1000)}:R>${ok ? "" : " · revisar"}`,
    `Entidades seguidas: **${c?.follows ?? 0}** · fechas futuras: **${c?.shows ?? 0}**`,
    `Canales de gira activos: **${c?.sheets ?? 0}** · archivados: ${c?.archived ?? 0}`,
    `Noticias (24 h): ${c?.news24 ?? 0} · avisos pendientes: ${c?.pending ?? 0}`,
    `Ticketmaster hoy: ${c?.tm ?? 0} / 5.000 llamadas · fechas con precio: ${c?.priced ?? 0} · recintos con aforo: ${c?.venues ?? 0}`,
    `Dispositivos con notificaciones: ${c?.devices ?? 0}`,
    `-# Se actualiza cada hora`,
  ].join("\n");
  const ch = await new Guild(env).byName("estado");
  if (!ch) return false;
  const id = await setting(env, "status_msg");
  const body = { content: text, allowed_mentions: { parse: [] }, flags: 4 };
  if (!(id && (await discordFetch(env, "PATCH", `/channels/${ch.id}/messages/${id}`, body)).ok)) {
    const newId = await post(env, ch.id, text, true);
    if (newId) await putSetting(env, "status_msg", newId);
  }
  await putSetting(env, "status_hour", hourKey);
  return true;
}

/** Token privado del calendario (derivado de una clave secreta; nunca en el repo). */
export async function icsToken(env: Env): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`gira-ics:${env.TICKETMASTER_API_KEY}`));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

export async function calendarIcs(env: Env, now: Date): Promise<string> {
  return toIcs(await loadSlots(env, now), now);
}

/** Publica una vez en #estado el enlace del calendario para suscribirse desde el iPhone. */
export async function announceCalendar(env: Env, origin: string): Promise<void> {
  if (env.DELIVERY_PAUSED === "1" || (await setting(env, "app_announced"))) return;
  const ch = await new Guild(env).byName("estado");
  if (!ch) return;
  const url = `${origin.replace(/^https:/, "webcal:")}/calendar.ics?t=${await icsToken(env)}`;
  const setup = `${origin}/app/?alta=${await setupToken(env)}`;
  const id = await post(
    env,
    ch.id,
    [
      "📱 **App GIRA para el iPhone**",
      `1. Abre en Safari: ${setup}`,
      "2. Pulsa *Registrar con Face ID* (solo hace falta una vez; la sesión dura un año).",
      "3. Compartir → *Añadir a pantalla de inicio*, ábrela desde ahí y activa las notificaciones en Ajustes.",
      "",
      "📅 **Calendario de preventas** (se actualiza solo cada hora): abre en el iPhone y pulsa *Suscribirse*:",
      url,
      "-# Enlaces privados: no los compartas.",
    ].join("\n"),
    true,
  );
  if (id) await putSetting(env, "app_announced", new Date().toISOString());
}
