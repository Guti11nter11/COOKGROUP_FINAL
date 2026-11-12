import { env, fetchMock, SELF } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Show } from "@gira/core";

async function token(): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("gira-ingest:test-key"));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const call = async (path: string, init: RequestInit = {}, auth = true) =>
  SELF.fetch(`https://gira.test${path}`, { ...init, headers: { "content-type": "application/json", ...(auth ? { authorization: `Bearer ${await token()}` } : {}) } });

const show = (id: string, venue: string, name = "Artista Uno - Tour 2027"): Show => ({
  source: "ticketmaster", sourceId: id, name, attractionIds: ["K1"],
  venue: { tmId: venue, name: `Estadio ${venue}`, city: "Madrid", country: "ES", tz: "Europe/Madrid" },
  startsAt: "2099-05-10T19:00:00Z", localDate: "2099-05-10", status: "onsale", ticketLimit: null, url: `https://tm.example/${id}`, isPackage: false,
  sales: [{ kind: "general", label: "Venta general", startsAt: "2099-01-20T09:00:00Z", endsAt: null, url: null, orderRank: 90 }],
});

beforeAll(() => {
  fetchMock.activate();
  fetchMock.disableNetConnect();
});

beforeEach(async () => {
  const s1 = show("1", "V1");
  const s2 = show("2", "V2");
  await env.DB.batch([
    env.DB.prepare("INSERT INTO artist (id, name, tm_attraction_id) VALUES ('a1', 'Artista Uno', 'K1'), ('a2', 'Otro', 'K2')"),
    env.DB.prepare("INSERT INTO follow (artist_id, tier) VALUES ('a1', 3)"),
    env.DB.prepare("INSERT INTO sheet (artist_id, channel_id, updated_at) VALUES ('a1', 'CH', '2026-01-01T00:00:00Z')"),
    ...[s1, s2].map((s) =>
      env.DB.prepare(
        `INSERT INTO show (source_id, show_key, artist_id, country, local_date, is_package, hash, snapshot_json, first_seen_at, updated_at)
         VALUES (?, ?, 'a1', 'ES', ?, 0, 'h', ?, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')`,
      ).bind(s.sourceId, `K1:${s.venue.tmId}:${s.localDate}`, s.localDate, JSON.stringify(s)),
    ),
    env.DB.prepare("INSERT INTO venue_info (tm_venue_id, name, capacity, checked_at) VALUES ('V2', 'Estadio V2', 50000, '2026-01-01T00:00:00Z')"),
  ]);
});

describe("/enrich", () => {
  it("sin token → 401", async () => expect((await call("/enrich/todo", {}, false)).status).toBe(401));

  it("todo: recintos sin aforo, fechas sin precio y artistas de fichas activas", async () => {
    const todo = (await (await call("/enrich/todo")).json()) as { venues: { tmId: string }[]; shows: { sourceId: string }[]; artists: { name: string; dates: number }[] };
    expect(todo.venues.map((v) => v.tmId)).toEqual(["V1"]);
    expect(todo.shows.map((s) => s.sourceId).sort()).toEqual(["1", "2"]);
    expect(todo.artists).toMatchObject([{ name: "Artista Uno", dates: 2 }]);
  });

  it("guarda aforos, precios y reventa y marca la ficha para regenerarla", async () => {
    const res = await call("/enrich", {
      method: "POST",
      body: JSON.stringify({
        venues: [{ tmId: "V1", name: "Estadio V1", capacity: 70000, wikidataId: "Q1", source: "Wikidata" }, { tmId: "VX", name: "Raro", capacity: 9_000_000 }],
        prices: [{ sourceId: "1", min: 45, max: 250, currency: "EUR", source: "El País" }],
        resale: [{ artistId: "a1", info: { low: 1.5, high: 2.5, confidence: "baja", basis: "modelo" } }],
      }),
    });
    expect(await res.json()).toEqual({ venues: 1, prices: 1, resale: 1, signups: 0, limits: 0 });
    expect(await env.DB.prepare("SELECT capacity FROM venue_info WHERE tm_venue_id = 'V1'").first()).toEqual({ capacity: 70000 });
    expect(await env.DB.prepare("SELECT source FROM show_price WHERE source_id = '1'").first()).toEqual({ source: "El País" });
    expect(await env.DB.prepare("SELECT COUNT(*) n FROM sheet_dirty WHERE artist_id = 'a1'").first()).toEqual({ n: 1 });
  });

  it("guarda la web oficial y los enlaces de registro (sin pases de cola)", async () => {
    await call("/enrich", {
      method: "POST",
      body: JSON.stringify({
        signups: [{ artistId: "a1", homepage: "https://www.artista.com/", links: [
          { url: "https://www.bandsintown.com/t/1?release_id=x", label: "Bandsintown", city: "Madrid", localDate: "2099-05-10" },
          { url: "https://x.com/?queueittoken=abc", label: "Malo" },
        ] }],
      }),
    });
    expect((await env.DB.prepare("SELECT url FROM artist_signup").all()).results).toEqual([{ url: "https://www.bandsintown.com/t/1?release_id=x" }]);
    expect(await env.DB.prepare("SELECT homepage FROM artist WHERE id = 'a1'").first()).toEqual({ homepage: "https://www.artista.com/" });
    const todo = (await (await call("/enrich/todo")).json()) as { artists: { homepage: string | null }[] };
    expect(todo.artists[0]!.homepage).toBe("https://www.artista.com/");
  });

  it("un precio de otra fuente no pisa el de Ticketmaster", async () => {
    await env.DB.prepare("INSERT INTO show_price (source_id, min, max, currency, source, updated_at) VALUES ('1', 50, 200, 'EUR', 'Ticketmaster', 'x')").run();
    await call("/enrich", { method: "POST", body: JSON.stringify({ prices: [{ sourceId: "1", min: 10, max: 20, currency: "EUR", source: "Prensa" }] }) });
    expect(await env.DB.prepare("SELECT min, source FROM show_price WHERE source_id = '1'").first()).toEqual({ min: 50, source: "Ticketmaster" });
  });
});

describe("/enrich/news", () => {
  it("guarda noticias nuevas una sola vez", async () => {
    const body = JSON.stringify({ items: [{ artistName: "artista uno", title: "Fecha extra", url: "https://x.es/n1", source: "x.es", category: "extra_date", summary: "Fecha extra en Madrid" }] });
    await env.DB.prepare("UPDATE sheet SET status = 'archived'").run(); // sin canal activo: no hace falta Discord
    const first = (await (await call("/enrich/news", { method: "POST", body })).json()) as { stored: number };
    const again = (await (await call("/enrich/news", { method: "POST", body })).json()) as { stored: number };
    expect([first.stored, again.stored]).toEqual([1, 0]);
    expect(await env.DB.prepare("SELECT artist_id, category FROM news").first()).toEqual({ artist_id: "a1", category: "extra_date" });
  });
});

describe("/enrich/discover y /enrich/follows", () => {
  it("sigue (⭐⭐) lo descubierto una sola vez, ya arrancado, y lo devuelve en la lista", async () => {
    const body = JSON.stringify({ entities: [{ tmAttractionId: "K8vZ9NUEVO", name: "Nuevo", hotDates: 3 }, { tmAttractionId: "x", name: "malo", hotDates: 1 }] });
    const a = (await (await call("/enrich/discover", { method: "POST", body })).json()) as { added: number };
    const b = (await (await call("/enrich/discover", { method: "POST", body })).json()) as { added: number };
    expect([a.added, b.added]).toEqual([1, 0]);
    expect(await env.DB.prepare("SELECT tier, bootstrapped_at IS NOT NULL AS boot FROM follow WHERE artist_id = 'a_K8vZ9NUEVO'").first()).toEqual({ tier: 2, boot: 1 });
    const ids = ((await (await call("/enrich/follows")).json()) as { ids: string[] }).ids;
    expect(ids).toContain("K8vZ9NUEVO");
    expect(ids).toContain("K1");
  });
});

import { newsLine, newsWorthPosting } from "../src/news";
describe("qué noticias se publican", () => {
  const n = (artistName: string, category: string, channelId: string | null = null) => ({ artistName, category, channelId, summary: "Gira 2027 en Madrid", url: "https://x.example/a" });
  it("solo importantes, de artistas sin ficha activa y una por artista", () => {
    const out = newsWorthPosting([n("U2", "extra_date", "CH_U2"), n("Maluma", "tour_announced"), n("Maluma", "presale"), n("NFL", "price"), n("Feid", "signup")]);
    expect(out.map((x) => `${x.artistName}|${x.category}`)).toEqual(["Maluma|tour_announced", "Feid|signup"]);
  });
  it("con ficha activa, solo una preventa que la ficha no tiene (la de Live Nation de U2 en España)", () => {
    const out = newsWorthPosting([{ ...n("U2", "presale", "CH_U2"), uncovered: "Live Nation" }, { ...n("U2", "presale", "CH_U2"), uncovered: null }]);
    expect(out).toHaveLength(1);
  });
  it("sin fuente; los registros llevan enlace para apuntarse", () => {
    expect(newsLine(n("Maluma", "tour_announced"))).toBe("🆕 **Maluma** · Gira 2027 en Madrid");
    expect(newsLine(n("Feid", "signup"))).toBe("📝 **Feid** · Gira 2027 en Madrid · [más info](<https://x.example/a>)");
  });
});
