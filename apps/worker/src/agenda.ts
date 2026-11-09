import { actionableSales, flag, localDateIn, MADRID, topicOf, type Show } from "@gira/core";
import { discordFetch } from "./discord-client";
import type { Env } from "./env";
import { Guild } from "./sheets";

/** Canal de deporte → tema de Ticketmaster. */
const TOPIC: Record<string, string> = { futbol: "football", f1: "f1", tenis: "tennis", nfl: "nfl", "otros-deportes": "other_sport" };
const NAMES: Record<string, string> = { futbol: "Fútbol", f1: "Fórmula 1", tenis: "Tenis", nfl: "NFL", "otros-deportes": "Otros deportes" };
const ts = (iso: string, style = "f") => `<t:${Math.floor(Date.parse(iso) / 1000)}:${style}>`;

function pack(blocks: string[], max = 1900): string[] {
  const out: string[] = [];
  let cur = "";
  for (const piece of blocks.flatMap((b) => (b.length > max ? b.split("\n") : [b]))) {
    const add = cur ? `\n${piece}` : piece;
    if (cur && cur.length + add.length > max) {
      out.push(cur);
      cur = piece;
    } else cur += add;
  }
  if (cur) out.push(cur);
  return out;
}

/** Lo que ya vende Ticketmaster de las entidades de deporte seguidas, por canal. */
function tmLines(shows: Show[], topic: string, now: Date): string[] {
  return shows
    .filter((s) => topicOf(s) === topic)
    .slice(0, 12)
    .map((s) => {
      const next = actionableSales(s, now)
        .filter((w) => w.startsAt)
        .sort((a, b) => a.startsAt!.localeCompare(b.startsAt!))[0];
      const sale = next ? `${next.label}: ${ts(next.startsAt!, "f")}` : s.status === "onsale" ? "a la venta" : "venta por anunciar";
      const when = s.startsAt ? ts(s.startsAt, "D") : s.localDate;
      return `${when} · **${s.name}** · ${flag(s.venue.country)} ${s.venue.city} · ${sale} · [Entradas](${s.url})`;
    });
}

/**
 * Agenda de entradas de cada canal de deporte: lo que manda el trabajo (partidos, carreras, torneos) y
 * lo que ya vende Ticketmaster. Un mensaje fijo por canal que se edita en sitio.
 */
export async function postAgenda(env: Env, body: { sections?: { channel: string; title: string; lines: string[] }[] }, now: Date): Promise<{ channels: number }> {
  if (env.DELIVERY_PAUSED === "1") return { channels: 0 };
  const { results } = await env.DB.prepare(
    `SELECT snapshot_json FROM show WHERE local_date >= ? AND is_package = 0 AND json_extract(snapshot_json, '$.segment') = 'Sports'
     ORDER BY local_date LIMIT 200`,
  )
    .bind(localDateIn(now, MADRID))
    .all<{ snapshot_json: string }>();
  const shows = results.map((r) => JSON.parse(r.snapshot_json) as Show);
  const guild = new Guild(env);
  let done = 0;
  for (const s of (body.sections ?? []).filter((x) => TOPIC[x.channel])) {
    const ch = await guild.byName(s.channel);
    if (!ch) continue;
    const tm = tmLines(shows, TOPIC[s.channel]!, now);
    const blocks = [
      `# 🏟️ Agenda de entradas · ${NAMES[s.channel]}`,
      ...(s.lines.length ? [`## ${s.title}`, ...s.lines.slice(0, 20)] : []),
      ...(tm.length ? ["## 🎟️ A la venta o por salir en Ticketmaster", ...tm] : []),
      ...(!s.lines.length && !tm.length ? ["Sin ventas a la vista ahora mismo. Los avisos nuevos llegan a este canal."] : []),
      `-# Actualizado ${ts(now.toISOString(), "R")} · GIRA · solo información, compras tú`,
    ];
    const msgs = pack(blocks);
    const key = `agenda|${s.channel}`;
    const prev = await env.DB.prepare("SELECT value FROM setting WHERE key = ?").bind(key).first<{ value: string }>();
    const ids: string[] = prev ? JSON.parse(prev.value) : [];
    const next: string[] = [];
    for (let i = 0; i < msgs.length; i++) {
      const payload = { content: msgs[i], allowed_mentions: { parse: [] }, flags: 4 };
      if (ids[i] && (await discordFetch(env, "PATCH", `/channels/${ch.id}/messages/${ids[i]}`, payload)).ok) {
        next.push(ids[i]!);
        continue;
      }
      const r = await discordFetch(env, "POST", `/channels/${ch.id}/messages`, { ...payload, flags: 4 | 4096 });
      if (r.ok) next.push(((await r.json()) as { id: string }).id);
    }
    for (const old of ids.slice(msgs.length)) await discordFetch(env, "DELETE", `/channels/${ch.id}/messages/${old}`);
    await env.DB.prepare("INSERT INTO setting (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value").bind(key, JSON.stringify(next)).run();
    done++;
  }
  return { channels: done };
}
