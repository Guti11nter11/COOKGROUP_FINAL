import { env, SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { redactAccess } from "../src/inbox";

async function token(): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("gira-inbox:test-key"));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const send = async (mails: unknown[], auth?: string) =>
  SELF.fetch("https://gira.test/inbox", {
    method: "POST",
    headers: { "content-type": "application/json", ...(auth ? { authorization: `Bearer ${auth}` } : {}) },
    body: JSON.stringify({ mails }),
  });
const mail = (id: string, subject: string, text: string, links: { text: string; href: string }[] = []) => ({ id, from: "Ticketmaster <tm@email.ticketmaster.com>", subject, date: new Date().toISOString(), text, links });

describe("correos de preventa (/inbox)", () => {
  beforeEach(async () => {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO artist (id, name, tm_attraction_id) VALUES ('a1', 'Bon Jovi', 'K1')"),
      env.DB.prepare("INSERT INTO sheet (artist_id, channel_id, updated_at) VALUES ('a1', 'c1', '2026-11-09T00:00:00Z')"),
    ]);
  });

  it("sin la clave del Gmail → 401 (tampoco vale la de ingesta)", async () => {
    expect((await send([])).status).toBe(401);
    const ingest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode("gira-ingest:test-key")))].map((b) => b.toString(16).padStart(2, "0")).join("");
    expect((await send([], ingest)).status).toBe(401);
  });

  it("guarda un código y un enlace por preventa; duplicados y segundos códigos no lo cambian", async () => {
    const t = await token();
    const first = mail("m1", "Your Bon Jovi Fan Club Presale code", "Your presale code is: BJ2027", [{ text: "Unlock tickets", href: "https://www.ticketmaster.com/event/1?did=bj" }]);
    expect(await (await send([first, first], t)).json()).toEqual({ read: 2, stored: 1 });
    const second = mail("m2", "Bon Jovi Fan Club Presale: reminder", "Your presale code is: OTHER999", [{ text: "Unlock tickets", href: "https://www.ticketmaster.com/event/2?did=x" }]);
    expect(await (await send([second], t)).json()).toEqual({ read: 1, stored: 0 });
    const rows = (await env.DB.prepare("SELECT kind, code, url FROM presale_access").all()).results;
    expect(rows).toEqual([{ kind: "fanclub", code: "BJ2027", url: "https://www.ticketmaster.com/event/1?did=bj" }]);
    expect(await env.DB.prepare("SELECT COUNT(*) n FROM sheet_dirty WHERE artist_id = 'a1'").first()).toEqual({ n: 1 });
  });

  it("ignora correos de artistas sin ficha ni registro y correos que no son de acceso", async () => {
    const t = await token();
    const r = await (await send([mail("m3", "Metallica presale code", "Code: MET123"), mail("m4", "Bon Jovi newsletter", "New album out now")], t)).json();
    expect(r).toEqual({ read: 2, stored: 0 });
  });

  it("la vista previa pública oculta las líneas de acceso personal", () => {
    expect(redactAccess("## 🎟️ Fan Club\n🔐 **Tu acceso** (de tu correo): código `BJ2027`\n🇺🇸 x")).toBe("## 🎟️ Fan Club\n🔐 (acceso personal: oculto en la vista previa)\n🇺🇸 x");
  });
});
