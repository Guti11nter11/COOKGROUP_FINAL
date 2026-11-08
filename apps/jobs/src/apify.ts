/** Apify (plan FREE, 5 $/mes): ejecutar un actor, esperar y leer su dataset; con freno de gasto. */
const API = "https://api.apify.com/v2";

function headers(): Record<string, string> {
  const t = process.env.APIFY_TOKEN;
  return { "content-type": "application/json", ...(t ? { authorization: `Bearer ${t}` } : {}) };
}

/** Gasto del mes y límite de la cuenta (null si no se puede leer). */
export async function apifyBudget(): Promise<{ used: number; limit: number } | null> {
  const res = await fetch(`${API}/users/me/limits`, { headers: headers() }).catch(() => null);
  if (!res?.ok) return null;
  const d = ((await res.json()) as { data?: { current?: { monthlyUsageUsd?: number }; limits?: { maxMonthlyUsageUsd?: number } } }).data;
  return { used: d?.current?.monthlyUsageUsd ?? 0, limit: d?.limits?.maxMonthlyUsageUsd ?? 5 };
}

/** Límite del propietario (2026-11-08): como mucho 1 $ al día en Apify, el único servicio de pago. */
export const APIFY_DAILY_CAP_USD = 1;

/** Gasto de Apify de hoy (UTC) según su propio contador diario; null si no se puede leer. */
export async function apifyToday(): Promise<number | null> {
  const res = await fetch(`${API}/users/me/usage/monthly`, { headers: headers() }).catch(() => null);
  if (!res?.ok) return null;
  const d = ((await res.json()) as { data?: { dailyServiceUsages?: { date: string; totalUsageCreditsUsd: number }[] } }).data;
  const today = new Date().toISOString().slice(0, 10);
  return d?.dailyServiceUsages?.find((x) => x.date.slice(0, 10) === today)?.totalUsageCreditsUsd ?? 0;
}

/**
 * ¿Se puede gastar `planned` $ más? Hoy por debajo de 1 $ (contando lo previsto) y el mes por debajo
 * del 90 % del límite de la cuenta. Si no se puede leer el gasto, no se gasta.
 */
export async function apifyAllowed(planned: number): Promise<{ ok: boolean; today: number | null; month: number | null }> {
  const [today, budget] = await Promise.all([apifyToday(), apifyBudget()]);
  const ok = today !== null && !!budget && today + planned <= APIFY_DAILY_CAP_USD && budget.used + planned <= budget.limit * 0.9;
  return { ok, today, month: budget?.used ?? null };
}

export async function runActor<T>(actor: string, input: unknown, opts: { maxItems?: number; timeoutSecs?: number } = {}): Promise<T[]> {
  const qs = new URLSearchParams({ timeout: String(opts.timeoutSecs ?? 240), ...(opts.maxItems ? { maxItems: String(opts.maxItems) } : {}) });
  const start = await fetch(`${API}/acts/${actor.replace("/", "~")}/runs?${qs}`, { method: "POST", headers: headers(), body: JSON.stringify(input) });
  if (!start.ok) throw new Error(`Apify ${actor}: HTTP ${start.status}`);
  const run = ((await start.json()) as { data: { id: string; defaultDatasetId: string } }).data;
  const deadline = Date.now() + ((opts.timeoutSecs ?? 240) + 60) * 1000;
  for (;;) {
    await new Promise((r) => setTimeout(r, 5000));
    const st = await fetch(`${API}/actor-runs/${run.id}`, { headers: headers() }).then((r) => r.json() as Promise<{ data: { status: string } }>);
    if (!["READY", "RUNNING"].includes(st.data.status)) break;
    if (Date.now() > deadline) throw new Error(`Apify ${actor}: sin terminar a tiempo`);
  }
  const items = await fetch(`${API}/datasets/${run.defaultDatasetId}/items?clean=true&limit=${opts.maxItems ?? 1000}`, { headers: headers() });
  return items.ok ? ((await items.json()) as T[]) : [];
}
