import { ingestShows, processPage, runCycle } from "./cycle";
import { publishSheets, refreshActiveSheets } from "./sheets";
import type { EnrichInput } from "@gira/core";
import { announceSignups, applyEnrichment, discover, enrichTodo, followIds, storePriceImage } from "./enrich";
import { ingestNews, type NewsInput } from "./news";
import { handleAuth } from "./auth";
import { handleApi } from "./app-api";
import { handleInteraction, verifyDiscord } from "./interactions";
import { dispatchJobs } from "./dispatch";
import { isSweepTick } from "@gira/core";
import { announceCalendar, calendarIcs, icsToken, runCalendar, updateStatusPanel } from "./calendar";
import type { Env, SweepJob } from "./env";

async function scheduled(env: Env, now: Date): Promise<void> {
  const started = now.toISOString();
  const run = await env.DB.prepare("INSERT INTO job_run (job, started_at) VALUES ('cycle', ?) RETURNING id").bind(started).first<{ id: number }>();
  let ok = 1;
  let result: unknown;
  try {
    // El reloj va siempre (recordatorios y resúmenes: solo base de datos, sin coste). El barrido de
    // Ticketmaster, las fichas y los trabajos siguen el horario por franjas (de 00:00 a 08:00, nada).
    const calendar = await runCalendar(env, now).catch((e) => ({ error: String(e) }));
    if (!isSweepTick(now)) {
      result = { calendar, sweep: "fuera de franja" };
      return;
    }
    const cycle = await runCycle(env, now, async (j) => void (await env.SWEEP_QUEUE.send(j)));
    await refreshActiveSheets(env, now).catch(() => 0);
    const sheets = await publishSheets(env, now);
    const panel = await updateStatusPanel(env, now).catch(() => false);
    const dispatched = await dispatchJobs(env, now).catch(() => []);
    result = { ...cycle, ...sheets, calendar, panel, ...(dispatched.length ? { dispatched } : {}) };
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

/** Token de ingesta derivado de la clave de Ticketmaster (los dos lados lo calculan; nunca viaja en claro en el repo). */
async function ingestToken(env: Env): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`gira-ingest:${env.TICKETMASTER_API_KEY}`));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function sameString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/ingest" && req.method === "POST") {
      const auth = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
      if (!sameString(auth, await ingestToken(env))) return new Response("No autorizado", { status: 401 });
      const now = new Date();
      const r = await ingestShows(env, await req.json(), now);
      if (r.stored > 0) ctx.waitUntil(publishSheets(env, now));
      return Response.json(r);
    }
    if (url.pathname.startsWith("/enrich")) {
      const auth = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
      if (!sameString(auth, await ingestToken(env))) return new Response("No autorizado", { status: 401 });
      const now = new Date();
      if (url.pathname === "/enrich/todo" && req.method === "GET") return Response.json(await enrichTodo(env, now));
      if (url.pathname === "/enrich/preview") {
        // Texto de las fichas activas (solo datos públicos: fechas, precios, enlaces oficiales) para revisarlas.
        const { results } = await env.DB.prepare(
          "SELECT a.name, h.rendered_json FROM sheet h JOIN artist a ON a.id = h.artist_id WHERE h.status = 'active' AND h.rendered_json IS NOT NULL LIMIT 20",
        ).all<{ name: string; rendered_json: string }>();
        return Response.json(results.map((r) => ({ name: r.name, messages: JSON.parse(r.rendered_json) as string[] })));
      }
      // Fuerza una pasada de publicación y devuelve el resultado (con errores de Discord, si los hay).
      if (url.pathname === "/enrich/publish" && req.method === "POST") return Response.json(await publishSheets(env, now));
      if (url.pathname === "/enrich/follows") return Response.json({ ids: await followIds(env) });
      if (url.pathname === "/enrich/discover" && req.method === "POST") return Response.json(await discover(env, (await req.json()) as never, now));
      if (url.pathname === "/enrich/price-image" && req.method === "POST") {
        const q = { artistId: url.searchParams.get("artist"), hash: url.searchParams.get("hash"), mime: req.headers.get("content-type") };
        return Response.json(await storePriceImage(env, q, await req.arrayBuffer(), now));
      }
      if (url.pathname === "/enrich/news" && req.method === "POST") return Response.json(await ingestNews(env, (await req.json()) as NewsInput, now));
      if (url.pathname === "/enrich" && req.method === "POST") {
        // Las fichas marcadas se regeneran en el siguiente ciclo (cada 5 min), sin ráfagas a Discord.
        const r = await applyEnrichment(env, (await req.json()) as EnrichInput, now);
        if (r.freshSignups) ctx.waitUntil(announceSignups(env, r.freshSignups).catch(() => 0));
        return Response.json({ venues: r.venues, prices: r.prices, resale: r.resale, signups: r.signups, limits: r.limits });
      }
      return new Response("No encontrado", { status: 404 });
    }
    if (url.pathname === "/discord/interactions" && req.method === "POST") {
      const raw = await req.text();
      if (!(await verifyDiscord(env, req, raw))) return new Response("Firma no válida", { status: 401 });
      return handleInteraction(env, raw, new Date());
    }
    // App GIRA (PWA privada): ficheros públicos sin datos; los datos van por /api con sesión.
    if (url.pathname === "/robots.txt") return new Response("User-agent: *\nDisallow: /\n", { headers: { "content-type": "text/plain" } });
    if (url.pathname.startsWith("/api/auth/")) return handleAuth(env, req, url);
    if (url.pathname.startsWith("/api/")) return handleApi(env, req, url);
    if (url.pathname === "/app") return Response.redirect(`${url.origin}/app/`, 301);
    if (url.pathname.startsWith("/app/") && env.ASSETS) {
      const res = await env.ASSETS.fetch(req);
      const headers = new Headers(res.headers);
      headers.set("X-Robots-Tag", "noindex, nofollow");
      headers.set("Referrer-Policy", "no-referrer");
      headers.set("X-Content-Type-Options", "nosniff");
      headers.set("Content-Security-Policy", "default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'");
      if (url.pathname.endsWith("sw.js")) headers.set("Service-Worker-Allowed", "/app/");
      return new Response(res.body, { status: res.status, headers });
    }
    if (url.pathname === "/calendar.ics") {
      if (!sameString(url.searchParams.get("t") ?? "", await icsToken(env))) return new Response("No autorizado", { status: 401 });
      return new Response(await calendarIcs(env, new Date()), {
        headers: { "content-type": "text/calendar; charset=utf-8", "cache-control": "private, max-age=900", "X-Robots-Tag": "noindex, nofollow" },
      });
    }
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
                (SELECT COALESCE(SUM(calls), 0) FROM quota_usage WHERE service = 'ticketmaster' AND day = ?) AS tmCallsToday,
                (SELECT value FROM setting WHERE key = 'sheets_last_error') AS sheetsLastError`,
      )
        .bind(today)
        .first<Record<string, number | string | null>>();
      ctx.waitUntil(announceCalendar(env, url.origin).catch(() => undefined));
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

  async queue(batch: MessageBatch<SweepJob>, env: Env, _ctx: ExecutionContext): Promise<void> {
    for (const msg of batch.messages) {
      const now = new Date();
      const r = await processPage(env, msg.body, now, async (j) => void (await env.SWEEP_QUEUE.send(j)));
      if (r.stoppedBy === "rate_limit") {
        msg.retry({ delaySeconds: 120 }); // Ticketmaster pidió esperar: se reintenta, no se descarta
        continue;
      }
      if (r.shows > 0) await publishSheets(env, now);
      msg.ack();
    }
  },
} satisfies ExportedHandler<Env, SweepJob>;
