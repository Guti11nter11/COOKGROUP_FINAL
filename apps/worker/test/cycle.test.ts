import { createExecutionContext, createMessageBatch, env, fetchMock, getQueueResult, waitOnExecutionContext } from "cloudflare:test";
import worker from "../src/index";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { SweepJob } from "../src/env";
import { processPage, runCycle } from "../src/cycle";
import { publishSheets } from "../src/sheets";

const GUILD = "1568641743853715516";
const NOW = new Date("2026-11-08T12:00:00Z"); // minuto 0 → barrido completo, de día
const LATER = new Date("2026-11-08T13:00:00Z"); // ciclo siguiente, fuera de la ventana de "mismo anuncio"
const CHANNELS = [
  { id: "C_DECOY", name: "nuevas-giras", type: 0, parent_id: null }, // homónimo fuera de las categorías de GIRA
  { id: "X", name: "🚨 ALERTAS", type: 4, parent_id: null },
  { id: "CAT_G", name: "🎤 GIRAS", type: 4, parent_id: null },
  { id: "CAT_A", name: "📦 ARCHIVO", type: 4, parent_id: null },
  { id: "C_NUEVAS", name: "nuevas-giras", type: 0, parent_id: "X" },
  { id: "C_EXTRA", name: "fechas-extra", type: 0, parent_id: "X" },
  { id: "C_PRE", name: "preventas", type: 0, parent_id: "X" },
];

function tmEvent(id: string, attraction: string, venue: string, country: string, localDate: string, name = `Show ${id}`) {
  return {
    id,
    name,
    url: `https://www.ticketmaster.es/event/${id}`,
    sales: { public: { startDateTime: "2026-11-20T09:00:00Z" } },
    dates: { start: { localDate, dateTime: `${localDate}T19:00:00Z` }, status: { code: "onsale" } },
    _embedded: {
      venues: [{ id: venue, name: `Venue ${venue}`, timezone: "Europe/Madrid", city: { name: "Madrid" }, country: { countryCode: country } }],
      attractions: [{ id: attraction }],
    },
  };
}
const page = (events: unknown[], totalPages = 1, number = 0) => ({
  _embedded: { events },
  page: { size: 100, totalElements: events.length, totalPages, number },
});

const BASE_EVENTS = [
  tmEvent("E1", "K1", "V1", "ES", "2027-05-10"),
  tmEvent("E2", "K1", "V2", "ES", "2027-05-12"),
  tmEvent("E3", "K2", "V3", "GB", "2027-06-01"),
];

let posts: { path: string; body: unknown }[];
let createdChannels: string[] = [];
let channelSeq = 0;
const NOTICE = /\/channels\/C_(NUEVAS|EXTRA|PRE)\/messages$/;
/** Solo los avisos de los canales temáticos (las fichas van a los canales de cada artista). */
const notices = () => posts.filter((p) => NOTICE.test(p.path));
let discordPostStatus = 200;
let tmPaths: string[] = [];

async function seedArtists() {
  await env.DB.batch([
    env.DB.prepare("INSERT INTO artist (id, name, tm_attraction_id) VALUES ('a1', 'Artista Uno', 'K1'), ('a2', 'Artista Dos', 'K2')"),
    env.DB.prepare("INSERT INTO follow (artist_id, tier) VALUES ('a1', 3), ('a2', 3)"),
  ]);
}

function mockTicketmaster(body: unknown, status = 200, times = 1) {
  fetchMock
    .get("https://app.ticketmaster.com")
    .intercept({ path: (p) => (p.startsWith("/discovery/v2/events.json") ? (tmPaths.push(p), true) : false) })
    .reply(status, JSON.stringify(body), { headers: { "content-type": "application/json" } })
    .times(times);
}

/** Discord simulado una sola vez para todo el fichero; el estado de los POST se cambia por test. */
function mockDiscordOnce() {
  fetchMock
    .get("https://discord.com")
    .intercept({ path: `/api/v10/guilds/${GUILD}/channels`, method: "GET" })
    .reply(200, JSON.stringify(CHANNELS), { headers: { "content-type": "application/json" } })
    .persist();
  fetchMock
    .get("https://discord.com")
    .intercept({ path: `/api/v10/guilds/${GUILD}/channels`, method: "POST" })
    .reply((opts) => {
      const body = JSON.parse(String(opts.body)) as { name: string };
      createdChannels.push(body.name);
      return { statusCode: 200, data: JSON.stringify({ id: `NEW${++channelSeq}` }), responseOptions: { headers: { "content-type": "application/json" } } };
    })
    .persist();
  fetchMock
    .get("https://discord.com")
    .intercept({ path: (p) => p.startsWith("/api/v10/channels/"), method: "PATCH" })
    .reply(() => ({ statusCode: discordPostStatus, data: JSON.stringify({}), responseOptions: { headers: { "content-type": "application/json" } } }))
    .persist();
  fetchMock
    .get("https://discord.com")
    .intercept({ path: (p) => p.startsWith("/api/v10/channels/"), method: "POST" })
    .reply((opts) => {
      posts.push({ path: opts.path, body: JSON.parse(String(opts.body)) });
      const body = discordPostStatus === 429 ? { retry_after: 1.5 } : { id: "m1" };
      return { statusCode: discordPostStatus, data: JSON.stringify(body), responseOptions: { headers: { "content-type": "application/json" } } };
    })
    .persist();
}
const mockDiscord = (status = 200) => void (discordPostStatus = status);

/** Ejecuta un ciclo y procesa todos los trabajos encolados, como haría la cola. */
async function cycleAndDrain(now = NOW, deliver = true) {
  const queue: SweepJob[] = [];
  const send = async (j: SweepJob) => void queue.push(j);
  const cycle = await runCycle(env, now, send);
  const results = [];
  while (queue.length) results.push(await processPage(env, queue.shift()!, now, send));
  const delivered = deliver ? (await publishSheets(env, now)).notices : 0;
  return { cycle, results, delivered, queue };
}

const count = async (sql: string) => (await env.DB.prepare(sql).first<{ n: number }>())!.n;

beforeAll(() => {
  fetchMock.activate();
  fetchMock.disableNetConnect();
  mockDiscordOnce();
});
beforeEach(async () => {
  posts = [];
  tmPaths = [];
  createdChannels = [];
  discordPostStatus = 200;
  await seedArtists();
});
afterEach(() => {
  // Todas las respuestas simuladas de Ticketmaster deben haberse consumido.
  expect(fetchMock.pendingInterceptors().filter((i) => i.origin.includes("ticketmaster"))).toEqual([]);
});

describe("ciclo de Ticketmaster → D1 → Discord", () => {
  it("1. primer ciclo (arranque): guarda las fechas sin avisar", async () => {
    mockTicketmaster(page(BASE_EVENTS));
    mockDiscord();
    await cycleAndDrain();
    expect(await count("SELECT COUNT(*) n FROM show")).toBe(3);
    expect(await count("SELECT COUNT(*) n FROM alert")).toBe(0);
    expect(notices()).toHaveLength(0);
    // Sin avisos, pero cada artista con ventas por llegar ya tiene su canal y su ficha.
    expect(createdChannels.sort()).toEqual(["artista-dos", "artista-uno"]);
    expect(posts.filter((p) => /\/channels\/NEW\d+\/messages$/.test(p.path)).length).toBeGreaterThanOrEqual(2);
    expect(tmPaths[0]).toContain("classificationName=music");
  });

  it("2. fecha nueva de un artista sin fechas en ese país → #nuevas-giras", async () => {
    mockTicketmaster(page(BASE_EVENTS));
    mockDiscord();
    await cycleAndDrain();
    mockTicketmaster(page([...BASE_EVENTS, tmEvent("E4", "K2", "V9", "ES", "2027-07-01")]));
    await cycleAndDrain(LATER);
    expect(await count("SELECT COUNT(*) n FROM alert WHERE kind = 'new_event'")).toBe(1);
    expect(notices().map((p) => p.path)).toEqual(["/api/v10/channels/C_NUEVAS/messages"]);
    expect(JSON.stringify(notices()[0]!.body)).toContain("Artista Dos");
    expect(JSON.stringify(notices()[0]!.body)).toMatch(/<#NEW\d+>/);
  });

  it("2b. fecha nueva de un artista que ya tiene fechas en el país → #fechas-extra", async () => {
    mockTicketmaster(page(BASE_EVENTS));
    mockDiscord();
    await cycleAndDrain();
    mockTicketmaster(page([...BASE_EVENTS, tmEvent("E5", "K1", "V1", "ES", "2027-05-11")]));
    await cycleAndDrain(LATER);
    expect(notices().map((p) => p.path)).toEqual(["/api/v10/channels/C_EXTRA/messages"]);
  });

  it("2c. varias fechas nuevas del mismo anuncio → UN aviso agrupado con todas", async () => {
    mockTicketmaster(page(BASE_EVENTS));
    mockDiscord();
    await cycleAndDrain();
    mockTicketmaster(page([...BASE_EVENTS, tmEvent("E8", "K2", "V9", "ES", "2027-07-01"), tmEvent("E9", "K2", "V9", "ES", "2027-07-02")]));
    await cycleAndDrain(LATER);
    expect(notices().map((p) => p.path)).toEqual(["/api/v10/channels/C_NUEVAS/messages"]);
    expect(JSON.stringify(notices()[0]!.body)).toContain("2 fechas nuevas");
  });

  it("3. repetir el mismo ciclo no duplica avisos ni mensajes", async () => {
    const events = [...BASE_EVENTS, tmEvent("E4", "K2", "V9", "ES", "2027-07-01")];
    mockTicketmaster(page(BASE_EVENTS));
    mockDiscord();
    await cycleAndDrain();
    mockTicketmaster(page(events), 200, 2);
    await cycleAndDrain(LATER);
    await cycleAndDrain(new Date("2026-11-08T13:20:00Z"));
    expect(await count("SELECT COUNT(*) n FROM alert")).toBe(1);
    expect(notices()).toHaveLength(1);
    expect(createdChannels.filter((n) => n === "artista-dos")).toHaveLength(1);
  });

  it("3b. otro listado de la misma fecha (mismo recinto y día) no es fecha nueva", async () => {
    mockTicketmaster(page(BASE_EVENTS));
    mockDiscord();
    await cycleAndDrain();
    mockTicketmaster(page([...BASE_EVENTS, tmEvent("E1bis", "K1", "V1", "ES", "2027-05-10")]));
    await cycleAndDrain(LATER);
    expect(await count("SELECT COUNT(*) n FROM alert")).toBe(0);
  });

  it("4. ignora eventos fuera de los países de la Fase 1", async () => {
    mockTicketmaster(page([...BASE_EVENTS, tmEvent("E6", "K1", "V7", "US", "2027-08-01")]));
    mockDiscord();
    await cycleAndDrain();
    expect(await count("SELECT COUNT(*) n FROM show WHERE country = 'US'")).toBe(0);
  });

  it("4b. nunca guarda ni publica conciertos pasados", async () => {
    mockTicketmaster(page([...BASE_EVENTS, tmEvent("E7", "K1", "V8", "ES", "2026-11-01")]));
    mockDiscord();
    await cycleAndDrain();
    expect(await count("SELECT COUNT(*) n FROM show WHERE source_id = 'E7'")).toBe(0);
  });

  it("5. con la cuota del día al 80 % no llama a Ticketmaster", async () => {
    await env.DB.prepare("INSERT INTO quota_usage (service, day, calls) VALUES ('ticketmaster', '2026-11-08', 4000)").run();
    mockDiscord();
    const { cycle } = await cycleAndDrain();
    expect(cycle.stoppedBy).toBe("quota");
    expect(await count("SELECT COUNT(*) n FROM show")).toBe(0);
  });

  it("6. un 429 de Ticketmaster en la 2.ª página corta limpio y conserva lo procesado", async () => {
    mockTicketmaster(page(BASE_EVENTS, 2, 0));
    mockTicketmaster({ fault: "rate" }, 429);
    mockDiscord();
    const { results } = await cycleAndDrain();
    expect(results.map((r) => r.stoppedBy)).toEqual([undefined, "rate_limit"]);
    expect(await count("SELECT COUNT(*) n FROM show")).toBe(3);
    expect(await count("SELECT calls n FROM quota_usage WHERE service = 'ticketmaster'")).toBe(2);
  });

  it("7. un 429 de Discord deja el aviso pendiente y el ciclo siguiente lo envía una sola vez", async () => {
    mockTicketmaster(page(BASE_EVENTS));
    mockDiscord(429);
    await cycleAndDrain();
    mockTicketmaster(page([...BASE_EVENTS, tmEvent("E4", "K2", "V9", "ES", "2027-07-01")]));
    await cycleAndDrain(LATER);
    expect(await env.DB.prepare("SELECT status, attempts FROM delivery").first()).toEqual({ status: "pending", attempts: 0 });
    mockDiscord(200);
    expect((await publishSheets(env, LATER)).notices).toBe(1);
    expect((await publishSheets(env, LATER)).notices).toBe(0);
    expect(notices()).toHaveLength(1);
    expect(await env.DB.prepare("SELECT status, attempts FROM delivery").first()).toEqual({ status: "sent", attempts: 1 });
  });

  it("8. las páginas van en cadena: la página 0 solo encola la 1", async () => {
    mockTicketmaster(page(BASE_EVENTS, 3, 0));
    const sent: SweepJob[] = [];
    await processPage(env, { ids: ["K1", "K2"], page: 0 }, NOW, async (j) => void sent.push(j));
    expect(sent).toEqual([{ ids: ["K1", "K2"], page: 1 }]);
  });

  it("9. un 429 en una página intermedia no marca el arranque: el ciclo siguiente no da avisos falsos", async () => {
    mockTicketmaster(page(BASE_EVENTS, 2, 0));
    mockTicketmaster({ fault: "rate" }, 429);
    await cycleAndDrain();
    expect(await count("SELECT COUNT(*) n FROM follow WHERE bootstrapped_at IS NOT NULL")).toBe(0);
    mockTicketmaster(page(BASE_EVENTS, 2, 0));
    mockTicketmaster(page([tmEvent("E10", "K1", "V4", "ES", "2027-05-20")], 2, 1));
    await cycleAndDrain(LATER);
    expect(await count("SELECT COUNT(*) n FROM alert")).toBe(0);
    expect(await count("SELECT COUNT(*) n FROM follow WHERE bootstrapped_at IS NOT NULL")).toBe(2);
  });

  it("10. la cola reintenta (no descarta) una página que recibió 429", async () => {
    mockTicketmaster({ fault: "rate" }, 429);
    const batch = createMessageBatch<SweepJob>("gira-sweep", [{ id: "m1", timestamp: NOW, attempts: 1, body: { ids: ["K1"], page: 0 } }]);
    const ctx = createExecutionContext();
    await worker.queue(batch, env, ctx);
    await waitOnExecutionContext(ctx);
    const result = await getQueueResult(batch, ctx);
    expect(result.explicitAcks).toEqual([]);
    expect(result.retryMessages.map((m: { msgId: string }) => m.msgId)).toEqual(["m1"]);
  });

  it("11. dos publicaciones simultáneas: un solo canal por artista y un solo aviso", async () => {
    mockTicketmaster(page(BASE_EVENTS));
    await cycleAndDrain();
    mockTicketmaster(page([...BASE_EVENTS, tmEvent("E4", "K2", "V9", "ES", "2027-07-01")]));
    await cycleAndDrain(LATER, false);
    const [a, b] = await Promise.all([publishSheets(env, LATER), publishSheets(env, LATER)]);
    expect(a.notices + b.notices).toBe(1);
    expect(notices()).toHaveLength(1);
    expect(createdChannels.sort()).toEqual(["artista-dos", "artista-uno"]);
  });

  it("12. las fechas ya pasadas no cuentan como conocidas: gira nueva → #nuevas-giras", async () => {
    mockTicketmaster(page(BASE_EVENTS));
    await cycleAndDrain();
    await env.DB.prepare(
      `INSERT INTO show (source_id, show_key, artist_id, country, local_date, is_package, hash, snapshot_json, first_seen_at, updated_at)
       VALUES ('OLD', 'K2:VX:2026-10-01', 'a2', 'ES', '2026-10-01', 0, 'x', '{}', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
    ).run();
    mockTicketmaster(page([...BASE_EVENTS, tmEvent("E4", "K2", "V9", "ES", "2027-07-01")]));
    await cycleAndDrain(LATER);
    expect(notices().map((p) => p.path)).toEqual(["/api/v10/channels/C_NUEVAS/messages"]);
  });

  it("13. un paquete VIP visto antes no oculta la fecha real", async () => {
    mockTicketmaster(page(BASE_EVENTS));
    await cycleAndDrain();
    mockTicketmaster(page([...BASE_EVENTS, tmEvent("E4vip", "K2", "V9", "ES", "2027-07-01", "Show E4 | VIP Packages")]));
    await cycleAndDrain(LATER);
    expect(notices()).toHaveLength(0);
    mockTicketmaster(
      page([...BASE_EVENTS, tmEvent("E4vip", "K2", "V9", "ES", "2027-07-01", "Show E4 | VIP Packages"), tmEvent("E4", "K2", "V9", "ES", "2027-07-01")]),
    );
    await cycleAndDrain(new Date("2026-11-08T13:20:00Z"));
    expect(notices().map((p) => p.path)).toEqual(["/api/v10/channels/C_NUEVAS/messages"]);
  });

  it("14. con DELIVERY_PAUSED=1 no se publica nada en Discord", async () => {
    mockTicketmaster(page(BASE_EVENTS));
    await cycleAndDrain();
    mockTicketmaster(page([...BASE_EVENTS, tmEvent("E4", "K2", "V9", "ES", "2027-07-01")]));
    await cycleAndDrain(LATER, false);
    posts = [];
    createdChannels = [];
    expect(await publishSheets({ ...env, DELIVERY_PAUSED: "1" }, LATER)).toEqual({ updated: 0, notices: 0 });
    expect(posts).toHaveLength(0);
    expect(createdChannels).toHaveLength(0);
  });

  it("15. guarda el precio oficial publicado por Ticketmaster", async () => {
    mockTicketmaster(page([{ ...tmEvent("E1", "K1", "V1", "ES", "2027-05-10"), priceRanges: [{ type: "standard", currency: "EUR", min: 45, max: 250 }] }]));
    await cycleAndDrain();
    expect(await env.DB.prepare("SELECT min, max, currency, source FROM show_price WHERE source_id = 'E1'").first()).toEqual({ min: 45, max: 250, currency: "EUR", source: "Ticketmaster" });
  });
});
