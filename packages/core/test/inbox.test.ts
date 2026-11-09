import { describe, expect, it } from "vitest";
import { accessFor, candidateLinks, findArtist, inboxPrompt, readPresaleMail, verifyAiAccess, type InboxMail, type PresaleAccess } from "../src/inbox";
import type { SaleWindow } from "../src/ticketmaster";

const mail = (over: Partial<InboxMail>): InboxMail => ({
  id: "m1",
  from: "Ticketmaster <customer_support@email.ticketmaster.com>",
  subject: "",
  date: "2026-11-09T10:00:00Z",
  text: "",
  links: [],
  ...over,
});

describe("readPresaleMail", () => {
  it("saca el código y el enlace de una preventa de fan club", () => {
    const r = readPresaleMail(
      mail({
        subject: "Your Bon Jovi Fan Club Presale code",
        text: "Hi! Your presale code is: BJFOREVER26\nThe presale starts Tuesday at 10am.",
        links: [
          { text: "Unsubscribe", href: "https://email.ticketmaster.com/unsub?x=1" },
          { text: "Unlock tickets", href: "https://www.ticketmaster.com/event/0B00ABC?did=bjfanclub" },
          { text: "Privacy", href: "https://www.ticketmaster.com/privacy" },
        ],
      }),
    );
    expect(r).toEqual({ kind: "fanclub", label: "Fan Club Presale", code: "BJFOREVER26", url: "https://www.ticketmaster.com/event/0B00ABC?did=bjfanclub" });
  });

  it("con dos códigos o dos enlaces, se queda con uno solo (el primero)", () => {
    const r = readPresaleMail(
      mail({
        subject: "Artist Presale access",
        text: "Access code: FIRST123\nBackup code: SECOND456",
        links: [
          { text: "Get tickets", href: "https://www.ticketmaster.es/event/1?did=a" },
          { text: "Get tickets", href: "https://www.ticketmaster.es/event/2?did=b" },
        ],
      }),
    );
    expect(r?.code).toBe("FIRST123");
    expect(r?.url).toBe("https://www.ticketmaster.es/event/1?did=a");
    expect(r?.kind).toBe("artist");
  });

  it("entiende español y no toma palabras normales como código", () => {
    const r = readPresaleMail(mail({ subject: "Preventa del club de fans de Quevedo", text: "Tu código de acceso es: QVD2027. El código está abajo." }));
    expect(r?.code).toBe("QVD2027");
    expect(r?.kind).toBe("fanclub");
    expect(readPresaleMail(mail({ subject: "Presale reminder", text: "Your code will be sent below tomorrow." }))?.code ?? null).toBeNull();
  });

  it("ignora correos que no son de preventa, confirmaciones de registro sin código y pedidos", () => {
    expect(readPresaleMail(mail({ subject: "Your weekly newsletter", text: "New music this week" }))).toBeNull();
    expect(readPresaleMail(mail({ subject: "You're registered for the Noah Kahan Presale", text: "Thanks for registering. We'll email you before the presale." }))).toBeNull();
    expect(readPresaleMail(mail({ subject: "Order confirmation", text: "Your order for the presale is confirmed. Code: ORDER999" }))).toBeNull();
  });

  it("nunca guarda un pase de cola (queueittoken) ni enlaces de baja", () => {
    const r = readPresaleMail(
      mail({
        subject: "Verified Fan presale: you're in",
        text: "Your unique code: VF77AB",
        links: [
          { text: "Join the presale", href: "https://queue.ticketmaster.com/?queueittoken=abc" },
          { text: "Manage preferences", href: "https://www.ticketmaster.com/preferences" },
        ],
      }),
    );
    expect(r).toEqual({ kind: "registration", label: "Verified Fan presale", code: "VF77AB", url: null });
  });
});

describe("findArtist", () => {
  const artists = [
    { id: "a1", name: "Muse" },
    { id: "a2", name: "Bon Jovi" },
    { id: "a3", name: "U2" },
  ];
  it("busca el artista en remitente, asunto y texto, con palabra completa", () => {
    expect(findArtist(mail({ subject: "Your Bon Jovi Fan Club Presale code" }), artists)?.id).toBe("a2");
    expect(findArtist(mail({ subject: "Presale", text: "Visit the museum presale" }), artists)).toBeNull();
    expect(findArtist(mail({ from: "U2 <news@u2.com>", subject: "Presale code" }), artists)?.id).toBe("a3");
  });
});

describe("accessFor", () => {
  const w = (label: string, kind: SaleWindow["kind"]): SaleWindow => ({ label, kind, orderRank: 1, startsAt: "2026-11-12T10:00:00Z", endsAt: null, url: null });
  const acc = (over: Partial<PresaleAccess>): PresaleAccess => ({ kind: "fanclub", label: "Fan Club Presale", code: "X1", url: null, receivedAt: "2026-11-09T10:00:00Z", ...over });
  it("empareja por tipo de preventa y si no por etiqueta", () => {
    expect(accessFor(w("Bon Jovi Fan Club Presale", "fanclub"), [acc({})])?.code).toBe("X1");
    expect(accessFor(w("Artist Presale", "artist"), [acc({})])).toBeNull();
    expect(accessFor(w("Spotify Presale", "platform"), [acc({ kind: "unknown", label: "Spotify Presale", code: "SP1" })])?.code).toBe("SP1");
  });
});

describe("IA: cada correo es distinto, pero lo que dice se comprueba contra el correo", () => {
  const artists = [{ id: "a2", name: "Bon Jovi" }, { id: "a9", name: "Laufey" }];
  const m = mail({
    from: "Laufey <hello@laylo.com>",
    subject: "it's time 💌",
    text: "Hi! You're getting early access to the Bewitched presale. Use password LAUFEYLOVE at checkout.",
    links: [
      { text: "Unsubscribe", href: "https://laylo.com/unsub" },
      { text: "Get early access", href: "https://www.ticketmaster.com/event/X?did=laylo1" },
    ],
  });
  it("la lista de enlaces que ve la IA no lleva bajas", () => {
    expect(candidateLinks(m).map((l) => l.href)).toEqual(["https://www.ticketmaster.com/event/X?did=laylo1"]);
    expect(inboxPrompt(m)).toContain("[1] Get early access → https://www.ticketmaster.com/event/X?did=laylo1");
  });
  it("acepta lo que está en el correo", () => {
    const r = verifyAiAccess(m, { is_access: true, artist: "Laufey", presale: "Bewitched presale", code: "LAUFEYLOVE", link: 1 }, artists);
    expect(r).toEqual({ artist: artists[1], access: { kind: "unknown", label: "Bewitched presale", code: "LAUFEYLOVE", url: "https://www.ticketmaster.com/event/X?did=laylo1" } });
  });
  it("descarta códigos inventados, enlaces fuera de la lista y artistas que no salen en el correo", () => {
    expect(verifyAiAccess(m, { is_access: true, artist: "Laufey", code: "INVENTADO1", link: 7 }, artists)).toBeNull();
    expect(verifyAiAccess(m, { is_access: true, artist: "Bon Jovi", code: "LAUFEYLOVE", link: null }, artists)?.artist.id).toBe("a9");
    expect(verifyAiAccess(m, { is_access: false, code: "LAUFEYLOVE" }, artists)).toBeNull();
  });
});
