import { env, fetchMock } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Show } from "@gira/core";
import { publishSheets, refreshActiveSheets } from "../src/sheets";

const GUILD = "1568641743853715516";
const NOW = new Date("2026-11-08T12:00:00Z");
let calls: { method: string; path: string; body: any }[] = [];
let created = 0;
let patchStatus = 200;
let channelMessages: { id: string; timestamp: string; author: { bot: boolean } }[] = [];

const show = (id: string, date: string, saleAt: string, extra: Partial<Show> = {}): Show => ({
  source: "ticketmaster", sourceId: id, name: "Artista Uno - Tour 2027", attractionIds: ["K1"],
  venue: { tmId: `V${id}`, name: "Estadio", city: "Madrid", country: "ES", tz: "Europe/Madrid" },
  startsAt: `${date}T19:00:00Z`, localDate: date, status: "onsale", ticketLimit: null, url: `https://tm.example/${id}`, isPackage: false,
  sales: [{ kind: "general", label: "Venta general", startsAt: saleAt, endsAt: null, url: null, orderRank: 90 }],
  segment: "Music", ...extra,
});

async function storeShow(s: Show) {
  await env.DB.prepare(
    `INSERT INTO show (source_id, show_key, artist_id, country, local_date, is_package, hash, snapshot_json, first_seen_at, updated_at)
     VALUES (?, ?, 'a1', ?, ?, 0, 'h', ?, '2026-11-01T00:00:00Z', '2026-11-01T00:00:00Z')
     ON CONFLICT (source_id) DO UPDATE SET local_date = excluded.local_date, snapshot_json = excluded.snapshot_json`,
  ).bind(s.sourceId, `K1:V${s.sourceId}:${s.localDate}`, s.venue.country, s.localDate, JSON.stringify(s)).run();
}
async function alertFor(s: Show, kind = "new_event") {
  const payload = JSON.stringify({ alert: { kind, showKey: "k", sourceId: s.sourceId, artistName: "Artista Uno", tier: 3, dedupeKey: `${kind}:${s.sourceId}`, detail: {} }, show: s });
  await env.DB.batch([
    env.DB.prepare("INSERT INTO alert (dedupe_key, kind, source_id, payload_json, created_at) VALUES (?, ?, ?, ?, ?)").bind(`${kind}:${s.sourceId}`, kind, s.sourceId, payload, NOW.toISOString()),
    env.DB.prepare("INSERT INTO delivery (alert_id, channel, artist_id) SELECT id, 'nuevas-giras', 'a1' FROM alert WHERE dedupe_key = ?").bind(`${kind}:${s.sourceId}`),
    env.DB.prepare("INSERT OR IGNORE INTO sheet_dirty (artist_id, since) VALUES ('a1', ?)").bind(NOW.toISOString()),
  ]);
}
const discordCalls = (method: string, re: RegExp) => calls.filter((c) => c.method === method && re.test(c.path));

beforeAll(() => {
  fetchMock.activate();
  fetchMock.disableNetConnect();
  const ok = (data: unknown) => ({ statusCode: 200, data: JSON.stringify(data), responseOptions: { headers: { "content-type": "application/json" } } });
  const d = fetchMock.get("https://discord.com");
  d.intercept({ path: `/api/v10/guilds/${GUILD}/channels`, method: "GET" })
    .reply(() => ok([
      { id: "CAT_G", name: "🎤 GIRAS", type: 4, parent_id: null },
      { id: "CAT_A", name: "📦 ARCHIVO", type: 4, parent_id: null },
      { id: "CAT_AL", name: "🚨 ALERTAS", type: 4, parent_id: null },
      { id: "C_NUEVAS", name: "nuevas-giras", type: 0, parent_id: "CAT_AL" },
      { id: "C_PRE", name: "preventas", type: 0, parent_id: "CAT_AL" },
    ]))
    .persist();
  d.intercept({ path: `/api/v10/guilds/${GUILD}/channels`, method: "POST" })
    .reply((o) => (calls.push({ method: "POST", path: o.path, body: JSON.parse(String(o.body)) }), ok({ id: `NEW${++created}` })))
    .persist();
  const parse = (b: unknown) => {
    try {
      return JSON.parse(String(b));
    } catch {
      return { multipart: true }; // mensaje con imagen adjunta
    }
  };
  d.intercept({ path: (p) => p.startsWith("/api/v10/channels/"), method: "POST" })
    .reply((o) => (calls.push({ method: "POST", path: o.path, body: parse(o.body) }), ok({ id: `M${calls.length}` })))
    .persist();
  d.intercept({ path: (p) => p.startsWith("/api/v10/channels/"), method: "PATCH" })
    .reply((o) => (calls.push({ method: "PATCH", path: o.path, body: parse(o.body) }), patchStatus === 200 ? ok({}) : { statusCode: patchStatus, data: "{}", responseOptions: { headers: { "retry-after": "0.01" } } }))
    .persist();
  d.intercept({ path: (p) => /^\/api\/v10\/channels\/[^/]+\/messages\?limit=100$/.test(p), method: "GET" })
    .reply((o) => (calls.push({ method: "GET", path: o.path, body: null }), ok(channelMessages)))
    .persist();
  d.intercept({ path: (p) => p.startsWith("/api/v10/channels/"), method: "DELETE" })
    .reply((o) => (calls.push({ method: "DELETE", path: o.path, body: null }), { statusCode: 204, data: "" }))
    .persist();
});
beforeEach(async () => {
  calls = [];
  patchStatus = 200;
  channelMessages = [];
  await env.DB.batch([
    env.DB.prepare("INSERT INTO artist (id, name, tm_attraction_id) VALUES ('a1', 'Artista Uno', 'K1')"),
    env.DB.prepare("INSERT INTO follow (artist_id, tier) VALUES ('a1', 3)"),
  ]);
});

describe("fichas por artista en Discord", () => {
  it("gira con venta por llegar → crea #artista-uno en GIRAS, publica la ficha y UN aviso agrupado", async () => {
    const a = show("1", "2027-05-10", "2026-11-20T09:00:00Z");
    const b = show("2", "2027-05-11", "2026-11-20T09:00:00Z");
    await storeShow(a); await storeShow(b); await alertFor(a); await alertFor(b);
    await publishSheets(env, NOW);
    const ch = discordCalls("POST", /\/guilds\//);
    expect(ch).toHaveLength(1);
    expect(ch[0]!.body).toMatchObject({ name: "artista-uno", type: 0, parent_id: "CAT_G" });
    const sheetPosts = discordCalls("POST", /\/channels\/NEW1\/messages/);
    expect(sheetPosts.length).toBeGreaterThan(0);
    expect(sheetPosts[0]!.body.content).toContain("Artista Uno");
    const notices = discordCalls("POST", /\/channels\/C_NUEVAS\/messages/);
    expect(notices).toHaveLength(1);
    expect(notices[0]!.body.content).toContain("<#NEW1>");
    expect(notices[0]!.body.content).toContain("2 fechas nuevas");
    expect(await env.DB.prepare("SELECT COUNT(*) n FROM delivery WHERE status = 'sent'").first()).toEqual({ n: 2 });
  });

  it("sin cambios → no toca Discord; con cambios → edita los mensajes (no publica otros)", async () => {
    const a = show("1", "2027-05-10", "2026-11-20T09:00:00Z");
    await storeShow(a); await alertFor(a);
    await publishSheets(env, NOW);
    calls = [];
    await env.DB.prepare("INSERT OR IGNORE INTO sheet_dirty (artist_id, since) VALUES ('a1', ?)").bind(NOW.toISOString()).run();
    await publishSheets(env, NOW);
    expect(calls).toEqual([]);
    await storeShow(show("1", "2027-05-10", "2026-11-21T09:00:00Z"));
    await env.DB.prepare("INSERT OR IGNORE INTO sheet_dirty (artist_id, since) VALUES ('a1', ?)").bind(NOW.toISOString()).run();
    await publishSheets(env, NOW);
    expect(discordCalls("PATCH", /\/messages\//).length).toBeGreaterThan(0);
    expect(discordCalls("POST", /\/messages/)).toEqual([]);
  });

  it("artista ⭐ sin ventas por llegar y sin canal → no se crea canal", async () => {
    await env.DB.prepare("UPDATE follow SET tier = 1").run();
    await storeShow(show("1", "2027-05-10", "2026-10-01T09:00:00Z"));
    await env.DB.prepare("INSERT INTO sheet_dirty (artist_id, since) VALUES ('a1', ?)").bind(NOW.toISOString()).run();
    await publishSheets(env, NOW);
    expect(calls).toEqual([]);
  });

  it("artista con todas las ventas ya empezadas → sin canal, aunque el concierto sea futuro", async () => {
    await storeShow(show("1", "2027-05-10", "2026-10-01T09:00:00Z"));
    await env.DB.prepare("INSERT INTO sheet_dirty (artist_id, since) VALUES ('a1', ?)").bind(NOW.toISOString()).run();
    await publishSheets(env, NOW);
    expect(calls).toEqual([]);
  });

  it("canal creado sin ninguna venta por llegar (por error) → se borra, no se archiva", async () => {
    await storeShow(show("1", "2027-05-10", "2026-10-01T09:00:00Z"));
    await env.DB.batch([
      env.DB.prepare("INSERT INTO sheet (artist_id, channel_id, updated_at) VALUES ('a1', 'OLDCH', ?)").bind(NOW.toISOString()),
      env.DB.prepare("INSERT INTO sheet_dirty (artist_id, since) VALUES ('a1', ?)").bind(NOW.toISOString()),
    ]);
    await publishSheets(env, NOW);
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual(["DELETE /api/v10/channels/OLDCH"]);
    expect(await env.DB.prepare("SELECT COUNT(*) n FROM sheet").first()).toEqual({ n: 0 });
  });

  it("hoteles y pases de festivales ajenos no entran en la ficha", async () => {
    const a = show("1", "2027-05-10", "2026-11-20T09:00:00Z");
    await storeShow(a); await alertFor(a);
    await storeShow(show("2", "2027-06-27", "2026-11-20T09:00:00Z", { name: "Hotellrom - Thon Hotel - Artista Uno Live 27", isPackage: true }));
    await storeShow(show("3", "2027-06-30", "2026-11-20T09:00:00Z", { name: "Lytham Festival 2027 5 Day Pass" }));
    await publishSheets(env, NOW);
    const body = discordCalls("POST", /\/channels\/NEW\d+\/messages/).map((c) => c.body.content).join("\n");
    expect(body).toContain("https://tm.example/1");
    expect(body).not.toContain("https://tm.example/2");
    expect(body).not.toContain("https://tm.example/3");
  });

  it("muestra aforo, precio y reventa guardados por los trabajos de enriquecimiento", async () => {
    const a = show("1", "2027-05-10", "2026-11-20T09:00:00Z");
    await storeShow(a); await alertFor(a);
    await env.DB.batch([
      env.DB.prepare("INSERT INTO venue_info (tm_venue_id, name, capacity, checked_at) VALUES ('V1', 'Estadio', 70000, ?)").bind(NOW.toISOString()),
      env.DB.prepare("INSERT INTO show_price (source_id, min, max, currency, source, updated_at) VALUES ('1', 45, 250, 'EUR', 'Ticketmaster', ?)").bind(NOW.toISOString()),
      env.DB.prepare("INSERT INTO artist_resale (artist_id, json, updated_at) VALUES ('a1', ?, ?)").bind(JSON.stringify({ low: 1.5, high: 2.5, confidence: "baja", basis: "modelo" }), NOW.toISOString()),
    ]);
    await publishSheets(env, NOW);
    const body = discordCalls("POST", /\/channels\/NEW\d+\/messages/).map((c) => c.body.content).join("\n");
    expect(body).toContain("· Estadio (70.000)");
    expect(body).toContain("🇪🇸 **ESPAÑA:** **45 €** – **250 €**");
    expect(body).toContain("**Reventa estimada:** ×1,5–×2,5 sobre el oficial\n");
    expect(body).toMatch(/^# 🎤 Artista Uno — Tour 2027 ⭐⭐⭐/m);
  });

  it("con imagen de precios, el mensaje de precios se publica con la imagen adjunta", async () => {
    const a = show("1", "2027-05-10", "2026-11-20T09:00:00Z");
    await storeShow(a); await alertFor(a);
    await env.DB.prepare("INSERT INTO show_price (source_id, min, max, currency, source, updated_at) VALUES ('1', 45, 250, 'EUR', 'Ticketmaster', ?)").bind(NOW.toISOString()).run();
    const { storePriceImage } = await import("../src/enrich");
    expect(await storePriceImage(env, { artistId: "a1", hash: "h1", mime: "image/jpeg" }, new TextEncoder().encode("JPEGDATA").buffer as ArrayBuffer, NOW)).toEqual({ stored: true });
    await publishSheets(env, NOW);
    const posts = discordCalls("POST", /\/channels\/NEW\d+\/messages$/);
    expect(posts.some((c) => c.body.multipart)).toBe(true);
    expect(posts.some((c) => typeof c.body.content === "string" && c.body.content.includes("ESPAÑA"))).toBe(false);
  });

  it("en el canal solo queda la ficha: se borran copias antiguas y novedades del bot", async () => {
    const a = show("1", "2027-05-10", "2026-11-20T09:00:00Z");
    await storeShow(a); await alertFor(a);
    channelMessages = [
      { id: "OLD1", timestamp: NOW.toISOString(), author: { bot: true } },
      { id: "OLD2", timestamp: NOW.toISOString(), author: { bot: true } },
      { id: "HUMANO", timestamp: NOW.toISOString(), author: { bot: false } },
    ];
    await publishSheets(env, NOW);
    const bulk = discordCalls("POST", /\/messages\/bulk-delete$/)[0];
    expect(bulk?.body).toEqual({ messages: ["OLD1", "OLD2"] });
  });

  it("si Discord falla al editar (429), no publica otra copia y guarda los ids", async () => {
    const a = show("1", "2027-05-10", "2026-11-20T09:00:00Z");
    await storeShow(a); await alertFor(a);
    await publishSheets(env, NOW);
    const before = (await env.DB.prepare("SELECT message_ids FROM sheet").first<{ message_ids: string }>())!.message_ids;
    // Cambia la ficha y Discord responde 429 al editar.
    await storeShow({ ...a, venue: { ...a.venue, name: "Otro estadio" } });
    await env.DB.prepare("INSERT OR IGNORE INTO sheet_dirty (artist_id, since) VALUES ('a1', ?)").bind(NOW.toISOString()).run();
    calls = [];
    patchStatus = 429;
    await publishSheets(env, NOW);
    expect(discordCalls("POST", /\/channels\/NEW\d+\/messages$/)).toHaveLength(0);
    // Reintenta lo que pide Discord antes de rendirse.
    expect(discordCalls("PATCH", /\/channels\/NEW\d+\/messages\//).length).toBeGreaterThanOrEqual(4);
    expect((await env.DB.prepare("SELECT message_ids FROM sheet").first<{ message_ids: string }>())!.message_ids).toBe(before);
  });

  it("cuando pasa la última fecha → el canal se mueve a 📦 ARCHIVO", async () => {
    const a = show("1", "2027-05-10", "2026-11-20T09:00:00Z");
    await storeShow(a); await alertFor(a);
    await publishSheets(env, NOW);
    calls = [];
    await env.DB.prepare("INSERT OR IGNORE INTO sheet_dirty (artist_id, since) VALUES ('a1', ?)").bind(NOW.toISOString()).run();
    const { channel_id } = (await env.DB.prepare("SELECT channel_id FROM sheet").first<{ channel_id: string }>())!;
    await publishSheets(env, new Date("2027-06-01T12:00:00Z"));
    expect(calls.find((c) => c.method === "PATCH" && c.path === `/api/v10/channels/${channel_id}`)?.body).toEqual({ parent_id: "CAT_A" });
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
    expect(await env.DB.prepare("SELECT status FROM sheet").first()).toEqual({ status: "archived" });
  });

  it("cuando empieza una preventa, su bloque desaparece del canal en la siguiente revisión", async () => {
    const a = show("1", "2027-05-10", "2026-11-20T09:00:00Z");
    a.sales.unshift({ kind: "artist", label: "Artist Presale", startsAt: "2026-11-10T09:00:00Z", endsAt: null, url: null, orderRank: 20 });
    await storeShow(a); await alertFor(a);
    await publishSheets(env, NOW);
    calls = [];
    const later = new Date("2026-11-10T09:20:00Z");
    expect(await refreshActiveSheets(env, later)).toBe(1);
    expect(await refreshActiveSheets(env, later)).toBe(0); // una vez por cuarto de hora
    await publishSheets(env, later);
    const edited = discordCalls("PATCH", /\/messages\//).map((c) => c.body.content).join("\n");
    expect(edited).toContain("Venta general");
    expect(edited).not.toContain("Artist Presale");
  });
});
