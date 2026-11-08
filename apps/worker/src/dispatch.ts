import { JOB_SLOTS, madridDay, slotDue } from "@gira/core";
import type { Env } from "./env";

/**
 * GitHub se salta o retrasa a menudo los `schedule`. El cron del Worker es fiable: lanza los trabajos
 * con `workflow_dispatch` a horas fijas de Madrid (JOB_SLOTS), nunca de madrugada. Necesita el secreto
 * GH_DISPATCH_TOKEN (token con permiso Actions: write sobre este repo).
 */
const REPO = "Guti11nter11/COOKGROUP_FINAL";
const REF = "claude/vigilant-euler-pkmop0";

export async function dispatchJobs(env: Env, now: Date): Promise<string[]> {
  if (!env.GH_DISPATCH_TOKEN) return [];
  const day = madridDay(now);
  const launched: string[] = [];
  for (const [file, slots] of Object.entries(JOB_SLOTS)) {
    const { results } = await env.DB.prepare("SELECT key FROM setting WHERE key LIKE ?").bind(`dispatch|${file}|${day}|%`).all<{ key: string }>();
    const done = new Set(results.map((r) => r.key.split("|")[3]!));
    const slot = slotDue(slots, now, done);
    if (!slot) continue;
    const res = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${file}/dispatches`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.GH_DISPATCH_TOKEN}`,
        accept: "application/vnd.github+json",
        "user-agent": "GIRA-worker",
        "x-github-api-version": "2022-11-28",
        "content-type": "application/json",
      },
      body: JSON.stringify({ ref: REF }),
    }).catch(() => null);
    if (res && (res.status === 204 || res.ok)) {
      await env.DB.prepare("INSERT OR REPLACE INTO setting (key, value) VALUES (?, ?)").bind(`dispatch|${file}|${day}|${slot}`, now.toISOString()).run();
      launched.push(`${file}@${slot}`);
    } else {
      console.log(`dispatch ${file}: HTTP ${res?.status ?? "sin respuesta"}`);
    }
  }
  // Limpieza: claves de días anteriores.
  await env.DB.prepare("DELETE FROM setting WHERE key LIKE 'dispatch|%' AND key NOT LIKE ?").bind(`dispatch|%|${day}|%`).run();
  return launched;
}
