import { LN_EVENT_URL, withExtraSales, type LnSale, type Show } from "@gira/core";
import type { Env } from "./env";
import { pushAll } from "./push";

/**
 * Preventas que solo publica Live Nation en sus páginas de evento (p. ej. "Preventa Registrados
 * LiveNation.es"): el trabajo de GitHub lee las páginas de ln_event y manda aquí lo que encuentra; se
 * guarda por fecha de Ticketmaster y se une a fichas, avisos y recordatorios.
 */
export async function lnPages(env: Env, now: Date): Promise<{ urls: string[] }> {
  const { results } = await env.DB.prepare("SELECT url FROM ln_event WHERE last_date IS NULL OR last_date >= ? ORDER BY COALESCE(last_read_at, '') LIMIT 60")
    .bind(now.toISOString())
    .all<{ url: string }>();
  return { urls: results.map((r) => r.url) };
}

export async function addLnPage(env: Env, url: string, now: Date): Promise<boolean> {
  if (!LN_EVENT_URL.test(url)) return false;
  await env.DB.prepare("INSERT OR IGNORE INTO ln_event (url, added_at) VALUES (?, ?)").bind(url, now.toISOString()).run();
  return true;
}

type Page = { url: string; siblings?: string[]; lastDate?: string | null; sales?: LnSale[] };

export async function ingestLnSales(env: Env, body: { pages?: Page[] }, now: Date): Promise<{ pages: number; added: number }> {
  const iso = now.toISOString();
  let added = 0;
  const fresh: string[] = [];
  for (const p of (body.pages ?? []).slice(0, 80)) {
    if (!LN_EVENT_URL.test(p.url)) continue;
    await env.DB.prepare("UPDATE ln_event SET last_read_at = ?, last_date = ? WHERE url = ?").bind(iso, p.lastDate ?? null, p.url).run();
    for (const s of (p.siblings ?? []).slice(0, 40)) if (LN_EVENT_URL.test(s)) await env.DB.prepare("INSERT OR IGNORE INTO ln_event (url, added_at) VALUES (?, ?)").bind(s, iso).run();
    for (const s of (p.sales ?? []).slice(0, 20)) {
      if (!s.tmEventId || !/^[0-9A-Za-z]{6,20}$/.test(s.tmEventId) || Number.isNaN(Date.parse(s.startsAt)) || Date.parse(s.startsAt) <= now.getTime()) continue;
      const show = await env.DB.prepare(
        "SELECT s.source_id, s.artist_id, a.name FROM show s JOIN artist a ON a.id = s.artist_id WHERE json_extract(s.snapshot_json, '$.url') LIKE ? AND s.local_date >= ? LIMIT 1",
      )
        .bind(`%/${s.tmEventId}%`, iso.slice(0, 10))
        .first<{ source_id: string; artist_id: string; name: string }>();
      if (!show) continue;
      const r = await env.DB.prepare("INSERT OR IGNORE INTO show_extra_sale (source_id, label, starts_at, url, found_at) VALUES (?, ?, ?, ?, ?)")
        .bind(show.source_id, s.label.slice(0, 120), new Date(s.startsAt).toISOString(), p.url, iso)
        .run();
      if (!r.meta.changes) continue;
      added++;
      await env.DB.prepare("INSERT OR IGNORE INTO sheet_dirty (artist_id, since) VALUES (?, ?)").bind(show.artist_id, iso).run();
      fresh.push(`${show.name} · ${s.label}`);
    }
  }
  if (fresh.length) await pushAll(env, { title: "🎟️ Preventa de Live Nation", body: [...new Set(fresh)].slice(0, 3).join(" · "), tag: "livenation" }).catch(() => 0);
  return { pages: body.pages?.length ?? 0, added };
}

/** Une a cada fecha las ventas que solo publica Live Nation. */
export async function attachExtraSales(env: Env, shows: Show[]): Promise<Show[]> {
  const ids = shows.map((s) => s.sourceId).slice(0, 90);
  if (!ids.length) return shows;
  const { results } = await env.DB.prepare(`SELECT source_id, label, starts_at, url FROM show_extra_sale WHERE source_id IN (${ids.map(() => "?").join(",")})`)
    .bind(...ids)
    .all<{ source_id: string; label: string; starts_at: string; url: string | null }>();
  if (!results.length) return shows;
  return shows.map((s) => withExtraSales(s, results.filter((r) => r.source_id === s.sourceId).map((r) => ({ label: r.label, startsAt: r.starts_at, url: r.url }))));
}
