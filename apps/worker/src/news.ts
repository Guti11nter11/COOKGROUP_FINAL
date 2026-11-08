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
/** Lo que también va al canal del artista (cambia cómo conseguir entradas). */
const IMPORTANT = new Set(["tour_announced", "extra_date", "presale", "signup", "on_sale"]);

/** Guarda noticias nuevas y las publica: todas en #noticias; las importantes también en el canal del artista. */
export async function ingestNews(env: Env, body: NewsInput, now: Date): Promise<{ stored: number; posted: number }> {
  const iso = now.toISOString();
  const items = (body.items ?? []).filter((n) => /^https?:\/\//.test(n.url) && n.artistName && n.summary && ICON[n.category]).slice(0, 60);
  const fresh: (NewsInput["items"][number] & { artistId: string | null; channelId: string | null })[] = [];
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
  if (!fresh.length || env.DELIVERY_PAUSED === "1") return { stored: fresh.length, posted: 0 };

  try {
    return { stored: fresh.length, posted: await postNews(env, fresh, now) };
  } catch (e) {
    console.log(`noticias: ${String(e)}`); // guardadas igualmente (la PWA las verá)
    return { stored: fresh.length, posted: 0 };
  }
}

async function postNews(env: Env, fresh: (NewsInput["items"][number] & { artistId: string | null; channelId: string | null })[], now: Date): Promise<number> {
  const guild = new Guild(env);
  const silent = isQuietTime(now);
  const line = (n: (typeof fresh)[number]) =>
    `${ICON[n.category]} **${n.artistName}** · ${n.summary}${n.channelId ? ` → <#${n.channelId}>` : ""} — [${n.source || "fuente"}](<${n.url}>)`;
  let posted = 0;
  const ch = await guild.byName("noticias");
  if (ch) {
    let msg = "";
    const flush = async () => {
      if (!msg) return;
      if ((await discordFetch(env, "POST", `/channels/${ch.id}/messages`, { content: msg, allowed_mentions: { parse: [] }, ...(silent ? { flags: 4096 } : {}) })).ok) posted++;
      msg = "";
    };
    for (const n of fresh) {
      const l = line(n);
      if (msg.length + l.length + 1 > 1900) await flush();
      msg += (msg ? "\n" : "") + l;
    }
    await flush();
  }
  for (const n of fresh.filter((x) => x.channelId && IMPORTANT.has(x.category)).slice(0, 6)) {
    await discordFetch(env, "POST", `/channels/${n.channelId}/messages`, {
      content: `${ICON[n.category]} **Novedad:** ${n.summary} — [${n.source || "fuente"}](<${n.url}>)`,
      allowed_mentions: { parse: [] },
      ...(silent ? { flags: 4096 } : {}),
    });
  }
  // Push al iPhone de lo importante (registros, preventas, fechas extra); de noche, nada.
  if (!silent) {
    for (const n of fresh.filter((x) => IMPORTANT.has(x.category)).slice(0, 3)) {
      await pushAll(env, { title: `${ICON[n.category]} ${n.artistName}`, body: n.summary, url: "/app/#noticias", tag: `news-${n.artistName}`.slice(0, 30) }).catch(() => 0);
    }
  }
  return posted;
}
