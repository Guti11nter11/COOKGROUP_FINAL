import { deliverPending, processPage, runCycle } from "./cycle";
import type { Env, SweepJob } from "./env";

async function scheduled(env: Env, now: Date): Promise<void> {
  const started = now.toISOString();
  const run = await env.DB.prepare("INSERT INTO job_run (job, started_at) VALUES ('cycle', ?) RETURNING id").bind(started).first<{ id: number }>();
  let ok = 1;
  let result: unknown;
  try {
    const cycle = await runCycle(env, now, async (j) => void (await env.SWEEP_QUEUE.send(j)));
    const delivered = await deliverPending(env, now);
    result = { ...cycle, delivered };
  } catch (e) {
    ok = 0;
    result = { error: String(e) };
    throw e;
  } finally {
    await env.DB.prepare("UPDATE job_run SET finished_at = ?, ok = ?, result_json = ? WHERE id = ?")
      .bind(new Date().toISOString(), ok, JSON.stringify(result), run!.id)
      .run();
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/health") {
      const last = await env.DB.prepare("SELECT started_at, finished_at, ok, result_json FROM job_run ORDER BY id DESC LIMIT 1").first<{
        started_at: string;
        finished_at: string | null;
        ok: number | null;
        result_json: string | null;
      }>();
      const today = new Date().toISOString().slice(0, 10);
      const c = await env.DB.prepare(
        `SELECT (SELECT COUNT(*) FROM artist) AS artists, (SELECT COUNT(*) FROM show) AS shows, (SELECT COUNT(*) FROM alert) AS alerts,
                (SELECT COUNT(*) FROM delivery WHERE status = 'sent') AS sent, (SELECT COUNT(*) FROM delivery WHERE status = 'pending') AS pending,
                (SELECT COALESCE(SUM(calls), 0) FROM quota_usage WHERE service = 'ticketmaster' AND day = ?) AS tmCallsToday`,
      )
        .bind(today)
        .first<Record<string, number>>();
      return Response.json(
        {
          ok: true,
          lastCycleAt: last?.started_at ?? null,
          lastOk: last?.ok === 1,
          lastResult: last?.result_json ? JSON.parse(last.result_json) : null,
          counts: c,
        },
        { headers: { "X-Robots-Tag": "noindex, nofollow" } },
      );
    }
    return new Response("GIRA", { status: 404, headers: { "X-Robots-Tag": "noindex, nofollow" } });
  },

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(scheduled(env, new Date(controller.scheduledTime)));
  },

  async queue(batch: MessageBatch<SweepJob>, env: Env): Promise<void> {
    for (const msg of batch.messages) {
      const now = new Date();
      const r = await processPage(env, msg.body, now, async (j) => void (await env.SWEEP_QUEUE.send(j)));
      if (r.stoppedBy === "rate_limit") {
        msg.retry({ delaySeconds: 120 }); // Ticketmaster pidió esperar: se reintenta, no se descarta
        continue;
      }
      if (r.alerts > 0) await deliverPending(env, now);
      msg.ack();
    }
  },
} satisfies ExportedHandler<Env, SweepJob>;
