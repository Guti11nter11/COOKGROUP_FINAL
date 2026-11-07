import { createHash } from "node:crypto";

/** Cliente del Worker para los trabajos de GitHub Actions (mismo token que /ingest). */
export const GIRA = process.env.GIRA_URL ?? "https://gira-core.eleven-snk-11.workers.dev";
export const UA = "GIRA/0.1 (+https://github.com/Guti11nter11/COOKGROUP_FINAL)";

export function giraToken(): string {
  const key = process.env.TICKETMASTER_API_KEY;
  if (!key) throw new Error("Falta TICKETMASTER_API_KEY");
  return createHash("sha256").update(`gira-ingest:${key}`).digest("hex");
}

export async function gira<T>(path: string, body?: unknown): Promise<T> {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(`${GIRA}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${giraToken()}` },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (res.ok) return (await res.json()) as T;
    if (res.status === 401) throw new Error("El Worker rechazó el token (¿clave de TM rotada sin redesplegar?)");
    await new Promise((r) => setTimeout(r, 2000 * attempt));
  }
  throw new Error(`No se pudo llamar a ${path} tras 4 intentos`);
}

/** GET JSON con User-Agent identificable y reintentos suaves (APIs públicas sin clave). */
export async function getJson<T>(url: string, init: RequestInit = {}): Promise<T | null> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url, { ...init, headers: { "User-Agent": UA, Accept: "application/json", ...(init.headers ?? {}) } }).catch(() => null);
    if (res?.ok) return (await res.json()) as T;
    if (res && res.status !== 429 && res.status < 500) return null;
    await new Promise((r) => setTimeout(r, 1500 * attempt));
  }
  return null;
}
