import type { Env } from "./env";

/**
 * GitHub se salta o retrasa a menudo los `schedule` (esta noche el radar horario corrió una vez en 6 h).
 * El cron del Worker es fiable: lanza los trabajos con `workflow_dispatch` cuando les toca. Solo si
 * existe el secreto GH_DISPATCH_TOKEN (token con permiso Actions: write sobre este repo).
 */
const REPO = "Guti11nter11/COOKGROUP_FINAL";
const REF = "claude/vigilant-euler-pkmop0";
export const JOBS: { file: string; everyMin: number }[] = [
  { file: "feed-radar.yml", everyMin: 60 },
  { file: "news-radar.yml", everyMin: 120 },
  { file: "enrich.yml", everyMin: 180 },
];

export function due(last: string | null, everyMin: number, now: Date): boolean {
  return !last || now.getTime() - Date.parse(last) >= everyMin * 60_000 - 60_000;
}

export async function dispatchJobs(env: Env, now: Date): Promise<string[]> {
  if (!env.GH_DISPATCH_TOKEN) return [];
  const launched: string[] = [];
  for (const j of JOBS) {
    const key = `dispatch|${j.file}`;
    const last = (await env.DB.prepare("SELECT value FROM setting WHERE key = ?").bind(key).first<{ value: string }>())?.value ?? null;
    if (!due(last, j.everyMin, now)) continue;
    const res = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${j.file}/dispatches`, {
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
      await env.DB.prepare("INSERT INTO setting (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value").bind(key, now.toISOString()).run();
      launched.push(j.file);
    } else {
      console.log(`dispatch ${j.file}: HTTP ${res?.status ?? "sin respuesta"}`);
    }
  }
  return launched;
}
