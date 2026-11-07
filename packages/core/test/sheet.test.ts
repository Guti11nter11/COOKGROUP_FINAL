import { describe, it, expect } from "vitest";
import type { Show } from "../src/ticketmaster";
import { renderArtistSheet, channelSlug, flag, ticketLimitNumber, isSheetActive, sheetShows, money } from "../src/sheet";

const NOW = new Date("2026-11-08T12:00:00Z");
const show = (id: string, cc: string, city: string, date: string, sales: [string, string, string | null][], extra: Partial<Show> = {}): Show => ({
  source: "ticketmaster",
  sourceId: id,
  name: "U2 - The Greatest Show On Earth World Tour 2027",
  attractionIds: ["K8vZ91712W7"],
  venue: { tmId: `V${id}`, name: `Estadio ${city}`, city, country: cc, tz: cc === "GB" ? "Europe/London" : "Europe/Madrid" },
  startsAt: `${date}T19:00:00Z`,
  localDate: date,
  status: "onsale",
  ticketLimit: "Límite de 4 entradas por persona.",
  url: `https://tm.example/${id}`,
  isPackage: false,
  sales: sales.map(([kind, label, at]) => ({ kind: kind as never, label, startsAt: at, endsAt: null, url: null, orderRank: 0 })),
  artistUrl: cc === "GB" ? "https://www.ticketmaster.co.uk/u2-tickets/artist/736365" : "https://www.ticketmaster.es/artist/u2-entradas/736365",
  ...extra,
});

const shows = [
  show("1", "ES", "Sevilla", "2027-05-27", [["artist", "Artist Presale", "2026-11-10T09:00:00Z"], ["general", "Venta general", "2026-11-13T09:00:00Z"]]),
  show("2", "ES", "Barcelona", "2027-05-13", [["artist", "Artist Presale", "2026-11-10T09:00:00Z"], ["general", "Venta general", "2026-11-13T09:00:00Z"]]),
  show("3", "GB", "London", "2027-06-18", [["artist", "Artist Presale", "2026-11-10T10:00:00Z"], ["telco", "Priority from O2", "2026-11-11T10:00:00Z"]]),
  show("4", "ES", "Madrid", "2027-05-01", [["general", "Venta general", "2026-10-01T09:00:00Z"]]),
];
const artist = { name: "U2" };

describe("renderArtistSheet (formato tipo Akari)", () => {
  const msgs = renderArtistSheet(artist, shows, NOW);
  const all = msgs.join("\n");

  it("cada mensaje cabe en Discord (≤ 2.000 caracteres)", () => expect(msgs.every((m) => m.length <= 2000)).toBe(true));

  it("cabecera con gira, países, límite, reventa para comparar y enlaces oficiales; sin Deezer", () => {
    const head = msgs[0]!;
    expect(head).toContain("U2 — The Greatest Show On Earth World Tour 2027");
    expect(head).toContain("🇪🇸");
    expect(head).toContain("🇬🇧");
    expect(head).toContain("**Límite de entradas:** 4 por persona");
    expect(head).toContain("**Precios oficiales:** aún sin publicar");
    expect(head).not.toContain("Deezer");
    expect(head).toContain("**Reventa (para comparar):** [Viagogo](https://www.viagogo.com/secure/search?q=U2) · [StubHub](https://www.stubhub.com/secure/search?q=U2)");
    expect(head).toContain("[Ticketmaster ES](https://www.ticketmaster.es/artist/u2-entradas/736365)");
    expect(head).toContain("[Ticketmaster UK](https://www.ticketmaster.co.uk/u2-tickets/artist/736365)");
  });

  it("un bloque por preventa y hora, en orden, con todas sus fechas y enlaces juntos", () => {
    const iEs = all.indexOf("Artist Presale");
    expect(iEs).toBeGreaterThan(0);
    const esBlock = all.split(/\n(?=## )/).find((m) => m.includes("Artist Presale") && m.includes("Sevilla"))!;
    expect(esBlock).toContain("🇪🇸 **mar 10 nov, 10:00** Madrid · 🇬🇧 09:00 Londres");
    expect(esBlock).toContain(`<t:${Date.parse("2026-11-10T09:00:00Z") / 1000}:F>`);
    expect(esBlock).toContain("[Barcelona · jue 13 may 2027](https://tm.example/2) · Estadio Barcelona");
    expect(esBlock).toContain("[Sevilla · jue 27 may 2027](https://tm.example/1) · Estadio Sevilla");
    expect(esBlock.indexOf("Barcelona")).toBeLessThan(esBlock.indexOf("Sevilla"));
    expect(all.indexOf("Priority from O2")).toBeGreaterThan(all.indexOf("Venta general") > 0 ? 0 : -1);
    expect(all).toContain("Cliente de la operadora");
  });

  it("no muestra ventas que ya pasaron", () => expect(all).not.toContain("https://tm.example/4"));

  it("las ventas de la misma hora pero en otro país van en su propio bloque (hora UK distinta)", () => {
    const sections = all.split(/\n(?=## )/);
    const uk = sections.find((m) => m.includes("Artist Presale") && m.includes("London"))!;
    expect(uk).toContain("🇪🇸 **mar 10 nov, 11:00** Madrid · 🇬🇧 10:00 Londres");
    expect(uk).not.toContain("Sevilla");
  });
});

describe("renderArtistSheet: datos de enriquecimiento", () => {
  const msgs = renderArtistSheet(artist, shows, NOW, {
    venues: { V1: { capacity: 70000 }, V2: { capacity: 55926 } },
    prices: {
      "1": { min: 85, max: 255, currency: "EUR", source: "mercadeopop.com", zones: [{ name: "Pista", price: 181.5 }, { name: "PL5 Grada", price: 85 }] },
      "2": { min: 85, max: 255, currency: "EUR", source: "mercadeopop.com", zones: [{ name: "Pista", price: 181.5 }, { name: "PL5 Grada", price: 85 }] },
      "3": { min: 70, max: 210, currency: "GBP", source: "Ticketmaster" },
    },
    resale: {
      low: 1.8, high: 3.2, confidence: "media", basis: "Basado en 3 giras anteriores de estadio en Europa",
      markets: [{ country: "GB", city: "London", localDate: "2027-06-19", median: 320, p25: 240, p75: 450, currency: "USD", listings: 85, source: "StubHub" }],
      history: [{ text: "En 2023 la pista llegó a 600 € en reventa", source: "elpais.com" }],
    },
  });
  const head = msgs[0]!;
  it("precios oficiales por país", () => expect(head).toContain("**Precios oficiales:** 🇪🇸 85–255 € · 🇬🇧 £70–£210"));
  it("precios por zona agrupando ciudades con la misma tabla", () =>
    expect(msgs.join("\n")).toContain("🇪🇸 **Barcelona · Sevilla:** Pista **181,50 €** · PL5 Grada **85 €**\n-# Fuente: mercadeopop.com"));
  it("aforo total y por recinto", () => {
    expect(head).toContain("**Aforo:** ~125.926 entradas en 2 de 3 fechas");
    expect(msgs.join("\n")).toContain("· Estadio Sevilla (70.000)");
  });
  it("reventa estimada con confianza y mercado", () => {
    expect(head).toContain("**Reventa estimada:** ×1,8–×3,2 sobre el oficial · confianza media");
    expect(head).toContain("Basado en 3 giras anteriores");
    expect(head).toContain("🇬🇧 London 19 jun: mediana **$320** · P25–P75 $240–$450 · 85 anuncios (StubHub)");
    expect(head).toContain("🕘 En 2023 la pista llegó a 600 € en reventa");
  });
  it("money", () => {
    expect(money(1500, "EUR")).toBe("1.500 €");
    expect(money(70, "GBP")).toBe("£70");
  });
});

describe("qué fechas van en la ficha", () => {
  const rw = (id: string, name: string, extra: Partial<Show> = {}) => show(id, "GB", "Newport", "2027-06-17", [["general", "General", "2026-12-01T10:00:00Z"]], { name, ...extra });
  it("fuera hoteles, parkings y pases de festivales ajenos; dentro su propio festival", () => {
    const list = [
      rw("a", "Robbie Williams Live 2027"),
      rw("b", "Isle of Wight Festival 2027 - Weekend"),
      rw("c", "Lytham Festival 2027 5 Day Pass"),
      rw("d", "Hotellrom - Robbie Williams Live 27", { isPackage: true }),
      rw("e", "Robbie Williams - Lytham Festival 2027"),
    ];
    expect(sheetShows("Robbie Williams", list).map((s) => s.sourceId)).toEqual(["a", "e"]);
    expect(sheetShows("Creamfields", [rw("f", "Creamfields 2027 - Weekend Camping")]).map((s) => s.sourceId)).toEqual(["f"]);
  });
  it("una reventa oficial no cuenta como venta por llegar", () => {
    const s = show("r", "ES", "Madrid", "2027-05-01", [["official_resale", "Reventa oficial", "2026-12-01T10:00:00Z"], ["general", "Venta general", "2026-10-01T09:00:00Z"]]);
    expect(isSheetActive([s], NOW)).toBe(false);
    expect(renderArtistSheet(artist, [s], NOW).join("\n")).not.toContain("Reventa oficial");
  });
});

describe("dónde registrarse en cada preventa", () => {
  const jam = (id: string, city: string, cc: string, date: string) =>
    show(id, cc, city, date, [["artist", "Artist Presale", "2026-11-10T09:00:00Z"], ["card", "Mastercard Presale", "2026-11-11T09:00:00Z"], ["unknown", "MOJO Presale", "2026-11-12T09:00:00Z"]], { name: "Jamiroquai" });
  const list = [jam("j1", "Amsterdam", "NL", "2027-07-05"), jam("j2", "London", "GB", "2027-07-16")];
  const all = renderArtistSheet({ name: "Jamiroquai" }, list, NOW, {
    homepage: "https://www.jamiroquai.com/",
    signups: [{ url: "https://www.bandsintown.com/t/1?release_id=abc", label: "Bandsintown", city: "Amsterdam", localDate: "2027-07-05" }],
  }).join("\n");
  const block = (label: string) => all.split(/\n(?=## )/).find((b) => b.startsWith(`## 🎟️ ${label}`))!;
  it("preventa del artista → enlace de registro de su web oficial para esa fecha", () =>
    expect(block("Artist Presale")).toContain("📝 **Registro:** [Bandsintown · Amsterdam 5 jul](https://www.bandsintown.com/t/1?release_id=abc)"));
  it("Mastercard → cómo entrar y web del programa", () => expect(block("Mastercard Presale")).toContain("📝 Pagar con una Mastercard"));
  it("MOJO → newsletter de MOJO", () => expect(block("MOJO Presale")).toContain("[web oficial](https://www.mojo4music.com/)"));
  it("sin enlace localizado → lo dice y apunta a la web oficial", () => {
    const none = renderArtistSheet({ name: "Jamiroquai" }, list, NOW, { homepage: "https://www.jamiroquai.com/" }).join("\n");
    expect(none).toContain("📝 **Registro:** aún no localizado — mira la [web oficial](https://www.jamiroquai.com/)");
  });
});

describe("utilidades", () => {
  it("channelSlug", () => {
    expect(channelSlug("Guns N' Roses")).toBe("guns-n-roses");
    expect(channelSlug("ROSALÍA")).toBe("rosalia");
    expect(channelSlug("Florence + The Machine")).toBe("florence-the-machine");
  });
  it("flag", () => expect(flag("ES")).toBe("🇪🇸"));
  it("ticketLimitNumber: el número más repetido", () =>
    expect(ticketLimitNumber(["A max of 6 tickets per person", "A max of 6 tickets per person", "Límite de 4 entradas", null])).toBe(6));
  it("isSheetActive: hay alguna venta futura", () => {
    expect(isSheetActive(shows, NOW)).toBe(true);
    expect(isSheetActive([shows[3]!], NOW)).toBe(false);
  });
});
