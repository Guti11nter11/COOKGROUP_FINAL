import { localDateIn, MADRID, sheetShows, type EnrichInput, type EnrichTodo, type Show, type SignupLink } from "@gira/core";
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
    // Sin nombre de recinto no hay nada que buscar (algunas fechas del feed llegan así).
    if (!fresh.has(show.venue.tmId) && show.venue.name.trim()) venues.set(show.venue.tmId, { tmId: show.venue.tmId, name: show.venue.name, city: show.venue.city, country: show.venue.country });
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
    const a = artists.get(artistId) ?? { artistId, name: artist, tier, mbid, homepage, needsSignup: false, dates: 0, when: [], countries: [], venues: [], hot: false, firstSale: null, resaleAt: null, resale: null, prices: [] };
    a.needsSignup ||= show.sales.some((w) => SIGNUP_KINDS.has(w.kind) && (!w.startsAt || Date.parse(w.startsAt) > nowMs));
    a.dates++;
    a.when.push({ city: show.venue.city, localDate: show.localDate });
    if (!a.countries.includes(show.venue.country)) a.countries.push(show.venue.country);
    if (!a.venues.some((v) => v.tmId === show.venue.tmId)) a.venues.push({ tmId: show.venue.tmId, name: show.venue.name, country: show.venue.country });
    a.hot ||= show.hot === true;
    for (const w of show.sales) if (w.startsAt && (!a.firstSale || w.startsAt < a.firstSale)) a.firstSale = w.startsAt;
    artists.set(artistId, a);
  }
  const { results: rs } = await env.DB.prepare("SELECT artist_id, json, updated_at FROM artist_resale").all<{ artist_id: string; json: string; updated_at: string }>();
  const { results: pr } = await env.DB.prepare("SELECT source_id, min, max, currency, zones_json FROM show_price").all<{
    source_id: string;
    min: number;
    max: number;
    currency: string;
    zones_json: string | null;
  }>();
  const priceOf = new Map(pr.map((p) => [p.source_id, p]));
  for (const { artistId, show } of rows) {
    const a = artists.get(artistId)!;
    const prev = rs.find((r) => r.artist_id === artistId);
    a.resaleAt = prev?.updated_at ?? null;
    a.resale = prev ? JSON.parse(prev.json) : null;
    const p = priceOf.get(show.sourceId);
    if (p && a.prices.length < 40) {
      a.prices.push({ country: show.venue.country, city: show.venue.city, min: p.min, max: p.max, currency: p.currency, ...(p.zones_json ? { zones: JSON.parse(p.zones_json) } : {}) });
    }
  }
  // Límite de entradas: países sin dato de la ticketera ni de prensa.
  const { results: lim } = await env.DB.prepare("SELECT artist_id, country FROM artist_limit").all<{ artist_id: string; country: string }>();
  const hasLimit = new Set(lim.map((l) => `${l.artist_id}|${l.country}`));
  for (const { artistId, show } of rows) {
    const a = artists.get(artistId)!;
    a.limitCountries ??= [];
    if (show.ticketLimit) hasLimit.add(`${artistId}|${show.venue.country}`);
  }
  // Con un límite general de la gira ("ZZ") ya no hace falta buscar país por país.
  for (const a of artists.values()) a.limitCountries = hasLimit.has(`${a.artistId}|ZZ`) ? [] : a.countries.filter((cc) => !hasLimit.has(`${a.artistId}|${cc}`));
  const { results: imgs } = await env.DB.prepare("SELECT artist_id, hash FROM price_image").all<{ artist_id: string; hash: string }>();
  for (const i of imgs) {
    const a = artists.get(i.artist_id);
    if (a) a.priceImageHash = i.hash;
  }
  // ⭐⭐⭐ sin fechas activas: su web puede abrir un registro antes de que haya fechas en Ticketmaster.
  const { results: watch } = await env.DB.prepare(
    `SELECT a.id AS artistId, a.name, f.tier, a.mbid, a.homepage FROM follow f JOIN artist a ON a.id = f.artist_id
     WHERE f.tier >= 3 ORDER BY a.name LIMIT 200`,
  ).all<{ artistId: string; name: string; tier: number; mbid: string | null; homepage: string | null }>();
  return { venues: [...venues.values()], shows, artists: [...artists.values()], watch: watch.filter((w) => !artists.has(w.artistId)) };
}

/** Guarda lo encontrado y marca las fichas afectadas para regenerarlas. */
export async function applyEnrichment(
  env: Env,
  input: EnrichInput,
  now: Date,
): Promise<{ venues: number; prices: number; resale: number; signups: number; limits: number; freshSignups?: { artistId: string; links: SignupLink[] }[] }> {
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
  const limits = (input.limits ?? []).filter((l) => l.artistId && /^[A-Z]{2}$/.test(l.country) && Number.isInteger(l.limit) && l.limit >= 1 && l.limit <= 20);
  for (const l of limits) {
    stmts.push(
      env.DB.prepare(
        "INSERT INTO artist_limit (artist_id, country, ticket_limit, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT (artist_id, country) DO UPDATE SET ticket_limit = excluded.ticket_limit, updated_at = excluded.updated_at",
      ).bind(l.artistId, l.country, l.limit, iso),
    );
  }
  const signups = (input.signups ?? []).filter((x) => x.artistId);
  const freshSignups: { artistId: string; links: SignupLink[] }[] = [];
  for (const x of signups) {
    const { results: before } = await env.DB.prepare("SELECT url FROM artist_signup WHERE artist_id = ?").bind(x.artistId).all<{ url: string }>();
    const known = new Set(before.map((b) => b.url));
    // Enlaces que no estaban (la primera lectura de un artista también avisa: son registros abiertos).
    const added = x.links.filter((l) => !known.has(l.url));
    if (added.length) freshSignups.push({ artistId: x.artistId, links: added });
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
  for (const a of new Set(limits.map((l) => l.artistId))) stmts.push(env.DB.prepare("INSERT OR IGNORE INTO sheet_dirty (artist_id, since) VALUES (?, ?)").bind(a, iso));
  for (let i = 0; i < stmts.length; i += 50) await env.DB.batch(stmts.slice(i, i + 50));
  return { venues: venues.length, prices: prices.length, resale: resale.length, signups: signups.length, limits: limits.length, ...(freshSignups.length ? { freshSignups } : {}) };
}

/** Entidades seguidas (ids de Ticketmaster), incluidas las descubiertas, para el radar del feed. */
export async function followIds(env: Env): Promise<string[]> {
  const { results } = await env.DB.prepare("SELECT a.tm_attraction_id AS id FROM follow f JOIN artist a ON a.id = f.artist_id WHERE a.tm_attraction_id IS NOT NULL").all<{ id: string }>();
  return results.map((r) => r.id);
}

/**
 * Sigue (⭐⭐) entidades descubiertas por alta demanda. Se marcan como ya arrancadas: su primera
 * lectura sí avisa de lo accionable (ventas por llegar), porque es justo lo que interesa.
 */
export async function discover(env: Env, body: { entities?: { tmAttractionId: string; name: string; hotDates: number }[] }, now: Date): Promise<{ added: number }> {
  const iso = now.toISOString();
  let added = 0;
  for (const e of (body.entities ?? []).filter((x) => /^[A-Za-z0-9]{6,20}$/.test(x.tmAttractionId) && x.name).slice(0, 50)) {
    const id = `a_${e.tmAttractionId}`;
    const r = await env.DB.batch([
      env.DB.prepare("INSERT OR IGNORE INTO artist (id, name, tm_attraction_id) VALUES (?, ?, ?)").bind(id, e.name.slice(0, 120), e.tmAttractionId),
      // Alta demanda según Ticketmaster → ⭐⭐; gira grande descubierta por recintos → ⭐.
      env.DB.prepare("INSERT OR IGNORE INTO follow (artist_id, tier, bootstrapped_at, feed_bootstrapped_at) VALUES (?, ?, ?, ?)").bind(id, e.hotDates > 0 ? 2 : 1, iso, iso),
    ]);
    if (r[1]!.meta.changes) added++;
  }
  return { added };
}

/** Avisa en #registros-abiertos de los enlaces de registro nuevos (agrupados por artista). */
export async function announceSignups(env: Env, fresh: { artistId: string; links: SignupLink[] }[]): Promise<number> {
  if (env.DELIVERY_PAUSED === "1" || !fresh.length) return 0;
  const { Guild } = await import("./sheets");
  const { discordFetch } = await import("./discord-client");
  const ch = await new Guild(env).byName("registros-abiertos");
  if (!ch) return 0;
  let sent = 0;
  for (const f of fresh.slice(0, 10)) {
    const a = await env.DB.prepare("SELECT a.name, h.channel_id FROM artist a LEFT JOIN sheet h ON h.artist_id = a.id AND h.status = 'active' WHERE a.id = ?")
      .bind(f.artistId)
      .first<{ name: string; channel_id: string | null }>();
    if (!a) continue;
    const day = (d: string) => new Intl.DateTimeFormat("es-ES", { timeZone: "UTC", day: "numeric", month: "short" }).format(new Date(`${d}T12:00:00Z`));
    const lines = f.links.slice(0, 8).map((l) => `• [${l.label}${l.city ? ` · ${l.city}` : ""}${l.localDate ? ` ${day(l.localDate)}` : ""}](${l.url})`);
    const content = [`📝 **${a.name}** · registro para la preventa${a.channel_id ? ` → <#${a.channel_id}>` : ""}`, ...lines].join("\n");
    if ((await discordFetch(env, "POST", `/channels/${ch.id}/messages`, { content, allowed_mentions: { parse: [] }, flags: 4 })).ok) sent++;
  }
  return sent;
}

const CHUNK = 400_000;
/**
 * Guarda la imagen de precios de un artista (bytes tal cual, sin base64: decodificar costaría CPU) y
 * marca su ficha para republicarla.
 */
export async function storePriceImage(env: Env, q: { artistId?: string | null; hash?: string | null; mime?: string | null }, bytes: ArrayBuffer, now: Date): Promise<{ stored: boolean }> {
  const { artistId, hash, mime } = q;
  if (!artistId || !hash || !/^image\/(png|jpeg)$/.test(mime ?? "") || !bytes.byteLength || bytes.byteLength > 1_500_000) return { stored: false };
  const parts: ArrayBuffer[] = [];
  for (let i = 0; i < bytes.byteLength; i += CHUNK) parts.push(bytes.slice(i, i + CHUNK));
  const iso = now.toISOString();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM price_image_chunk WHERE artist_id = ?").bind(artistId),
    ...parts.map((d, i) => env.DB.prepare("INSERT INTO price_image_chunk (artist_id, idx, data) VALUES (?, ?, ?)").bind(artistId, i, d)),
    env.DB.prepare(
      "INSERT INTO price_image (artist_id, hash, mime, chunks, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT (artist_id) DO UPDATE SET hash = excluded.hash, mime = excluded.mime, chunks = excluded.chunks, updated_at = excluded.updated_at",
    ).bind(artistId, hash, mime!, parts.length, iso),
    env.DB.prepare("INSERT OR IGNORE INTO sheet_dirty (artist_id, since) VALUES (?, ?)").bind(artistId, iso),
  ]);
  return { stored: true };
}
