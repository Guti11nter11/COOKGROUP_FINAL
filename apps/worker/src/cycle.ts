import {
  channelFor,
  detectAlerts,
  localDateIn,
  MADRID,
  normalizeTmEvent,
  planSweep,
  renderAlertMessage,
  showKey,
  stableHash,
  type Alert,
  type Show,
} from "@gira/core";
import { discordFetch } from "./discord-client";
import type { Env, SweepJob } from "./env";
import {
  bumpQuota,
  getChannelIds,
  getFollows,
  getFollowsByAttraction,
  loadShows,
  loadShowStats,
  quotaToday,
  TM_BRAKE,
} from "./repo";
import { fetchTmPage, RateLimited } from "./tm-client";

export type Send = (job: SweepJob) => Promise<void>;

/** Países de la Fase 1: Europa incluido Reino Unido. */
export const PHASE1_COUNTRIES = new Set(
  "GB IE ES PT FR DE IT NL BE LU AT CH DK SE NO FI PL CZ HU GR HR RO SK SI BG EE LV LT IS MT CY RS TR".split(" "),
);
const MAX_PAGES = 10;
/** Fechas vistas hace menos de esto forman parte del mismo anuncio (no cuentan como "ya conocidas"). */
const SAME_ANNOUNCEMENT_MS = 30 * 60 * 1000;
const day = (now: Date) => now.toISOString().slice(0, 10);

/** Cron: planifica el barrido y encola una página por lote. */
export async function runCycle(env: Env, now: Date, send: Send): Promise<{ jobs: number; stoppedBy?: "quota" }> {
  if ((await quotaToday(env.DB, "ticketmaster", day(now))) >= TM_BRAKE) return { jobs: 0, stoppedBy: "quota" };
  const batches = planSweep(await getFollows(env.DB, now.toISOString()), now);
  for (const ids of batches) await send({ ids, page: 0 });
  return { jobs: batches.length };
}

/** Cola: procesa una página de Ticketmaster (cabe en los 10 ms de CPU del plan gratuito). */
export async function processPage(
  env: Env,
  job: SweepJob,
  now: Date,
  send: Send,
): Promise<{ calls: number; shows: number; alerts: number; stoppedBy?: "quota" | "rate_limit" }> {
  const today = day(now);
  if ((await quotaToday(env.DB, "ticketmaster", today)) >= TM_BRAKE) return { calls: 0, shows: 0, alerts: 0, stoppedBy: "quota" };

  let fetched;
  try {
    fetched = await fetchTmPage(job.ids, job.page, env);
  } catch (e) {
    await bumpQuota(env.DB, "ticketmaster", today, 1).run();
    if (e instanceof RateLimited) return { calls: 1, shows: 0, alerts: 0, stoppedBy: "rate_limit" };
    throw e;
  }

  const lastPage = Math.min(fetched.totalPages, MAX_PAGES) - 1;
  if (job.page === 0) for (let p = 1; p <= lastPage; p++) await send({ ids: job.ids, page: p });

  const nowIso = now.toISOString();
  const todayMadrid = localDateIn(now, MADRID);
  const follows = await getFollowsByAttraction(env.DB, job.ids);
  const shows: { show: Show; artistId: string }[] = [];
  for (const raw of fetched.events) {
    const show = normalizeTmEvent(raw);
    if (!show || !PHASE1_COUNTRIES.has(show.venue.country) || show.localDate < todayMadrid) continue;
    const followId = show.attractionIds.find((id) => follows.has(id));
    if (followId) shows.push({ show, artistId: follows.get(followId)!.artistId });
  }

  const stored = await loadShows(env.DB, shows.map((s) => s.show.sourceId));
  const stats = await loadShowStats(env.DB, [...new Set(shows.map((s) => s.artistId))]);
  const knownBefore = now.getTime() - SAME_ANNOUNCEMENT_MS;
  const stmts: D1PreparedStatement[] = [bumpQuota(env.DB, "ticketmaster", today, 1)];
  let alertCount = 0;

  for (const { show, artistId } of shows) {
    const hash = stableHash(JSON.stringify(show));
    const old = stored.get(show.sourceId);
    if (old?.hash === hash) continue;
    const follow = [...follows.values()].find((f) => f.artistId === artistId)!;
    const key = showKey(show);
    const prev = old ? (JSON.parse(old.snapshot_json) as Show) : null;
    const others = stats.filter((r) => r.artist_id === artistId && r.source_id !== show.sourceId);
    const sameDateListed = !prev && others.some((r) => r.show_key === key);
    const knownDatesInCountry = new Set(
      others
        .filter((r) => r.country === show.venue.country && r.is_package === 0 && Date.parse(r.first_seen_at) < knownBefore)
        .map((r) => r.show_key),
    ).size;
    const alerts: Alert[] = sameDateListed
      ? []
      : detectAlerts(prev, show, { bootstrap: !follow.bootstrapped, knownDatesInCountry, artistName: follow.name, tier: follow.tier });

    stmts.push(
      env.DB.prepare(
        `INSERT INTO show (source_id, show_key, artist_id, country, local_date, is_package, hash, snapshot_json, first_seen_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (source_id) DO UPDATE SET show_key = excluded.show_key, country = excluded.country, local_date = excluded.local_date,
           is_package = excluded.is_package, hash = excluded.hash, snapshot_json = excluded.snapshot_json, updated_at = excluded.updated_at`,
      ).bind(show.sourceId, key, artistId, show.venue.country, show.localDate, show.isPackage ? 1 : 0, hash, JSON.stringify(show), nowIso, nowIso),
    );
    for (const a of alerts) {
      alertCount++;
      stmts.push(
        env.DB.prepare("INSERT OR IGNORE INTO alert (dedupe_key, kind, source_id, payload_json, created_at) VALUES (?, ?, ?, ?, ?)").bind(
          a.dedupeKey, a.kind, a.sourceId, JSON.stringify({ alert: a, show }), nowIso,
        ),
        env.DB.prepare("INSERT OR IGNORE INTO delivery (alert_id, channel) SELECT id, ? FROM alert WHERE dedupe_key = ?").bind(channelFor(a.kind), a.dedupeKey),
      );
    }
  }

  if (job.page === lastPage || lastPage < 0) {
    const ids = [...follows.values()].map((f) => f.artistId);
    if (ids.length) {
      stmts.push(
        env.DB.prepare(
          `UPDATE follow SET bootstrapped_at = ? WHERE bootstrapped_at IS NULL AND artist_id IN (${ids.map(() => "?").join(",")})`,
        ).bind(nowIso, ...ids),
      );
    }
  }
  await env.DB.batch(stmts);
  return { calls: 1, shows: shows.length, alerts: alertCount };
}

const CHANNEL_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 5;

async function channelIds(env: Env, now: Date): Promise<Map<string, string>> {
  const cached = await getChannelIds(env.DB);
  const fresh = [...cached.values()].some((c) => now.getTime() - Date.parse(c.fetchedAt) < CHANNEL_TTL_MS);
  if (cached.size && fresh) return new Map([...cached].map(([k, v]) => [k, v.id]));
  const res = await discordFetch(env, "GET", `/guilds/${env.DISCORD_GUILD_ID}/channels`);
  if (!res.ok) throw new Error(`Discord canales HTTP ${res.status}`);
  const list = (await res.json()) as { id: string; name: string; type: number }[];
  const text = list.filter((c) => c.type === 0 || c.type === 5);
  const iso = now.toISOString();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM discord_channel"),
    ...text.map((c) => env.DB.prepare("INSERT INTO discord_channel (name, channel_id, fetched_at) VALUES (?, ?, ?)").bind(c.name, c.id, iso)),
  ]);
  return new Map(text.map((c) => [c.name, c.id]));
}

/** Envía a Discord los avisos pendientes. Un 429 detiene el envío hasta el ciclo siguiente. */
export async function deliverPending(env: Env, now: Date, limit = 20): Promise<number> {
  const { results } = await env.DB.prepare(
    `SELECT d.id, d.channel, d.attempts, a.payload_json FROM delivery d JOIN alert a ON a.id = d.alert_id
     WHERE d.status = 'pending' ORDER BY d.id LIMIT ?`,
  )
    .bind(limit)
    .all<{ id: number; channel: string; attempts: number; payload_json: string }>();
  if (!results.length) return 0;

  const ids = await channelIds(env, now);
  let sent = 0;
  for (const d of results) {
    const channelId = ids.get(d.channel);
    const { alert, show } = JSON.parse(d.payload_json) as { alert: Alert; show: Show };
    const res = channelId
      ? await discordFetch(env, "POST", `/channels/${channelId}/messages`, renderAlertMessage(alert, show, now))
      : null;
    const attempts = d.attempts + 1;
    if (res?.ok) {
      await env.DB.prepare("UPDATE delivery SET status = 'sent', attempts = ?, sent_at = ? WHERE id = ?").bind(attempts, now.toISOString(), d.id).run();
      sent++;
      continue;
    }
    const error = res ? `HTTP ${res.status}` : `sin canal #${d.channel}`;
    const status = attempts >= MAX_ATTEMPTS ? "failed" : "pending";
    await env.DB.prepare("UPDATE delivery SET status = ?, attempts = ?, last_error = ? WHERE id = ?").bind(status, attempts, error, d.id).run();
    if (res?.status === 429) break;
  }
  return sent;
}
