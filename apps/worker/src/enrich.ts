import { localDateIn, MADRID, sheetShows, type EnrichInput, type EnrichTodo, type Show } from "@gira/core";
import type { Env } from "./env";

const VENUE_RECHECK_DAYS = 30;
const SIGNUP_KINDS = new Set(["artist", "fanclub", "registration", "unknown", "lottery", "promoter"]);

/** Fechas de las fichas activas (las únicas que merece la pena enriquecer). */
type ActiveRow = { artistId: string; artist: string; tier: number; mbid: string | null; homepage: string | null; show: Show };
async function activeShows(env: Env, now: Date): Promise<ActiveRow[]> {
  const today = localDateIn(now, MADRID);
  const { results } = await env.DB.prepare(
    `SELECT s.artist_id, a.name, a.mbid, a.homepage, COALESCE(f.tier, 1) AS tier, s.snapshot_json
       FROM show s JOIN sheet h ON h.artist_id = s.artist_id AND h.status = 'active'
       JOIN artist a ON a.id = s.artist_id LEFT JOIN follow f ON f.artist_id = s.artist_id
      WHERE s.local_date >= ? AND s.is_package = 0`,
  )
    .bind(today)
    .all<{ artist_id: string; name: string; mbid: string | null; homepage: string | null; tier: number; snapshot_json: string }>();
  const byArtist = new Map<string, { artist: string; tier: number; mbid: string | null; homepage: string | null; shows: Show[] }>();
  for (const r of results) {
    const e = byArtist.get(r.artist_id) ?? { artist: r.name, tier: r.tier, mbid: r.mbid, homepage: r.homepage, shows: [] };
    e.shows.push(JSON.parse(r.snapshot_json) as Show);
    byArtist.set(r.artist_id, e);
  }
  return [...byArtist].flatMap(([artistId, e]) =>
    sheetShows(e.artist, e.shows).map((show) => ({ artistId, artist: e.artist, tier: e.tier, mbid: e.mbid, homepage: e.homepage, show })),
  );
}

export async function enrichTodo(env: Env, now: Date): Promise<EnrichTodo> {
  const rows = await activeShows(env, now);
  const recheck = new Date(now.getTime() - VENUE_RECHECK_DAYS * 86_400_000).toISOString();
  const { results: known } = await env.DB.prepare("SELECT tm_venue_id, capacity, checked_at FROM venue_info").all<{
    tm_venue_id: string;
    capacity: number | null;
    checked_at: string;
  }>();
  const fresh = new Set(known.filter((k) => k.capacity !== null || k.checked_at > recheck).map((k) => k.tm_venue_id));
  const { results: priced } = await env.DB.prepare("SELECT source_id FROM show_price").all<{ source_id: string }>();
  const hasPrice = new Set(priced.map((p) => p.source_id));

  const venues = new Map<string, EnrichTodo["venues"][number]>();
  for (const { show } of rows) {
    if (!fresh.has(show.venue.tmId)) venues.set(show.venue.tmId, { tmId: show.venue.tmId, name: show.venue.name, city: show.venue.city, country: show.venue.country });
  }
  const shows = rows
    .filter(({ show }) => !hasPrice.has(show.sourceId))
    .map(({ artistId, artist, show }) => ({
      sourceId: show.sourceId,
      artistId,
      artist,
      name: show.name,
      city: show.venue.city,
      country: show.venue.country,
      localDate: show.localDate,
      venue: show.venue.name,
    }));
  const artists = new Map<string, EnrichTodo["artists"][number]>();
  const nowMs = now.getTime();
  for (const { artistId, artist, tier, mbid, homepage, show } of rows) {
    const a = artists.get(artistId) ?? { artistId, name: artist, tier, mbid, homepage, needsSignup: false, dates: 0, when: [], countries: [], venues: [], hot: false, firstSale: null };
    a.needsSignup ||= show.sales.some((w) => SIGNUP_KINDS.has(w.kind) && (!w.startsAt || Date.parse(w.startsAt) > nowMs));
    a.dates++;
    a.when.push({ city: show.venue.city, localDate: show.localDate });
    if (!a.countries.includes(show.venue.country)) a.countries.push(show.venue.country);
    if (!a.venues.some((v) => v.tmId === show.venue.tmId)) a.venues.push({ tmId: show.venue.tmId, name: show.venue.name, country: show.venue.country });
    a.hot ||= show.hot === true;
    for (const w of show.sales) if (w.startsAt && (!a.firstSale || w.startsAt < a.firstSale)) a.firstSale = w.startsAt;
    artists.set(artistId, a);
  }
  return { venues: [...venues.values()], shows, artists: [...artists.values()] };
}

/** Guarda lo encontrado y marca las fichas afectadas para regenerarlas. */
export async function applyEnrichment(env: Env, input: EnrichInput, now: Date): Promise<{ venues: number; prices: number; resale: number; signups: number }> {
  const iso = now.toISOString();
  const stmts: D1PreparedStatement[] = [];
  const venues = (input.venues ?? []).filter((v) => v.tmId && v.name && (v.capacity === null || (v.capacity > 0 && v.capacity < 400_000)));
  for (const v of venues) {
    stmts.push(
      env.DB.prepare(
        `INSERT INTO venue_info (tm_venue_id, name, city, country, capacity, wikidata_id, source, checked_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (tm_venue_id) DO UPDATE SET name = excluded.name, city = excluded.city, country = excluded.country,
           capacity = COALESCE(excluded.capacity, venue_info.capacity), wikidata_id = COALESCE(excluded.wikidata_id, venue_info.wikidata_id),
           source = COALESCE(excluded.source, venue_info.source), checked_at = excluded.checked_at`,
      ).bind(v.tmId, v.name, v.city ?? null, v.country ?? null, v.capacity, v.wikidataId ?? null, v.source ?? null, iso),
    );
  }
  const prices = (input.prices ?? []).filter((p) => p.sourceId && p.min > 0 && p.max >= p.min && /^[A-Z]{3}$/.test(p.currency) && p.source);
  for (const p of prices) {
    stmts.push(
      env.DB.prepare(
        `INSERT INTO show_price (source_id, min, max, currency, source, updated_at, zones_json) VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (source_id) DO UPDATE SET min = excluded.min, max = excluded.max, currency = excluded.currency, source = excluded.source,
           updated_at = excluded.updated_at, zones_json = excluded.zones_json
         WHERE show_price.source <> 'Ticketmaster' OR (show_price.zones_json IS NULL AND excluded.zones_json IS NOT NULL)`,
      ).bind(p.sourceId, p.min, p.max, p.currency, p.source, iso, p.zones?.length ? JSON.stringify(p.zones.slice(0, 20)) : null),
    );
  }
  const resale = (input.resale ?? []).filter((r) => r.artistId && r.info && r.info.low > 0 && r.info.high >= r.info.low);
  for (const r of resale) {
    stmts.push(
      env.DB.prepare("INSERT INTO artist_resale (artist_id, json, updated_at) VALUES (?, ?, ?) ON CONFLICT (artist_id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at").bind(
        r.artistId,
        JSON.stringify(r.info),
        iso,
      ),
    );
  }
  const signups = (input.signups ?? []).filter((x) => x.artistId);
  for (const x of signups) {
    if (x.homepage !== undefined) stmts.push(env.DB.prepare("UPDATE artist SET homepage = COALESCE(?, homepage) WHERE id = ?").bind(x.homepage, x.artistId));
    stmts.push(env.DB.prepare("DELETE FROM artist_signup WHERE artist_id = ?").bind(x.artistId));
    for (const l of x.links.filter((l) => /^https:\/\//.test(l.url) && !/queueittoken/i.test(l.url)).slice(0, 30)) {
      stmts.push(
        env.DB.prepare("INSERT OR IGNORE INTO artist_signup (artist_id, url, label, city, local_date, found_at) VALUES (?, ?, ?, ?, ?, ?)").bind(
          x.artistId,
          l.url,
          l.label.slice(0, 60),
          l.city ?? null,
          l.localDate ?? null,
          iso,
        ),
      );
    }
    stmts.push(env.DB.prepare("INSERT OR IGNORE INTO sheet_dirty (artist_id, since) VALUES (?, ?)").bind(x.artistId, iso));
  }
  // Fichas afectadas → regenerar.
  const venueIds = venues.map((v) => v.tmId);
  const showIds = prices.map((p) => p.sourceId);
  for (let i = 0; i < venueIds.length; i += 50) {
    const part = venueIds.slice(i, i + 50);
    stmts.push(
      env.DB.prepare(
        `INSERT OR IGNORE INTO sheet_dirty (artist_id, since)
         SELECT DISTINCT s.artist_id, ? FROM show s JOIN sheet h ON h.artist_id = s.artist_id AND h.status = 'active'
          WHERE json_extract(s.snapshot_json, '$.venue.tmId') IN (${part.map(() => "?").join(",")})`,
      ).bind(iso, ...part),
    );
  }
  for (let i = 0; i < showIds.length; i += 50) {
    const part = showIds.slice(i, i + 50);
    stmts.push(
      env.DB.prepare(`INSERT OR IGNORE INTO sheet_dirty (artist_id, since) SELECT DISTINCT artist_id, ? FROM show WHERE source_id IN (${part.map(() => "?").join(",")})`).bind(
        iso,
        ...part,
      ),
    );
  }
  for (const r of resale) stmts.push(env.DB.prepare("INSERT OR IGNORE INTO sheet_dirty (artist_id, since) VALUES (?, ?)").bind(r.artistId, iso));
  for (let i = 0; i < stmts.length; i += 50) await env.DB.batch(stmts.slice(i, i + 50));
  return { venues: venues.length, prices: prices.length, resale: resale.length, signups: signups.length };
}
