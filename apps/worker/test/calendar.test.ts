import { env, fetchMock, SELF } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Show } from "@gira/core";
import { runCalendar } from "../src/calendar";

const GUILD = "1568641743853715516";
let posts: { path: string; body: { content: string; flags?: number } }[] = [];

const show = (id: string, saleAt: string): Show => ({
  source: "ticketmaster", sourceId: id, name: "U2 - Tour 2027", attractionIds: ["K1"],
  venue: { tmId: `V${id}`, name: "Estadio", city: id === "1" ? "Sevilla" : "Barcelona", country: "ES", tz: "Europe/Madrid" },
  startsAt: "2027-05-10T19:00:00Z", localDate: "2027-05-10", status: "onsale", ticketLimit: null, url: `https://tm.example/${id}`, isPackage: false,
  sales: [{ kind: "artist", label: "Artist Presale", startsAt: saleAt, endsAt: null, url: null, orderRank: 20 }],
});

beforeAll(() => {
  fetchMock.activate();
  fetchMock.disableNetConnect();
  const ok = (data: unknown) => ({ statusCode: 200, data: JSON.stringify(data), responseOptions: { headers: { "content-type": "application/json" } } });
  const d = fetchMock.get("https://discord.com");
  d.intercept({ path: `/api/v10/guilds/${GUILD}/channels`, method: "GET" })
    .reply(() => ok([
      { id: "CAT", name: "📅 CALENDARIO", type: 4, parent_id: null },
      { id: "C_REC", name: "recordatorios", type: 0, parent_id: "CAT" },
      { id: "C_DAY", name: "daily-release", type: 0, parent_id: "CAT" },
      { id: "C_WEEK", name: "esta-semana", type: 0, parent_id: "CAT" },
    ]))
    .persist();
  d.intercept({ path: (p) => p.startsWith("/api/v10/channels/"), method: "POST" })
    .reply((o) => (posts.push({ path: o.path, body: JSON.parse(String(o.body)) }), ok({ id: `M${posts.length}` })))
    .persist();
  d.intercept({ path: (p) => p.startsWith("/api/v10/channels/"), method: "PATCH" }).reply(() => ok({})).persist();
});

beforeEach(async () => {
  posts = [];
  const shows = [show("1", "2026-11-10T09:00:00Z"), show("2", "2026-11-10T09:00:00Z")];
  await env.DB.batch([
    env.DB.prepare("INSERT INTO artist (id, name, tm_attraction_id) VALUES ('a1', 'U2', 'K1')"),
    env.DB.prepare("INSERT INTO sheet (artist_id, channel_id, updated_at) VALUES ('a1', 'CH_U2', 'x')"),
    ...shows.map((s) =>
      env.DB.prepare(
        `INSERT INTO show (source_id, show_key, artist_id, country, local_date, is_package, hash, snapshot_json, first_seen_at, updated_at)
         VALUES (?, ?, 'a1', 'ES', ?, 0, 'h', ?, 'x', 'x')`,
      ).bind(s.sourceId, `k${s.sourceId}`, s.localDate, JSON.stringify(s)),
    ),
  ]);
});

const at = (p: string) => posts.filter((x) => x.path === `/api/v10/channels/${p}/messages`);

describe("reloj de GIRA", () => {
  it("1 h antes: un único recordatorio agrupado (las dos fechas) y que suena", async () => {
    await runCalendar(env, new Date("2026-11-10T08:05:00Z"));
    const rec = at("C_REC");
    expect(rec).toHaveLength(1);
    expect(rec[0]!.body.content).toContain("⏰ **U2** · Artist Presale en 1 hora — **10:00** Madrid");
    expect(rec[0]!.body.content).toContain("🇪🇸 Sevilla, 🇪🇸 Barcelona → <#CH_U2>");
    expect(rec[0]!.body.flags! & 4096).toBe(0); // suena (no silencioso)
    posts = [];
    await runCalendar(env, new Date("2026-11-10T08:10:00Z"));
    expect(at("C_REC")).toHaveLength(0);
  });

  it("resumen de las 21:00 una sola vez; esta semana se publica y luego se edita", async () => {
    await runCalendar(env, new Date("2026-11-09T20:02:00Z"));
    expect(at("C_DAY").map((p) => p.body.content).join("\n")).toContain("Resumen de la noche");
    expect(at("C_WEEK")).toHaveLength(1);
    posts = [];
    await runCalendar(env, new Date("2026-11-09T20:07:00Z"));
    expect(at("C_DAY")).toHaveLength(0);
    expect(at("C_WEEK")).toHaveLength(0);
  });

  it("calendario .ics con token; sin token → 401", async () => {
    expect((await SELF.fetch("https://gira.test/calendar.ics?t=malo")).status).toBe(401);
    const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("gira-ics:test-key"));
    const t = [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
    const res = await SELF.fetch(`https://gira.test/calendar.ics?t=${t}`);
    expect(res.headers.get("content-type")).toContain("text/calendar");
    expect(await res.text()).toContain("BEGIN:VCALENDAR");
  });
});
