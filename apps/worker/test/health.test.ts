import { env, SELF } from "cloudflare:test";
import { expect, it } from "vitest";

it("/health devuelve estado y contadores, sin indexar", async () => {
  await env.DB.batch([
    env.DB.prepare("INSERT INTO quota_usage (service, day, calls) VALUES ('ticketmaster', ?, 7)").bind(new Date().toISOString().slice(0, 10)),
    env.DB.prepare("INSERT INTO job_run (job, started_at, finished_at, ok, result_json) VALUES ('cycle', '2026-11-08T12:00:00Z', '2026-11-08T12:00:01Z', 1, '{\"jobs\":5}')"),
  ]);
  const res = await SELF.fetch("https://gira.test/health");
  expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  expect(await res.json()).toEqual({
    ok: true,
    lastCycleAt: "2026-11-08T12:00:00Z",
    lastOk: true,
    lastResult: { jobs: 5 },
    counts: { artists: 0, shows: 0, alerts: 0, sent: 0, pending: 0, tmCallsToday: 7 },
  });
});

it("cualquier otra ruta → 404", async () => expect((await SELF.fetch("https://gira.test/")).status).toBe(404));
