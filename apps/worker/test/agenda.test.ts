import { env, fetchMock } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { postAgenda } from "../src/agenda";

const GUILD = "1568641743853715516";
const NOW = new Date("2026-11-08T21:00:00Z");
const posts: { path: string; body: any }[] = [];

beforeAll(() => {
  fetchMock.activate();
  fetchMock.disableNetConnect();
  const ok = (data: unknown) => ({ statusCode: 200, data: JSON.stringify(data), responseOptions: { headers: { "content-type": "application/json" } } });
  const d = fetchMock.get("https://discord.com");
  d.intercept({ path: `/api/v10/guilds/${GUILD}/channels`, method: "GET" })
    .reply(() => ok([{ id: "C_FUT", name: "futbol", type: 0, parent_id: null }, { id: "C_NFL", name: "nfl", type: 0, parent_id: null }]))
    .persist();
  d.intercept({ path: (p) => p.startsWith("/api/v10/channels/"), method: "POST" })
    .reply((o) => (posts.push({ path: o.path, body: JSON.parse(String(o.body)) }), ok({ id: `M${posts.length}` })))
    .persist();
});

describe("agenda de deporte", () => {
  it("publica partidos y lo que vende Ticketmaster en el canal del deporte", async () => {
    const nfl = {
      source: "ticketmaster", sourceId: "n1", name: "NFL London Game 2027", attractionIds: ["K1"], segment: "Sports", genre: "Football", subGenre: "NFL",
      venue: { tmId: "V1", name: "Wembley", city: "London", country: "GB", tz: "Europe/London" }, startsAt: "2027-10-10T13:30:00Z", localDate: "2027-10-10",
      status: "onsale", ticketLimit: null, url: "https://tm.example/n1", isPackage: false,
      sales: [{ kind: "general", label: "Venta general", startsAt: "2026-12-01T10:00:00Z", endsAt: null, url: null, orderRank: 90 }],
    };
    await env.DB.prepare("INSERT INTO artist (id, name, tm_attraction_id) VALUES ('a1', 'NFL', 'K1')").run();
    await env.DB.prepare(
      `INSERT INTO show (source_id, show_key, artist_id, country, local_date, is_package, hash, snapshot_json, first_seen_at, updated_at)
       VALUES ('n1', 'k', 'a1', 'GB', '2027-10-10', 0, 'h', ?, '2026-11-01T00:00:00Z', '2026-11-01T00:00:00Z')`,
    ).bind(JSON.stringify(nfl)).run();
    const r = await postAgenda(env, { sections: [{ channel: "futbol", title: "⚽ Próximos partidos", lines: ["<t:1:f> · **Real Madrid – Atleti**"] }, { channel: "nfl", title: "", lines: [] }] }, NOW);
    expect(r).toEqual({ channels: 2 });
    const fut = posts.find((p) => p.path.includes("C_FUT"))!.body.content as string;
    expect(fut).toContain("# 🏟️ Agenda de entradas · Fútbol");
    expect(fut).toContain("**Real Madrid – Atleti**");
    const nflMsg = posts.find((p) => p.path.includes("C_NFL"))!.body.content as string;
    expect(nflMsg).toContain("**NFL London Game 2027** · 🇬🇧 London · Venta general:");
  });
});
