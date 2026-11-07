import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

const SESSION = "a".repeat(64);
const withSession = { headers: { cookie: `gira_s=${SESSION}` } };

describe("app GIRA (PWA privada)", () => {
  it("la API exige sesión", async () => {
    expect((await SELF.fetch("https://gira.test/api/feed")).status).toBe(401);
  });

  it("registrar un dispositivo exige el código de alta", async () => {
    const res = await SELF.fetch("https://gira.test/api/auth/register/options", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ setup: "malo" }) });
    expect(res.status).toBe(403);
    const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("gira-setup:test-key"));
    const setup = [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 24);
    const ok = await SELF.fetch("https://gira.test/api/auth/register/options", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ setup }) });
    expect(ok.status).toBe(200);
    const o = (await ok.json()) as { challenge: string; rp: { id: string } };
    expect(o.rp.id).toBe("gira.test");
    expect(o.challenge.length).toBeGreaterThan(20);
  });

  it("con sesión: feed con ventas, giras y noticias; clave push y calendario", async () => {
    await env.DB.prepare("INSERT INTO session (id, created_at, expires_at) VALUES (?, 'x', '2999-01-01T00:00:00Z')").bind(SESSION).run();
    const feed = (await (await SELF.fetch("https://gira.test/api/feed", withSession)).json()) as { slots: unknown[]; sheets: unknown[]; news: unknown[] };
    expect(feed).toMatchObject({ slots: [], sheets: [], news: [] });
    const key = (await (await SELF.fetch("https://gira.test/api/push/key", withSession)).json()) as { publicKey: string };
    expect(key.publicKey).toMatch(/^[A-Za-z0-9_-]{80,}$/);
    const again = (await (await SELF.fetch("https://gira.test/api/push/key", withSession)).json()) as { publicKey: string };
    expect(again.publicKey).toBe(key.publicKey);
    const cal = (await (await SELF.fetch("https://gira.test/api/calendar", withSession)).json()) as { url: string };
    expect(cal.url).toMatch(/^webcal:\/\/gira\.test\/calendar\.ics\?t=[a-f0-9]{32}$/);
  });

  it("sesión caducada → 401", async () => {
    await env.DB.prepare("INSERT INTO session (id, created_at, expires_at) VALUES (?, 'x', '2000-01-01T00:00:00Z')").bind(SESSION).run();
    expect((await SELF.fetch("https://gira.test/api/feed", withSession)).status).toBe(401);
  });

  it("sirve la app con cabeceras de privacidad", async () => {
    const res = await SELF.fetch("https://gira.test/app/");
    expect(res.status).toBe(200);
    expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(await res.text()).toContain("<title>GIRA</title>");
  });

  it("robots: nada indexable", async () => expect(await (await SELF.fetch("https://gira.test/robots.txt")).text()).toContain("Disallow: /"));
});
