import { env, SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { attachExtraSales } from "../src/livenation";
import type { Show } from "@gira/core";

async function token(): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("gira-ingest:test-key"));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const post = async (path: string, body: unknown) =>
  SELF.fetch(`https://gira.test${path}`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${await token()}` }, body: JSON.stringify(body) });

const LN = "https://www.livenation.es/event/u2-world-tour-barcelona-tickets-edp1001";
const show = {
  sourceId: "Z1", name: "U2", url: "https://www.ticketmaster.es/event/u2-tickets/1271385480?language=en-us", localDate: "2027-05-13", status: "offsale",
  venue: { tmId: "V", name: "Estadi", city: "Barcelona", country: "ES" }, isPackage: false,
  sales: [{ kind: "general", label: "Venta general", startsAt: "2027-01-13T09:00:00Z", endsAt: null, url: null, orderRank: 90 }],
} as unknown as Show;

describe("preventas de Live Nation", () => {
  beforeEach(async () => {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO artist (id, name, tm_attraction_id) VALUES ('a1', 'U2', 'K1')"),
      env.DB.prepare("INSERT INTO show (source_id, show_key, artist_id, country, local_date, is_package, hash, snapshot_json, first_seen_at, updated_at) VALUES ('Z1', 'k', 'a1', 'ES', '2027-05-13', 0, 'h', ?, '2026-11-01', '2026-11-01')").bind(JSON.stringify(show)),
      env.DB.prepare("INSERT INTO ln_event (url, added_at) VALUES (?, '2026-11-01')").bind(LN),
    ]);
  });

  it("guarda la preventa en su fecha de Ticketmaster, una sola vez, y amplía con las otras fechas de la gira", async () => {
    const page = { url: LN, lastDate: "2027-05-13T21:00:00Z", siblings: ["https://www.livenation.es/event/u2-world-tour-sevilla-tickets-edp1002"], sales: [{ label: "Preventa Registrados LiveNation.es", startsAt: "2026-12-12T09:00:00Z", tmEventId: "1271385480" }] };
    expect(await (await post("/enrich/ln-sales", { pages: [page] })).json()).toEqual({ pages: 1, added: 1 });
    expect(await (await post("/enrich/ln-sales", { pages: [page] })).json()).toEqual({ pages: 1, added: 0 });
    expect(await env.DB.prepare("SELECT COUNT(*) n FROM ln_event").first()).toEqual({ n: 2 });
    const [s] = await attachExtraSales(env, [show]);
    expect(s!.sales.map((w) => w.label)).toContain("Preventa Registrados LiveNation.es");
  });

  it("no acepta enlaces que no son de evento de Live Nation", async () => {
    await post("/enrich/ln-sales", { pages: [{ url: "https://www.livenation.es/search?query=U2", siblings: ["https://evil.example/x"], sales: [] }] });
    expect(await env.DB.prepare("SELECT COUNT(*) n FROM ln_event").first()).toEqual({ n: 1 });
  });
});
