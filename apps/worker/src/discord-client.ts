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

/** Mensaje con una imagen adjunta (POST para publicar, PATCH para sustituir la de un mensaje ya publicado). */
export function discordUpload(
  env: Pick<Env, "DISCORD_BOT_TOKEN">,
  method: "POST" | "PATCH",
  path: string,
  payload: Record<string, unknown>,
  file: { name: string; type: string; bytes: Uint8Array },
): Promise<Response> {
  const form = new FormData();
  form.append("payload_json", JSON.stringify({ ...payload, attachments: [{ id: 0, filename: file.name }] }));
  form.append("files[0]", new Blob([file.bytes], { type: file.type }), file.name);
  return fetch(`${API}${path}`, { method, headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`, "User-Agent": UA }, body: form });
}
