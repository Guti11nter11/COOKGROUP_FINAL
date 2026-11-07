import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticatorTransportFuture,
} from "@simplewebauthn/server";
import type { Env } from "./env";

/**
 * Acceso a la app: passkey (Face ID) del propietario. Registrar un dispositivo exige el código de
 * alta (derivado de un secreto, publicado solo en el Discord privado); después basta con Face ID y la
 * sesión dura ~1 año.
 */
const SESSION_DAYS = 365;
const COOKIE = "gira_s";

const b64u = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));

async function sha(text: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
export const setupToken = async (env: Env) => (await sha(`gira-setup:${env.TICKETMASTER_API_KEY}`)).slice(0, 24);

function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

const put = (env: Env, key: string, value: string) =>
  env.DB.prepare("INSERT INTO setting (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value").bind(key, value).run();
const take = async (env: Env, key: string) => {
  const v = (await env.DB.prepare("DELETE FROM setting WHERE key = ? RETURNING value").bind(key).first<{ value: string }>())?.value ?? null;
  return v;
};

export async function currentSession(env: Env, req: Request): Promise<boolean> {
  const id = /(?:^|;\s*)gira_s=([a-f0-9]{64})/.exec(req.headers.get("cookie") ?? "")?.[1];
  if (!id) return false;
  const row = await env.DB.prepare("SELECT expires_at FROM session WHERE id = ?").bind(id).first<{ expires_at: string }>();
  return !!row && row.expires_at > new Date().toISOString();
}

async function newSession(env: Env): Promise<string> {
  const id = [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, "0")).join("");
  const now = new Date();
  await env.DB.prepare("INSERT INTO session (id, created_at, expires_at) VALUES (?, ?, ?)")
    .bind(id, now.toISOString(), new Date(now.getTime() + SESSION_DAYS * 86_400_000).toISOString())
    .run();
  return `${COOKIE}=${id}; Path=/; Max-Age=${SESSION_DAYS * 86_400}; HttpOnly; Secure; SameSite=Strict`;
}

const json = (data: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(data), { ...init, headers: { "content-type": "application/json", "cache-control": "no-store", ...(init.headers ?? {}) } });

/** Rutas /api/auth/*. */
export async function handleAuth(env: Env, req: Request, url: URL): Promise<Response> {
  const rpID = url.hostname;
  const origin = url.origin;
  const body = req.method === "POST" ? ((await req.json().catch(() => ({}))) as Record<string, unknown>) : {};
  const { results: keys } = await env.DB.prepare("SELECT id, public_key, counter, transports FROM passkey").all<{
    id: string;
    public_key: string;
    counter: number;
    transports: string | null;
  }>();

  if (url.pathname === "/api/auth/status") return json({ registered: keys.length > 0, session: await currentSession(env, req) });

  if (url.pathname === "/api/auth/register/options") {
    if (!same(String(body.setup ?? ""), await setupToken(env))) return json({ error: "Código de alta no válido" }, { status: 403 });
    const options = await generateRegistrationOptions({
      rpName: "GIRA",
      rpID,
      userName: "propietario",
      userDisplayName: "GIRA",
      attestationType: "none",
      authenticatorSelection: { residentKey: "preferred", userVerification: "required" },
      excludeCredentials: keys.map((k) => ({ id: k.id })),
    });
    await put(env, "challenge:reg", options.challenge);
    return json(options);
  }

  if (url.pathname === "/api/auth/register/verify") {
    const expectedChallenge = await take(env, "challenge:reg");
    if (!expectedChallenge) return json({ error: "Empieza de nuevo el registro" }, { status: 400 });
    const v = await verifyRegistrationResponse({
      response: body as never,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    }).catch(() => null);
    if (!v?.verified || !v.registrationInfo) return json({ error: "No se pudo verificar el dispositivo" }, { status: 400 });
    const c = v.registrationInfo.credential;
    await env.DB.prepare("INSERT OR REPLACE INTO passkey (id, public_key, counter, transports, created_at) VALUES (?, ?, ?, ?, ?)")
      .bind(c.id, b64u(c.publicKey), c.counter, JSON.stringify(c.transports ?? []), new Date().toISOString())
      .run();
    return json({ ok: true }, { headers: { "set-cookie": await newSession(env) } });
  }

  if (url.pathname === "/api/auth/login/options") {
    if (!keys.length) return json({ error: "Aún no hay ningún dispositivo registrado" }, { status: 400 });
    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: "required",
      allowCredentials: keys.map((k) => ({ id: k.id, transports: JSON.parse(k.transports ?? "[]") as AuthenticatorTransportFuture[] })),
    });
    await put(env, "challenge:login", options.challenge);
    return json(options);
  }

  if (url.pathname === "/api/auth/login/verify") {
    const expectedChallenge = await take(env, "challenge:login");
    const key = keys.find((k) => k.id === body.id);
    if (!expectedChallenge || !key) return json({ error: "Empieza de nuevo" }, { status: 400 });
    const v = await verifyAuthenticationResponse({
      response: body as never,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: { id: key.id, publicKey: fromB64u(key.public_key), counter: key.counter, transports: JSON.parse(key.transports ?? "[]") },
      requireUserVerification: true,
    }).catch(() => null);
    if (!v?.verified) return json({ error: "No se pudo comprobar tu identidad" }, { status: 401 });
    await env.DB.prepare("UPDATE passkey SET counter = ? WHERE id = ?").bind(v.authenticationInfo.newCounter, key.id).run();
    return json({ ok: true }, { headers: { "set-cookie": await newSession(env) } });
  }
  return json({ error: "No encontrado" }, { status: 404 });
}
