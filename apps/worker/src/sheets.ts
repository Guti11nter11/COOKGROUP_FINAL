import {
  channelSlug,
  decideDelivery,
  flag,
  formatHHmm,
  isSheetActive,
  LAYOUT,
  localDateIn,
  MADRID,
  renderArtistSheet,
  sheetShows,
  type PriceInfo,
  type ResaleInfo,
  type SheetExtras,
  type SignupLink,
  type VenueInfo,
  stableHash,
  topicOf,
  type Alert,
  type Show,
} from "@gira/core";
import { discordFetch } from "./discord-client";
import type { Env } from "./env";

const GIRAS = "🎤 GIRAS";
const DEPORTES = "🏟️ DEPORTES";
const ARCHIVO = "📦 ARCHIVO";
const GIRA_CATEGORIES = new Set(LAYOUT.map((c) => c.name));
const PER_CATEGORY = 50;
/** Discord admite 500 canales por servidor; se deja margen para los temáticos. */
const GUILD_CHANNEL_CAP = 480;
const SPORT_CHANNELS = new Set(["nfl", "futbol", "f1", "tenis", "otros-deportes"]);

type Channel = { id: string; name: string; type: number; parent_id?: string | null };

/** Canales del servidor, leídos una vez por ejecución y actualizados localmente. */
class Guild {
  private list: Channel[] | null = null;
  constructor(private env: Env) {}

  async channels(): Promise<Channel[]> {
    if (!this.list) {
      const res = await discordFetch(this.env, "GET", `/guilds/${this.env.DISCORD_GUILD_ID}/channels`);
      if (!res.ok) throw new Error(`Discord canales HTTP ${res.status}`);
      this.list = (await res.json()) as Channel[];
    }
    return this.list;
  }

  /** Canal temático por nombre; los de las categorías de GIRA ganan a homónimos de fuera. */
  async byName(name: string): Promise<Channel | undefined> {
    const all = await this.channels();
    const giraCats = new Set(all.filter((c) => c.type === 4 && GIRA_CATEGORIES.has(c.name)).map((c) => c.id));
    const matches = all.filter((c) => c.name === name && (c.type === 0 || c.type === 5));
    return matches.find((c) => giraCats.has(c.parent_id ?? "")) ?? matches[0];
  }

  /** Categoría base ("🎤 GIRAS") o la siguiente con hueco ("🎤 GIRAS 2"…), creándola si hace falta. */
  async categoryWithRoom(base: string): Promise<string> {
    const all = await this.channels();
    const cats = all.filter((c) => c.type === 4 && (c.name === base || c.name.startsWith(`${base} `)));
    for (const c of cats) if (all.filter((x) => x.parent_id === c.id).length < PER_CATEGORY) return c.id;
    const name = cats.length ? `${base} ${cats.length + 1}` : base;
    const res = await discordFetch(this.env, "POST", `/guilds/${this.env.DISCORD_GUILD_ID}/channels`, { name, type: 4 });
    if (!res.ok) throw new Error(`Discord crear categoría HTTP ${res.status}`);
    const created = (await res.json()) as { id: string };
    all.push({ id: created.id, name, type: 4, parent_id: null });
    return created.id;
  }

  async createText(name: string, parent: string, topic: string): Promise<string> {
    const res = await discordFetch(this.env, "POST", `/guilds/${this.env.DISCORD_GUILD_ID}/channels`, { name, type: 0, parent_id: parent, topic });
    if (!res.ok) throw new Error(`Discord crear canal HTTP ${res.status}`);
    const { id } = (await res.json()) as { id: string };
    (await this.channels()).push({ id, name, type: 0, parent_id: parent });
    return id;
  }

  async count(): Promise<number> {
    return (await this.channels()).length;
  }

  async remove(channelId: string): Promise<void> {
    const res = await discordFetch(this.env, "DELETE", `/channels/${channelId}`);
    if (!res.ok && res.status !== 404) throw new Error(`Discord borrar canal HTTP ${res.status}`);
    this.list = (await this.channels()).filter((c) => c.id !== channelId);
  }

  async move(channelId: string, parent: string): Promise<void> {
    const res = await discordFetch(this.env, "PATCH", `/channels/${channelId}`, { parent_id: parent });
    if (!res.ok) throw new Error(`Discord mover canal HTTP ${res.status}`);
    const c = (await this.channels()).find((x) => x.id === channelId);
    if (c) c.parent_id = parent;
  }
}

interface SheetRow {
  artist_id: string;
  channel_id: string;
  message_ids: string;
  content_hash: string | null;
  status: "active" | "archived";
  tracked_sale: number;
}

const placeholders = (n: number) => Array.from({ length: n }, () => "?").join(",");

/** Aforos, precios y reventa guardados por los trabajos de enriquecimiento. */
async function loadExtras(env: Env, artistId: string, shows: Show[]): Promise<SheetExtras> {
  const venueIds = [...new Set(shows.map((s) => s.venue.tmId))].slice(0, 90);
  const showIds = shows.map((s) => s.sourceId).slice(0, 90);
  const [v, p, r, sg, hp] = await env.DB.batch([
    env.DB.prepare(`SELECT tm_venue_id, capacity FROM venue_info WHERE capacity IS NOT NULL AND tm_venue_id IN (${placeholders(venueIds.length)})`).bind(...venueIds),
    env.DB.prepare(`SELECT source_id, min, max, currency, source, zones_json FROM show_price WHERE source_id IN (${placeholders(showIds.length)})`).bind(...showIds),
    env.DB.prepare("SELECT json FROM artist_resale WHERE artist_id = ?").bind(artistId),
    env.DB.prepare("SELECT url, label, city, local_date FROM artist_signup WHERE artist_id = ? ORDER BY local_date, url").bind(artistId),
    env.DB.prepare("SELECT homepage FROM artist WHERE id = ?").bind(artistId),
  ]);
  const signups: SignupLink[] = ((sg!.results ?? []) as { url: string; label: string; city: string | null; local_date: string | null }[]).map((x) => ({
    url: x.url,
    label: x.label,
    city: x.city,
    localDate: x.local_date,
  }));
  const homepage = ((hp!.results ?? [])[0] as { homepage: string | null } | undefined)?.homepage ?? null;
  const venues: Record<string, VenueInfo> = {};
  for (const row of (v!.results ?? []) as { tm_venue_id: string; capacity: number }[]) venues[row.tm_venue_id] = { capacity: row.capacity };
  const prices: Record<string, PriceInfo> = {};
  for (const row of (p!.results ?? []) as (PriceInfo & { source_id: string; zones_json: string | null })[]) {
    prices[row.source_id] = { min: row.min, max: row.max, currency: row.currency, source: row.source, ...(row.zones_json ? { zones: JSON.parse(row.zones_json) } : {}) };
  }
  const resaleRow = (r!.results ?? [])[0] as { json: string } | undefined;
  return { venues, prices, signups, homepage, resale: resaleRow ? (JSON.parse(resaleRow.json) as ResaleInfo) : null };
}

const dayFmt = new Intl.DateTimeFormat("es-ES", { timeZone: MADRID, weekday: "short", day: "numeric", month: "short" });
const clean = (s: string) => s.replace(/\./g, "").replace(/,/g, "").replace(/\s+/g, " ").trim();

/** Un único aviso por artista y ejecución, con enlace a su canal. */
function noticeText(name: string, alerts: Alert[], shows: Show[], channelId: string, now: Date): string {
  const n = (k: Alert["kind"]) => alerts.filter((a) => a.kind === k).length;
  const parts: string[] = [];
  if (n("new_event")) parts.push(`${n("new_event")} ${n("new_event") === 1 ? "fecha nueva" : "fechas nuevas"}`);
  if (n("extra_date")) parts.push(`${n("extra_date")} ${n("extra_date") === 1 ? "fecha extra" : "fechas extra"}`);
  if (n("sale_added")) parts.push(`${n("sale_added")} ${n("sale_added") === 1 ? "venta nueva" : "ventas nuevas"}`);
  if (n("sale_changed")) parts.push(`${n("sale_changed")} ${n("sale_changed") === 1 ? "cambio de hora" : "cambios de hora"}`);
  if (n("status_changed")) parts.push("cambio de estado (cancelación o aplazamiento)");
  const icon = n("extra_date") ? "➕" : n("new_event") ? "🆕" : n("status_changed") ? "⚠️" : "🎟️";
  const ids = new Set(alerts.map((a) => a.sourceId));
  const places = [...new Set(shows.filter((s) => ids.has(s.sourceId)).map((s) => `${flag(s.venue.country)} ${s.venue.city}`))].slice(0, 6);
  const next = shows
    .flatMap((s) => s.sales)
    .filter((w) => w.startsAt && Date.parse(w.startsAt) > now.getTime())
    .sort((a, b) => a.startsAt!.localeCompare(b.startsAt!))[0];
  const nextTxt = next ? ` · próxima venta: **${clean(dayFmt.format(new Date(next.startsAt!)))}, ${formatHHmm(next.startsAt!, MADRID)}** (Madrid) — ${next.label}` : "";
  return `${icon} **${name}** · ${parts.join(" · ")}${places.length ? ` (${places.join(", ")})` : ""}${nextTxt} → <#${channelId}>`;
}

/**
 * Publica las fichas de los artistas pendientes: crea su canal si tienen ventas por llegar, edita
 * la ficha si cambió, envía un aviso agrupado y archiva el canal cuando pasa la gira.
 */
export async function publishSheets(env: Env, now: Date, maxDiscordArtists = 4, maxScan = 25): Promise<{ updated: number; notices: number }> {
  if (env.DELIVERY_PAUSED === "1") return { updated: 0, notices: 0 };
  // Reclamo atómico: dos ejecuciones simultáneas nunca trabajan el mismo artista (ni crean dos canales).
  const { results: dirty } = await env.DB.prepare(
    `DELETE FROM sheet_dirty WHERE artist_id IN (
       SELECT d.artist_id FROM sheet_dirty d LEFT JOIN follow f ON f.artist_id = d.artist_id
       ORDER BY COALESCE(f.tier, 1) DESC, d.since LIMIT ?) RETURNING artist_id, since`,
  )
    .bind(maxScan)
    .all<{ artist_id: string; since: string }>();
  if (!dirty.length) return { updated: 0, notices: 0 };
  const requeue = (rows: { artist_id: string; since: string }[]) =>
    rows.length
      ? env.DB.batch(rows.map((r) => env.DB.prepare("INSERT OR IGNORE INTO sheet_dirty (artist_id, since) VALUES (?, ?)").bind(r.artist_id, r.since)))
      : Promise.resolve([]);

  const guild = new Guild(env);
  const today = localDateIn(now, MADRID);
  const iso = now.toISOString();
  let touched = 0;
  let notices = 0;

  for (let i = 0; i < dirty.length; i++) {
    const { artist_id } = dirty[i]!;
    try {
    const artist = await env.DB.prepare("SELECT name FROM artist WHERE id = ?").bind(artist_id).first<{ name: string }>();
    const { results: rows } = await env.DB.prepare("SELECT snapshot_json FROM show WHERE artist_id = ? AND local_date >= ? AND is_package = 0")
      .bind(artist_id, today)
      .all<{ snapshot_json: string }>();
    const shows = artist ? sheetShows(artist.name, rows.map((r) => JSON.parse(r.snapshot_json) as Show)) : [];
    const sheet = await env.DB.prepare("SELECT * FROM sheet WHERE artist_id = ?").bind(artist_id).first<SheetRow>();
    // Solo interesa lo accionable: canal mientras quede alguna preventa o venta general por llegar.
    const active = isSheetActive(shows, now);

    if (!artist || (!active && sheet?.status !== "active")) {
      await env.DB.prepare("UPDATE delivery SET status = 'failed', last_error = 'sin ventas por llegar' WHERE artist_id = ? AND status = 'pending'").bind(artist_id).run();
      continue;
    }
    if (++touched > maxDiscordArtists) {
      await requeue(dirty.slice(i));
      break;
    }

    // Ya no queda ninguna venta por llegar: si GIRA la siguió, el canal pasa a 📦 ARCHIVO; si nunca la
    // tuvo (canal creado por error), se borra.
    if (!active && sheet) {
      if (sheet.tracked_sale) {
        await guild.move(sheet.channel_id, await guild.categoryWithRoom(ARCHIVO));
        await env.DB.prepare("UPDATE sheet SET status = 'archived', updated_at = ? WHERE artist_id = ?").bind(iso, artist_id).run();
      } else {
        await guild.remove(sheet.channel_id);
        await env.DB.prepare("DELETE FROM sheet WHERE artist_id = ?").bind(artist_id).run();
      }
      await env.DB.prepare("UPDATE delivery SET status = 'failed', last_error = 'sin ventas por llegar' WHERE artist_id = ? AND status = 'pending'").bind(artist_id).run();
      continue;
    }

    const sport = topicOf(shows[0]!) !== "music" && topicOf(shows[0]!) !== "other";
    const base = sport ? DEPORTES : GIRAS;

    let channelId = sheet?.channel_id;
    if (!channelId) {
      // Servidor lleno: se borra el canal archivado más antiguo; si no hay ninguno, se espera.
      if ((await guild.count()) >= GUILD_CHANNEL_CAP) {
        const oldest = await env.DB.prepare("SELECT artist_id, channel_id FROM sheet WHERE status = 'archived' ORDER BY updated_at LIMIT 1").first<{
          artist_id: string;
          channel_id: string;
        }>();
        if (!oldest) {
          console.log(`publishSheets: servidor lleno, ${artist.name} espera`);
          continue;
        }
        await guild.remove(oldest.channel_id);
        await env.DB.prepare("DELETE FROM sheet WHERE artist_id = ?").bind(oldest.artist_id).run();
      }
      channelId = await guild.createText(channelSlug(artist.name), await guild.categoryWithRoom(base), `Ficha de ${artist.name} · GIRA (solo información)`);
      await env.DB.prepare("INSERT INTO sheet (artist_id, channel_id, updated_at) VALUES (?, ?, ?)").bind(artist_id, channelId, iso).run();
    } else if (sheet?.status === "archived") {
      await guild.move(channelId, await guild.categoryWithRoom(base));
      await env.DB.prepare("UPDATE sheet SET status = 'active' WHERE artist_id = ?").bind(artist_id).run();
    }

    // Ficha: editar los mensajes existentes en vez de publicar otros nuevos.
    const msgs = renderArtistSheet({ name: artist.name }, shows, now, await loadExtras(env, artist_id, shows));
    const hash = stableHash(msgs.join("\u0000").replace(/-# Actualizado <t:\d+:R>/, ""));
    if (hash !== sheet?.content_hash) {
      const ids: string[] = JSON.parse(sheet?.message_ids ?? "[]");
      const next: string[] = [];
      for (let i = 0; i < msgs.length; i++) {
        const body = { content: msgs[i], allowed_mentions: { parse: [] } };
        if (ids[i]) {
          const r = await discordFetch(env, "PATCH", `/channels/${channelId}/messages/${ids[i]}`, body);
          if (r.ok) {
            next.push(ids[i]!);
            continue;
          }
        }
        const r = await discordFetch(env, "POST", `/channels/${channelId}/messages`, body);
        if (!r.ok) throw new Error(`Discord publicar ficha HTTP ${r.status}`);
        next.push(((await r.json()) as { id: string }).id);
      }
      for (const old of ids.slice(msgs.length)) await discordFetch(env, "DELETE", `/channels/${channelId}/messages/${old}`);
      await env.DB.prepare("UPDATE sheet SET message_ids = ?, content_hash = ?, tracked_sale = 1, updated_at = ? WHERE artist_id = ?")
        .bind(JSON.stringify(next), hash, iso, artist_id)
        .run();
    } else if (!sheet?.tracked_sale) {
      await env.DB.prepare("UPDATE sheet SET tracked_sale = 1 WHERE artist_id = ?").bind(artist_id).run();
    }

    // Aviso agrupado (uno por artista) en el canal temático, con enlace al canal del artista.
    const { results: claimed } = await env.DB.prepare(
      "UPDATE delivery SET status = 'sending', claimed_at = ? WHERE artist_id = ? AND status = 'pending' RETURNING id, alert_id, channel",
    )
      .bind(iso, artist_id)
      .all<{ id: number; alert_id: number; channel: string }>();
    if (claimed.length) {
      const { results: payloads } = await env.DB.prepare(`SELECT payload_json FROM alert WHERE id IN (${claimed.map(() => "?").join(",")})`)
        .bind(...claimed.map((c) => c.alert_id))
        .all<{ payload_json: string }>();
      // Solo avisos de fechas que están en la ficha (nada de hoteles, festivales ajenos ni ventas pasadas).
      const inSheet = new Set(shows.filter((s) => s.sales.some((w) => w.kind !== "official_resale" && (!w.startsAt || Date.parse(w.startsAt) > now.getTime()))).map((s) => s.sourceId));
      const alerts = payloads.map((p) => (JSON.parse(p.payload_json) as { alert: Alert }).alert).filter((a) => inSheet.has(a.sourceId));
      const channels = claimed.map((c) => c.channel);
      const target =
        channels.find((c) => SPORT_CHANNELS.has(c)) ??
        (alerts.some((a) => a.kind === "extra_date") ? "fechas-extra" : alerts.some((a) => a.kind === "new_event") ? "nuevas-giras" : "preventas");
      const dest = await guild.byName(target);
      const ids = claimed.map((c) => c.id);
      const mark = (status: string, err: string | null) =>
        env.DB.prepare(`UPDATE delivery SET status = ?, attempts = attempts + 1, sent_at = ?, last_error = ? WHERE id IN (${ids.map(() => "?").join(",")})`)
          .bind(status, status === "sent" ? iso : null, err, ...ids)
          .run();
      if (!alerts.length) {
        await mark("failed", "fuera de la ficha");
      } else if (!dest) {
        await mark("failed", `sin canal #${target}`);
      } else {
        const urgent = alerts.some((a) => decideDelivery(a, now) === "now");
        const res = await discordFetch(env, "POST", `/channels/${dest.id}/messages`, {
          content: noticeText(artist.name, alerts, shows, channelId, now),
          allowed_mentions: { parse: [] },
          ...(urgent ? {} : { flags: 4096 }),
        });
        // Un fallo (p. ej. 429) no gasta intentos: el catch lo devuelve a pendiente y reencola al artista.
        if (!res.ok) throw new Error(`Discord aviso HTTP ${res.status}`);
        await mark("sent", null);
        notices++;
      }
    }
    } catch (e) {
      // Discord falló (p. ej. 429): este artista y los que faltan vuelven a la cola; nada se pierde.
      await env.DB.prepare("UPDATE delivery SET status = 'pending' WHERE artist_id = ? AND status = 'sending'").bind(artist_id).run();
      await requeue(dirty.slice(i));
      console.log(`publishSheets: ${String(e)}`);
      break;
    }
  }
  return { updated: Math.min(touched, maxDiscordArtists), notices };
}
