import { env, fetchMock, SELF } from "cloudflare:test";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeFeedEvent } from "@gira/core";
import feed from "../../../packages/core/test/fixtures/feed-events.json";
import { publishSheets } from "../src/sheets";

const GUILD = "1568641743853715516";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const [jake, nfl] = feed.events as any[];
let posts: string[] = [];

async function token(): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("gira-ingest:test-key"));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const ingest = async (body: unknown, auth?: string) =>
  SELF.fetch("https://gira.test/ingest", {
    method: "POST",
    headers: { "content-type": "application/json", ...(auth ? { authorization: `Bearer ${auth}` } : {}) },
    body: JSON.stringify(body),
  });
const future = (raw: object, overrides: object) => normalizeFeedEvent({ ...raw, ...overrides })!;
const count = async (sql: string) => (await env.DB.prepare(sql).first<{ n: number }>())!.n;

beforeAll(() => {
  fetchMock.activate();
  fetchMock.disableNetConnect();
  fetchMock
    .get("https://discord.com")
    .intercept({ path: `/api/v10/guilds/${GUILD}/channels`, method: "GET" })
    .reply(
      200,
      JSON.stringify([
        { id: "CAT_A", name: "🚨 ALERTAS", type: 4, parent_id: null },
        { id: "CAT_D", name: "🏟️ DEPORTES", type: 4, parent_id: null },
        { id: "CAT_G", name: "🎤 GIRAS", type: 4, parent_id: null },
        { id: "C_NUEVAS", name: "nuevas-giras", type: 0, parent_id: "CAT_A" },
        { id: "C_NFL", name: "nfl", type: 0, parent_id: "CAT_D" },
      ]),
      { headers: { "content-type": "application/json" } },
    )
    .persist();
  let seq = 0;
  fetchMock
    .get("https://discord.com")
    .intercept({ path: `/api/v10/guilds/${GUILD}/channels`, method: "POST" })
    .reply(() => ({ statusCode: 200, data: JSON.stringify({ id: `NEW${++seq}` }), responseOptions: { headers: { "content-type": "application/json" } } }))
    .persist();
  fetchMock
    .get("https://discord.com")
    .intercept({ path: (p) => p.startsWith("/api/v10/channels/"), method: "POST" })
    .reply((o) => (/\/channels\/C_/.test(o.path) && posts.push(o.path), { statusCode: 200, data: JSON.stringify({ id: "m" }), responseOptions: { headers: { "content-type": "application/json" } } }))
    .persist();
});
beforeEach(async () => {
  posts = [];
  await env.DB.batch([
    env.DB.prepare("INSERT INTO artist (id, name, tm_attraction_id) VALUES ('a_jake', 'Jake Bugg', 'K8vZ917COCV'), ('a_nfl', 'NFL', 'K8vZ9178NNV')"),
    env.DB.prepare("INSERT INTO follow (artist_id, tier) VALUES ('a_jake', 1), ('a_nfl', 1)"),
  ]);
});
afterEach(() => undefined);

describe("POST /ingest (Discovery Feed)", () => {
  it("sin token correcto → 401", async () => {
    expect((await ingest({ shows: [] })).status).toBe(401);
    expect((await ingest({ shows: [] }, "malo")).status).toBe(401);
  });

  it("primera pasada en silencio; tras marcar el arranque, una fecha nueva avisa", async () => {
    const t = await token();
    const r1 = await ingest({ shows: [future(jake, { eventStartLocalDate: "2027-04-06" })] }, t);
    expect(r1.status).toBe(200);
    expect(await count("SELECT COUNT(*) n FROM alert")).toBe(0);
    expect((await ingest({ shows: [], markBootstrapped: ["K8vZ917COCV", "K8vZ9178NNV"] }, t)).status).toBe(200);
    expect(await count("SELECT COUNT(*) n FROM follow WHERE feed_bootstrapped_at IS NOT NULL")).toBe(2);
    await env.DB.prepare("UPDATE show SET first_seen_at = '2026-01-01T00:00:00Z'").run();
    await ingest({ shows: [future(jake, { eventId: "J2", presales: [], onsaleStartDateTime: "2099-01-01T09:00:00Z", eventStartLocalDate: "2027-09-01", eventStartDateTime: "2027-09-01T18:30:00Z", venue: { ...jake.venue, venueId: "OTRO", venueCountryCode: "GB", venueTimezone: "Europe/London" } })] }, t);
    // /ingest entrega en segundo plano (waitUntil); esperamos a que llegue el POST.
    await vi.waitFor(() => expect(posts).toEqual(["/api/v10/channels/C_NUEVAS/messages"]));
    expect((await publishSheets(env, new Date())).notices).toBe(0);
  });

  it("primera lectura de un país nuevo (baseline): guarda sin avisar aunque la entidad ya esté arrancada", async () => {
    const t = await token();
    await ingest({ shows: [], markBootstrapped: ["K8vZ917COCV", "K8vZ9178NNV"] }, t);
    const r = await ingest({ shows: [future(jake, { eventId: "J9", eventStartLocalDate: "2027-09-09" })], baseline: true }, t);
    expect(((await r.json()) as { alerts: number }).alerts).toBe(0);
    expect(await count("SELECT COUNT(*) n FROM show WHERE source_id = 'J9'")).toBe(1);
  });

  it("el deporte va a su canal (NFL → #nfl)", async () => {
    const t = await token();
    await ingest({ shows: [], markBootstrapped: ["K8vZ9178NNV"] }, t);
    await ingest({ shows: [future(nfl, { onsaleStartDateTime: "2099-01-01T16:00:00Z", eventStartLocalDate: "2027-10-10", eventStartDateTime: "2027-10-10T14:30:00Z" })] }, t);
    await vi.waitFor(() => expect(posts).toEqual(["/api/v10/channels/C_NFL/messages"]));
  });

  it("ignora entidades que nadie sigue y fechas pasadas", async () => {
    const t = await token();
    await ingest({ shows: [future(jake, { attractions: [{ attraction: { attractionId: "NADIE" } }] }), future(jake, { eventId: "OLD", eventStartLocalDate: "2020-01-01" })] }, t);
    expect(await count("SELECT COUNT(*) n FROM show")).toBe(0);
  });

  it("la misma fecha por API y por feed no se reescribe (hash semántico)", async () => {
    const t = await token();
    const s = future(jake, {});
    await ingest({ shows: [s] }, t);
    const before = await env.DB.prepare("SELECT updated_at FROM show").first<{ updated_at: string }>();
    await ingest({ shows: [{ ...s, url: "https://otra-url", promoters: [] }] }, t);
    expect(await env.DB.prepare("SELECT updated_at FROM show").first()).toEqual(before);
  });

  it("una entidad arrancada por la API sigue en silencio para el feed hasta su propia lectura completa", async () => {
    const t = await token();
    await env.DB.prepare("UPDATE follow SET bootstrapped_at = '2026-11-07T20:00:00Z'").run(); // la API ya la vio
    await ingest({ shows: [future(jake, { venue: { ...jake.venue, venueCountryCode: "FR", venueTimezone: "Europe/Paris" } })] }, t);
    expect(await count("SELECT COUNT(*) n FROM show")).toBe(1);
    expect(await count("SELECT COUNT(*) n FROM alert")).toBe(0);
  });

  it("API y feed no se corrigen entre sí: cada fuente se compara con su propia lectura anterior", async () => {
    const t = await token();
    await env.DB.prepare("UPDATE follow SET bootstrapped_at = '2026-11-07T20:00:00Z', feed_bootstrapped_at = '2026-11-07T20:00:00Z'").run();
    const s = future(jake, {});
    // La API guardó la fecha "a la venta" (simulado con la misma ficha y otro estado).
    await env.DB.prepare(
      `INSERT INTO show (source_id, show_key, artist_id, country, local_date, is_package, hash, snapshot_json, first_seen_at, updated_at, api_hash, api_snapshot)
       VALUES (?, 'k', 'a_jake', 'ES', ?, 0, 'h', ?, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', 'h', ?)`,
    ).bind(s.sourceId, s.localDate, JSON.stringify(s), JSON.stringify(s)).run();
    // El feed la ve por primera vez con otro estado → línea base, sin aviso.
    await ingest({ shows: [{ ...s, status: "offsale" }] }, t);
    expect(await count("SELECT COUNT(*) n FROM alert")).toBe(0);
    // Un cambio real en el feed respecto a su propia lectura → sí avisa.
    await ingest({ shows: [{ ...s, status: "cancelled" }] }, t);
    expect(await env.DB.prepare("SELECT kind, json_extract(payload_json, '$.alert.detail.before') AS b FROM alert").first()).toEqual({ kind: "status_changed", b: "offsale" });
  });
});
