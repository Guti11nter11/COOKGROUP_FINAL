import { buildPushPayload, type PushSubscription, type VapidKeys } from "@block65/webcrypto-web-push";
import type { Env } from "./env";

/** Notificaciones push de la app (Web Push estándar; en iPhone, con la app en la pantalla de inicio). */
const b64u = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** Claves VAPID: se generan una vez y viven en D1 (nunca en el repo). */
export async function vapidKeys(env: Env): Promise<VapidKeys> {
  const row = await env.DB.prepare("SELECT value FROM setting WHERE key = 'vapid'").first<{ value: string }>();
  if (row) return JSON.parse(row.value) as VapidKeys;
  const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const jwk = (await crypto.subtle.exportKey("jwk", pair.privateKey)) as JsonWebKey;
  const raw = new Uint8Array((await crypto.subtle.exportKey("raw", pair.publicKey)) as ArrayBuffer);
  const keys: VapidKeys = { subject: "https://github.com/Guti11nter11/COOKGROUP_FINAL", publicKey: b64u(raw), privateKey: jwk.d! };
  await env.DB.prepare("INSERT OR IGNORE INTO setting (key, value) VALUES ('vapid', ?)").bind(JSON.stringify(keys)).run();
  return JSON.parse((await env.DB.prepare("SELECT value FROM setting WHERE key = 'vapid'").first<{ value: string }>())!.value) as VapidKeys;
}

export async function saveSubscription(env: Env, sub: PushSubscription): Promise<boolean> {
  if (!sub?.endpoint?.startsWith("https://") || !sub.keys?.p256dh || !sub.keys?.auth) return false;
  await env.DB.prepare("INSERT OR REPLACE INTO push_sub (endpoint, json, created_at) VALUES (?, ?, ?)").bind(sub.endpoint, JSON.stringify(sub), new Date().toISOString()).run();
  return true;
}

/** Envía a todos los dispositivos suscritos; borra las suscripciones caducadas (404/410). */
export async function pushAll(env: Env, msg: { title: string; body: string; url?: string; tag?: string }): Promise<number> {
  const { results } = await env.DB.prepare("SELECT endpoint, json FROM push_sub").all<{ endpoint: string; json: string }>();
  if (!results.length) return 0;
  const vapid = await vapidKeys(env);
  let sent = 0;
  for (const r of results) {
    try {
      const payload = await buildPushPayload({ data: JSON.stringify(msg), options: { ttl: 3600, urgency: "high", ...(msg.tag ? { topic: msg.tag.slice(0, 32).replace(/[^A-Za-z0-9_-]/g, "") } : {}) } }, JSON.parse(r.json) as PushSubscription, vapid);
      const res = await fetch(r.endpoint, payload);
      if (res.status === 404 || res.status === 410) await env.DB.prepare("DELETE FROM push_sub WHERE endpoint = ?").bind(r.endpoint).run();
      else if (res.ok) sent++;
    } catch (e) {
      console.log(`push: ${String(e)}`);
    }
  }
  return sent;
}
