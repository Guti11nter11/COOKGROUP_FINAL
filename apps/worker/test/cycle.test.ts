import { env, fetchMock } from "cloudflare:test";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { SweepJob } from "../src/env";
import { deliverPending, processPage, runCycle } from "../src/cycle";

const GUILD = "1568641743853715516";
const NOW = new Date("2026-11-08T12:00:00Z"); // minuto 0 → barrido completo, de día
const LATER = new Date("2026-11-08T13:00:00Z"); // ciclo siguiente, fuera de la ventana de "mismo anuncio"
const CHANNELS = [
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
let discordPostStatus = 200;

async function seedArtists() {
  await env.DB.batch([
    env.DB.prepare("INSERT INTO artist (id, name, tm_attraction_id) VALUES ('a1', 'Artista Uno', 'K1'), ('a2', 'Artista Dos', 'K2')"),
    env.DB.prepare("INSERT INTO follow (artist_id, tier) VALUES ('a1', 3), ('a2', 2)"),
  ]);
}

function mockTicketmaster(body: unknown, status = 200, times = 1) {
  fetchMock
    .get("https://app.ticketmaster.com")
    .intercept({ path: (p) => p.startsWith("/discovery/v2/events.json") })
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
async function cycleAndDrain(now = NOW) {
  const queue: SweepJob[] = [];
  const send = async (j: SweepJob) => void queue.push(j);
  const cycle = await runCycle(env, now, send);
  const results = [];
  while (queue.length) results.push(await processPage(env, queue.shift()!, now, send));
  const delivered = await deliverPending(env, now);
  return { cycle, results, delivered };
}

const count = async (sql: string) => (await env.DB.prepare(sql).first<{ n: number }>())!.n;

beforeAll(() => {
  fetchMock.activate();
  fetchMock.disableNetConnect();
  mockDiscordOnce();
});
beforeEach(async () => {
  posts = [];
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
    expect(posts).toHaveLength(0);
  });

  it("2. fecha nueva de un artista sin fechas en ese país → #nuevas-giras", async () => {
    mockTicketmaster(page(BASE_EVENTS));
    mockDiscord();
    await cycleAndDrain();
    mockTicketmaster(page([...BASE_EVENTS, tmEvent("E4", "K2", "V9", "ES", "2027-07-01")]));
    await cycleAndDrain(LATER);
    expect(await count("SELECT COUNT(*) n FROM alert WHERE kind = 'new_event'")).toBe(1);
    expect(posts.map((p) => p.path)).toEqual(["/api/v10/channels/C_NUEVAS/messages"]);
    expect(JSON.stringify(posts[0]!.body)).toContain("Artista Dos");
  });

  it("2b. fecha nueva de un artista que ya tiene fechas en el país → #fechas-extra", async () => {
    mockTicketmaster(page(BASE_EVENTS));
    mockDiscord();
    await cycleAndDrain();
    mockTicketmaster(page([...BASE_EVENTS, tmEvent("E5", "K1", "V1", "ES", "2027-05-11")]));
    await cycleAndDrain(LATER);
    expect(posts.map((p) => p.path)).toEqual(["/api/v10/channels/C_EXTRA/messages"]);
  });

  it("2c. varias fechas nuevas del mismo anuncio en un país sin fechas → todas son 'fecha nueva'", async () => {
    mockTicketmaster(page(BASE_EVENTS));
    mockDiscord();
    await cycleAndDrain();
    mockTicketmaster(page([...BASE_EVENTS, tmEvent("E8", "K2", "V9", "ES", "2027-07-01"), tmEvent("E9", "K2", "V9", "ES", "2027-07-02")]));
    await cycleAndDrain(LATER);
    expect(posts.map((p) => p.path)).toEqual(["/api/v10/channels/C_NUEVAS/messages", "/api/v10/channels/C_NUEVAS/messages"]);
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
    expect(posts).toHaveLength(1);
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
    expect(await env.DB.prepare("SELECT status, attempts FROM delivery").first()).toEqual({ status: "pending", attempts: 1 });
    mockDiscord(200);
    expect(await deliverPending(env, LATER)).toBe(1);
    expect(await deliverPending(env, LATER)).toBe(0);
    expect(await env.DB.prepare("SELECT status, attempts FROM delivery").first()).toEqual({ status: "sent", attempts: 2 });
  });
});
