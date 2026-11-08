import {
  channelFor,
  detectAlerts,
  localDateIn,
  MADRID,
  normalizeTmEvent,
  planSweep,
  semanticHash,
  topicOf,
  showKey,
  type Alert,
  type Show,
} from "@gira/core";
import type { Env, SweepJob } from "./env";
import {
  type FollowRow,
  bumpQuota,
  getFollows,
  getFollowsByAttraction,
  loadShows,
  loadShowStats,
  quotaToday,
  TM_BRAKE,
} from "./repo";
import { fetchTmPage, RateLimited } from "./tm-client";

export type Send = (job: SweepJob) => Promise<void>;

/** Países cubiertos: Europa incluido Reino Unido, Latinoamérica y EE. UU./Canadá (pedidos del propietario, 2026-11-08). */
export const COVERED_COUNTRIES = new Set(
  [
    "GB IE ES PT FR DE IT NL BE LU AT CH DK SE NO FI PL CZ HU GR HR RO SK SI BG EE LV LT IS MT CY RS TR",
    "MX BR AR CL CO PE UY PY BO EC VE CR PA GT HN SV NI DO PR",
    "US CA",
  ]
    .join(" ")
    .split(" "),
);
const DOMESTIC_SPORTS = new Set(["US", "CA"]);
/** Ticketmaster no pagina más allá de 1.000 resultados (size 50 → 20 páginas). */
const MAX_PAGES = 20;
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

/**
 * La zona América se activó el 2026-11-08: su primera media hora de barridos solo guarda lo que ya
 * estaba a la venta (línea base); a partir de ahí avisa de lo nuevo, como Europa.
 */
async function americaBaseline(env: Env, now: Date): Promise<boolean> {
  const row = await env.DB.prepare("SELECT value FROM setting WHERE key = 'america_baseline_until'").first<{ value: string }>();
  if (row) return now.toISOString() < row.value;
  const until = new Date(now.getTime() + 30 * 60_000).toISOString();
  await env.DB.prepare("INSERT OR IGNORE INTO setting (key, value) VALUES ('america_baseline_until', ?)").bind(until).run();
  return true;
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
    fetched = await fetchTmPage(job.ids, job.page, env, job.region ?? "eu");
  } catch (e) {
    await bumpQuota(env.DB, "ticketmaster", today, 1).run();
    if (e instanceof RateLimited) return { calls: 1, shows: 0, alerts: 0, stoppedBy: "rate_limit" };
    throw e;
  }

  // Páginas en cadena: cada página encola la siguiente solo tras procesarse, así el arranque
  // (bootstrap) se marca únicamente cuando todas las páginas del lote se han leído en orden.
  const lastPage = Math.min(fetched.totalPages, MAX_PAGES) - 1;

  const follows = await getFollowsByAttraction(env.DB, job.ids);
  const shows = fetched.events.map(normalizeTmEvent).filter((x): x is Show => x !== null);
  const baselineOnly = (job.region ?? "eu") === "am" && (await americaBaseline(env, now));
  const { stmts, stored, alerts: alertCount } = await storeShows(env, shows, follows, now, "api", baselineOnly);
  stmts.unshift(bumpQuota(env.DB, "ticketmaster", today, 1));
  const nowIso = now.toISOString();

  // El arranque se marca al terminar la última zona (América): así la primera lectura de cada zona
  // es solo línea base (sin avisos de lo que ya estaba a la venta).
  const region = job.region ?? "eu";
  const regionDone = job.page === lastPage || lastPage < 0;
  if (regionDone && region === "am") {
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
  if (job.page < lastPage) await send({ ids: job.ids, page: job.page + 1, region });
  else if (region === "eu") await send({ ids: job.ids, page: 0, region: "am" });
  return { calls: 1, shows: stored, alerts: alertCount };
}

/**
 * Compara fechas recién leídas (API o Discovery Feed) con D1 y prepara las escrituras: ficha,
 * avisos y entregas. Solo fechas futuras de la Fase 1 de entidades seguidas.
 */
export async function storeShows(
  env: Env,
  all: Show[],
  follows: Map<string, FollowRow>,
  now: Date,
  source: "api" | "feed",
  /** Primera lectura de una zona o país nuevo: se guarda como línea base, sin avisos. */
  baselineOnly = false,
): Promise<{ stmts: D1PreparedStatement[]; stored: number; alerts: number }> {
  const nowIso = now.toISOString();
  const todayMadrid = localDateIn(now, MADRID);
  const shows: { show: Show; follow: FollowRow }[] = [];
  for (const show of all) {
    if (!COVERED_COUNTRIES.has(show.venue.country) || show.localDate < todayMadrid) continue;
    // De EE. UU. y Canadá solo música: de NFL, NBA y demás interesan los partidos internacionales.
    if (DOMESTIC_SPORTS.has(show.venue.country) && show.segment === "Sports") continue;
    const followId = show.attractionIds.find((id) => follows.has(id));
    if (followId) shows.push({ show, follow: follows.get(followId)! });
  }

  const stored = await loadShows(env.DB, shows.map((s) => s.show.sourceId));
  const stats = await loadShowStats(env.DB, [...new Set(shows.map((s) => s.follow.artistId))], todayMadrid);
  const knownBefore = now.getTime() - SAME_ANNOUNCEMENT_MS;
  const stmts: D1PreparedStatement[] = [];
  let alertCount = 0;

  for (const { show, follow } of shows) {
    const artistId = follow.artistId;
    const hash = semanticHash(show);
    const old = stored.get(show.sourceId);
    const ownHash = old ? (source === "api" ? old.api_hash : old.feed_hash) : null;
    if (old && ownHash === hash) continue;
    const ownSnapshot = old ? (source === "api" ? old.api_snapshot : old.feed_snapshot) : null;
    const key = showKey(show);
    // Cada fuente se compara con su propia lectura anterior. Si la fecha ya existe pero esta fuente
    // no la había visto, esta lectura es solo su línea base (sin avisos).
    const prev = ownSnapshot ? (JSON.parse(ownSnapshot) as Show) : null;
    const baseline = !!old && !prev;
    const others = stats.filter((r) => r.artist_id === artistId && r.source_id !== show.sourceId);
    const sameDateListed = !old && !show.isPackage && others.some((r) => r.show_key === key && r.is_package === 0);
    const knownDatesInCountry = new Set(
      others
        .filter((r) => r.country === show.venue.country && r.is_package === 0 && Date.parse(r.first_seen_at) < knownBefore)
        .map((r) => r.show_key),
    ).size;
    const alerts: Alert[] =
      sameDateListed || baseline || baselineOnly
        ? []
        : detectAlerts(prev, show, { bootstrap: !(source === "feed" ? follow.feedBootstrapped : follow.bootstrapped), knownDatesInCountry, artistName: follow.name, tier: follow.tier, now });

    const snap = JSON.stringify(show);
    const col = source === "api" ? "api" : "feed";
    stmts.push(
      env.DB.prepare(
        `INSERT INTO show (source_id, show_key, artist_id, country, local_date, is_package, hash, snapshot_json, first_seen_at, updated_at, ${col}_hash, ${col}_snapshot)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (source_id) DO UPDATE SET show_key = excluded.show_key, country = excluded.country, local_date = excluded.local_date,
           is_package = excluded.is_package, hash = excluded.hash, snapshot_json = excluded.snapshot_json, updated_at = excluded.updated_at,
           ${col}_hash = excluded.${col}_hash, ${col}_snapshot = excluded.${col}_snapshot`,
      ).bind(show.sourceId, key, artistId, show.venue.country, show.localDate, show.isPackage ? 1 : 0, hash, snap, nowIso, nowIso, hash, snap),
    );
    if (show.price) {
      // Precio oficial de la ticketera; no pisa un precio de otra fuente revisada.
      stmts.push(
        env.DB.prepare(
          `INSERT INTO show_price (source_id, min, max, currency, source, updated_at) VALUES (?, ?, ?, ?, 'Ticketmaster', ?)
           ON CONFLICT (source_id) DO UPDATE SET min = excluded.min, max = excluded.max, currency = excluded.currency, updated_at = excluded.updated_at
           WHERE show_price.source = 'Ticketmaster'`,
        ).bind(show.sourceId, show.price.min, show.price.max, show.price.currency, nowIso),
      );
    }
    // La ficha del artista cambió: hay que regenerarla (y crear su canal si tiene ventas por llegar).
    stmts.push(env.DB.prepare("INSERT OR IGNORE INTO sheet_dirty (artist_id, since) VALUES (?, ?)").bind(artistId, nowIso));
    const channel = (a: Alert) => channelFor(a.kind, topicOf(show));
    for (const a of alerts) {
      alertCount++;
      stmts.push(
        env.DB.prepare("INSERT OR IGNORE INTO alert (dedupe_key, kind, source_id, payload_json, created_at) VALUES (?, ?, ?, ?, ?)").bind(
          a.dedupeKey, a.kind, a.sourceId, JSON.stringify({ alert: a, show }), nowIso,
        ),
        env.DB.prepare("INSERT OR IGNORE INTO delivery (alert_id, channel, artist_id) SELECT id, ?, ? FROM alert WHERE dedupe_key = ?").bind(channel(a), artistId, a.dedupeKey),
      );
    }
  }
  return { stmts, stored: shows.length, alerts: alertCount };
}

/** Ingesta desde el Discovery Feed (GitHub Actions): fechas normalizadas y marcas de arranque. */
export async function ingestShows(
  env: Env,
  body: { shows?: Show[]; markBootstrapped?: string[]; baseline?: boolean },
  now: Date,
): Promise<{ stored: number; alerts: number }> {
  const shows = (body.shows ?? []).slice(0, 80);
  const ids = [...new Set(shows.flatMap((s) => s.attractionIds ?? []))];
  const follows = await getFollowsByAttraction(env.DB, ids);
  const { stmts, stored, alerts } = await storeShows(env, shows, follows, now, "feed", body.baseline === true);
  const mark = [...new Set(body.markBootstrapped ?? [])];
  for (let i = 0; i < mark.length; i += 90) {
    const part = mark.slice(i, i + 90);
    stmts.push(
      env.DB.prepare(
        `UPDATE follow SET feed_bootstrapped_at = ? WHERE feed_bootstrapped_at IS NULL
         AND artist_id IN (SELECT id FROM artist WHERE tm_attraction_id IN (${part.map(() => "?").join(",")}))`,
      ).bind(now.toISOString(), ...part),
    );
  }
  if (stmts.length) await env.DB.batch(stmts);
  return { stored, alerts };
}
