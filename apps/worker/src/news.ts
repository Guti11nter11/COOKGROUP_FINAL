import { isQuietTime } from "@gira/core";
import { discordFetch } from "./discord-client";
import type { Env } from "./env";
import { pushAll } from "./push";
import { Guild } from "./sheets";

export interface NewsInput {
  items: { artistName: string; title: string; url: string; source?: string; category: string; summary: string; publishedAt?: string | null }[];
}

const ICON: Record<string, string> = {
  tour_announced: "🆕", extra_date: "➕", presale: "🎟️", signup: "📝", on_sale: "🛒", sold_out: "🔥", price: "💶",
};
/** Lo que merece un aviso: cambia cómo o cuándo conseguir entradas. */
const IMPORTANT = new Set(["tour_announced", "extra_date", "presale", "signup", "on_sale"]);

type Fresh = NewsInput["items"][number] & { artistId: string | null; channelId: string | null };

/**
 * Guarda las noticias nuevas (la app las ve todas) y publica en #noticias solo las importantes de
 * artistas sin ficha activa: lo que ya está en una ficha no se repite, y nunca va al canal del artista.
 */
export async function ingestNews(env: Env, body: NewsInput, now: Date): Promise<{ stored: number; posted: number }> {
  const iso = now.toISOString();
  const items = (body.items ?? []).filter((n) => /^https?:\/\//.test(n.url) && n.artistName && n.summary && ICON[n.category]).slice(0, 60);
  const fresh: Fresh[] = [];
  for (const n of items) {
    const a = await env.DB.prepare(
      "SELECT a.id, h.channel_id FROM artist a LEFT JOIN sheet h ON h.artist_id = a.id AND h.status = 'active' WHERE lower(a.name) = lower(?) LIMIT 1",
    )
      .bind(n.artistName)
      .first<{ id: string; channel_id: string | null }>();
    const r = await env.DB.prepare(
      `INSERT OR IGNORE INTO news (url, artist_id, artist_name, title, source, category, summary, published_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(n.url, a?.id ?? null, n.artistName, n.title.slice(0, 300), n.source ?? null, n.category, n.summary.slice(0, 300), n.publishedAt ?? null, iso)
      .run();
    if (r.meta.changes) fresh.push({ ...n, artistId: a?.id ?? null, channelId: a?.channel_id ?? null });
  }
  const worth = newsWorthPosting(fresh);
  if (!worth.length || env.DELIVERY_PAUSED === "1") return { stored: fresh.length, posted: 0 };
  try {
    return { stored: fresh.length, posted: await postNews(env, worth, now) };
  } catch (e) {
    console.log(`noticias: ${String(e)}`); // guardadas igualmente (la PWA las verá)
    return { stored: fresh.length, posted: 0 };
  }
}

/** Importantes, de artistas sin ficha activa (la ficha ya lo cuenta todo) y una por artista. */
export function newsWorthPosting<T extends { artistName: string; category: string; channelId: string | null }>(fresh: T[]): T[] {
  const seen = new Set<string>();
  return fresh.filter((n) => {
    if (!IMPORTANT.has(n.category) || n.channelId) return false;
    const k = n.artistName.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Una línea por noticia, sin fuente; solo los registros llevan enlace (hace falta para apuntarse). */
export const newsLine = (n: { artistName: string; category: string; summary: string; url: string }) =>
  `${ICON[n.category]} **${n.artistName}** · ${n.summary.replace(/\s*[—-]\s*\[[^\]]+\]\([^)]*\)\s*$/, "")}${n.category === "signup" ? ` · [más info](<${n.url}>)` : ""}`;

async function postNews(env: Env, fresh: Fresh[], now: Date): Promise<number> {
  const guild = new Guild(env);
  const silent = isQuietTime(now);
  let posted = 0;
  const ch = await guild.byName("noticias");
  if (ch) {
    let msg = "";
    const flush = async () => {
      if (!msg) return;
      if ((await discordFetch(env, "POST", `/channels/${ch.id}/messages`, { content: msg, allowed_mentions: { parse: [] }, flags: silent ? 4096 | 4 : 4 })).ok) posted++;
      msg = "";
    };
    for (const n of fresh) {
      const l = newsLine(n);
      if (msg.length + l.length + 1 > 1900) await flush();
      msg += (msg ? "\n" : "") + l;
    }
    await flush();
  }
  // Push al iPhone de lo importante; de noche, nada.
  if (!silent) {
    for (const n of fresh.slice(0, 3)) {
      await pushAll(env, { title: `${ICON[n.category]} ${n.artistName}`, body: n.summary, url: "/app/#noticias", tag: `news-${n.artistName}`.slice(0, 30) }).catch(() => 0);
    }
  }
  return posted;
}
