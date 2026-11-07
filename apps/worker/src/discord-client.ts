import type { Env } from "./env";

const API = "https://discord.com/api/v10";
const UA = "DiscordBot (https://github.com/Guti11nter11/COOKGROUP_FINAL, 0.1) GIRA";

export function discordFetch(env: Pick<Env, "DISCORD_BOT_TOKEN">, method: string, path: string, body?: unknown): Promise<Response> {
  return fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`, "User-Agent": UA, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
}
