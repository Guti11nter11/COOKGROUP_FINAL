import type { Follow } from "@gira/core";

export const TM_DAILY_QUOTA = 5000;
export const TM_BRAKE = Math.floor(TM_DAILY_QUOTA * 0.8); // 4.000: freno al 80 %

/** `bootstrapped`: arrancado por la API; `feedBootstrapped`: arrancado por el Discovery Feed. */
export type FollowRow = Follow & { bootstrapped: boolean; feedBootstrapped: boolean };

/** D1 admite como mucho 100 parámetros por consulta: troceamos las listas. */
const CHUNK = 90;
function chunks<T>(xs: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += CHUNK) out.push(xs.slice(i, i + CHUNK));
  return out;
}
const marks = (n: number) => Array.from({ length: n }, () => "?").join(",");

export async function getFollows(db: D1Database, nowIso: string): Promise<FollowRow[]> {
  const { results } = await db
    .prepare(
      `SELECT a.id AS artistId, a.name, f.tier, a.tm_attraction_id AS tmAttractionId, f.bootstrapped_at AS bootstrappedAt, f.feed_bootstrapped_at AS feedBootstrappedAt
       FROM artist a JOIN follow f ON f.artist_id = a.id
       WHERE a.tm_attraction_id IS NOT NULL AND (f.muted_until IS NULL OR f.muted_until < ?)`,
    )
    .bind(nowIso)
    .all<{ artistId: string; name: string; tier: 1 | 2 | 3; tmAttractionId: string; bootstrappedAt: string | null; feedBootstrappedAt: string | null }>();
  return results.map(({ bootstrappedAt, feedBootstrappedAt, ...r }) => ({ ...r, bootstrapped: bootstrappedAt !== null, feedBootstrapped: feedBootstrappedAt !== null }));
}

export async function getFollowsByAttraction(db: D1Database, ids: string[]): Promise<Map<string, FollowRow>> {
  const map = new Map<string, FollowRow>();
  for (const part of chunks(ids)) {
    const { results } = await db
      .prepare(
        `SELECT a.id AS artistId, a.name, f.tier, a.tm_attraction_id AS tmAttractionId, f.bootstrapped_at AS bootstrappedAt, f.feed_bootstrapped_at AS feedBootstrappedAt
         FROM artist a JOIN follow f ON f.artist_id = a.id WHERE a.tm_attraction_id IN (${marks(part.length)})`,
      )
      .bind(...part)
      .all<{ artistId: string; name: string; tier: 1 | 2 | 3; tmAttractionId: string; bootstrappedAt: string | null; feedBootstrappedAt: string | null }>();
    for (const { bootstrappedAt, feedBootstrappedAt, ...r } of results)
      map.set(r.tmAttractionId, { ...r, bootstrapped: bootstrappedAt !== null, feedBootstrapped: feedBootstrappedAt !== null });
  }
  return map;
}

export async function quotaToday(db: D1Database, service: string, day: string): Promise<number> {
  const row = await db.prepare("SELECT calls FROM quota_usage WHERE service = ? AND day = ?").bind(service, day).first<{ calls: number }>();
  return row?.calls ?? 0;
}

export function bumpQuota(db: D1Database, service: string, day: string, n: number): D1PreparedStatement {
  return db
    .prepare("INSERT INTO quota_usage (service, day, calls) VALUES (?, ?, ?) ON CONFLICT (service, day) DO UPDATE SET calls = calls + excluded.calls")
    .bind(service, day, n);
}

export interface StoredShow {
  source_id: string;
  hash: string;
  snapshot_json: string;
}

export async function loadShows(db: D1Database, sourceIds: string[]): Promise<Map<string, StoredShow>> {
  const map = new Map<string, StoredShow>();
  for (const part of chunks(sourceIds)) {
    const { results } = await db
      .prepare(`SELECT source_id, hash, snapshot_json FROM show WHERE source_id IN (${marks(part.length)})`)
      .bind(...part)
      .all<StoredShow>();
    for (const r of results) map.set(r.source_id, r);
  }
  return map;
}

export interface ShowStat {
  source_id: string;
  artist_id: string;
  country: string;
  show_key: string;
  is_package: number;
  first_seen_at: string;
}

/** Fechas guardadas de esos artistas desde `fromDate` (las pasadas no cuentan como "conocidas"). */
export async function loadShowStats(db: D1Database, artistIds: string[], fromDate: string): Promise<ShowStat[]> {
  const out: ShowStat[] = [];
  for (const part of chunks(artistIds)) {
    const { results } = await db
      .prepare(
        `SELECT source_id, artist_id, country, show_key, is_package, first_seen_at FROM show
         WHERE local_date >= ? AND artist_id IN (${marks(part.length)})`,
      )
      .bind(fromDate, ...part)
      .all<ShowStat>();
    out.push(...results);
  }
  return out;
}

export async function getChannelIds(db: D1Database): Promise<Map<string, { id: string; fetchedAt: string }>> {
  const { results } = await db.prepare("SELECT name, channel_id, fetched_at FROM discord_channel").all<{ name: string; channel_id: string; fetched_at: string }>();
  return new Map(results.map((r) => [r.name, { id: r.channel_id, fetchedAt: r.fetched_at }]));
}
