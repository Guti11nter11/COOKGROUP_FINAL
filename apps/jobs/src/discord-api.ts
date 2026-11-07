const API = "https://discord.com/api/v10";
const UA = "DiscordBot (https://github.com/Guti11nter11/COOKGROUP_FINAL, 0.1) GIRA";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Llamada a la API de Discord con el bot; respeta 429 (retry_after) hasta 5 intentos. */
export async function discord<T>(token: string, method: string, path: string, body?: unknown): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: { Authorization: `Bot ${token}`, "User-Agent": UA, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 429) {
      const data = (await res.json().catch(() => ({}))) as { retry_after?: number };
      await sleep(Math.ceil((data.retry_after ?? 1) * 1000) + 250);
      continue;
    }
    if (!res.ok) throw new Error(`Discord ${method} ${path} → HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return (res.status === 204 ? undefined : await res.json()) as T;
  }
  throw new Error(`Discord ${method} ${path}: demasiados 429`);
}
