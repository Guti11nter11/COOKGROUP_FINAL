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
  const res = await discordFetch(env, "POST", `/channels/${channelId}/messages`, { content, allowed_mentions: { parse: [] }, ...(silent ? { flags: 4096 } : {}) });
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
  for (const d of due.slice(0, 8)) {
    if (!rec) break;
    // De noche (01–08) el de 24 h va en silencio; los de 1 h y 10 min siempre suenan (son urgentes).
    const silent = d.reminder.key === "24h" && isQuietTime(now);
    if (!(await post(env, rec.id, renderReminder(d.slot, d.reminder.text), silent))) break;
    const iso = now.toISOString();
    await env.DB.batch(
      [`${d.slot.artistId}|${d.slot.label.toLowerCase()}|${d.slot.startsAt}|${d.reminder.key}`, ...d.skip].map((k) =>
        env.DB.prepare("INSERT OR IGNORE INTO reminder_sent (key, sent_at) VALUES (?, ?)").bind(k, iso),
      ),
    );
    result.reminders++;
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
        const body = { content: week[i], allowed_mentions: { parse: [] } };
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
  if (env.DELIVERY_PAUSED === "1" || (await setting(env, "ics_announced"))) return;
  const ch = await new Guild(env).byName("estado");
  if (!ch) return;
  const url = `${origin.replace(/^https:/, "webcal:")}/calendar.ics?t=${await icsToken(env)}`;
  const id = await post(
    env,
    ch.id,
    `📅 **Calendario de preventas de GIRA**\nEn el iPhone: abre este enlace y pulsa *Suscribirse* (se actualiza solo cada hora):\n${url}\n-# Enlace privado: no lo compartas.`,
    true,
  );
  if (id) await putSetting(env, "ics_announced", new Date().toISOString());
}
