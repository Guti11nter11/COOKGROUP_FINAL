import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

// Par de claves SOLO de pruebas (la pública está en vitest.config.ts).
const JWK = { crv: "Ed25519", d: "x-Qgmb1l_lyHGYTvuyDwINztyh4hVN32UmVLbdKXLo4", x: "_4PeGvTUQKRz_ynjTDbfFPh68EuqP3KzBV_lyL0IxFs", kty: "OKP" };

async function signed(body: unknown, tamper = false): Promise<Request> {
  const raw = JSON.stringify(body);
  const ts = "1794100000";
  const key = await crypto.subtle.importKey("jwk", JWK, { name: "Ed25519" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("Ed25519", key, new TextEncoder().encode(ts + raw)));
  const hex = [...sig].map((b) => b.toString(16).padStart(2, "0")).join("");
  return new Request("https://gira.test/discord/interactions", {
    method: "POST",
    headers: { "content-type": "application/json", "x-signature-ed25519": tamper ? hex.replace(/^../, "00") : hex, "x-signature-timestamp": ts },
    body: raw,
  });
}

describe("comandos de Discord", () => {
  it("PING firmado → PONG; firma alterada → 401", async () => {
    expect(await (await SELF.fetch(await signed({ type: 1 }))).json()).toEqual({ type: 1 });
    expect((await SELF.fetch(await signed({ type: 1 }, true))).status).toBe(401);
  });

  it("/gira de un artista seguido sin ventas por llegar y /dejar", async () => {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO artist (id, name, tm_attraction_id) VALUES ('a1', 'U2', 'K1')"),
      env.DB.prepare("INSERT INTO follow (artist_id, tier) VALUES ('a1', 3)"),
    ]);
    const gira = (await (await SELF.fetch(await signed({ type: 2, data: { name: "gira", options: [{ name: "artista", value: "u2" }] } }))).json()) as { data: { content: string; flags: number } };
    expect(gira.data.content).toContain("no tiene preventas ni ventas por llegar");
    expect(gira.data.flags & 64).toBe(64); // solo lo ves tú
    const dejar = (await (await SELF.fetch(await signed({ type: 2, data: { name: "dejar", options: [{ name: "artista", value: "U2" }] } }))).json()) as { data: { content: string } };
    expect(dejar.data.content).toContain("Dejo de seguir");
    expect(await env.DB.prepare("SELECT COUNT(*) n FROM follow").first()).toEqual({ n: 0 });
  });

  it("/proximas sin ventas", async () => {
    const r = (await (await SELF.fetch(await signed({ type: 2, data: { name: "proximas" } }))).json()) as { data: { content: string } };
    expect(r.data.content).toContain("No hay preventas");
  });
  it("/gmail: solo administradores; la clave va en mensaje efímero", async () => {
    const no = (await (await SELF.fetch(await signed({ type: 2, member: { permissions: "0" }, data: { name: "gmail" } }))).json()) as { data: { content: string } };
    expect(no.data.content).toContain("Solo el propietario");
    const yes = (await (await SELF.fetch(await signed({ type: 2, member: { permissions: "8" }, data: { name: "gmail" } }))).json()) as { data: { content: string; flags: number } };
    expect(yes.data.content).toContain("GIRA_TOKEN");
    expect(yes.data.flags & 64).toBe(64);
  });
});
