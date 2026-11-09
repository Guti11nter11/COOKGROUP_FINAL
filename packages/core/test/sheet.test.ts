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
  const msgs = renderArtistSheet({ name: "U2", tier: 3 }, shows, NOW);
  const all = msgs.join("\n");
  const T = (iso: string) => `<t:${Date.parse(iso) / 1000}:F>`;

  it("cada mensaje cabe en Discord (≤ 2.000 caracteres)", () => expect(msgs.every((m) => m.length <= 2000)).toBe(true));

  it("cabecera: gira con estrellas, países, límite, reventa para comparar y enlaces; nada de aforo total ni fuentes", () => {
    const head = msgs[0]!;
    expect(head).toMatch(/^# 🎤 U2 — The Greatest Show On Earth World Tour 2027 ⭐⭐⭐\n/);
    expect(head).toContain("🇪🇸");
    expect(head).toContain("🇬🇧");
    expect(head).toContain("**Límite de entradas:** **4** por persona");
    expect(head).not.toContain("Precios oficiales");
    expect(head).not.toContain("Aforo");
    expect(head).not.toContain("Deezer");
    expect(head).toContain("**Reventa (para comparar):** [Viagogo](https://www.viagogo.com/secure/search?q=U2) · [StubHub](https://www.stubhub.com/secure/search?q=U2)");
    expect(head).not.toContain("SeatGeek"); // SeatGeek es venta oficial, no reventa
    expect(head).toContain("[Ticketmaster ES](https://www.ticketmaster.es/artist/u2-entradas/736365)");
    expect(head).toContain("[Ticketmaster UK](https://www.ticketmaster.co.uk/u2-tickets/artist/736365)");
  });

  it("un bloque por preventa y hora, solo con la hora de Discord y sus fechas", () => {
    const esBlock = all.split(/\n(?=## )/).find((m) => m.includes("Artist Presale") && m.includes("Sevilla"))!;
    expect(esBlock).toContain(`## 🎟️ Artist Presale\n🕙 ${T("2026-11-10T09:00:00Z")}\n`);
    expect(esBlock).not.toContain("Madrid ·");
    expect(esBlock).not.toContain("Registro");
    // Preventa del artista: enlace único (no la página del evento).
    expect(esBlock).toContain("🔑 Enlace único");
    expect(esBlock).toContain("🇪🇸 Barcelona · jue 13 may 2027 · Estadio Barcelona");
    expect(esBlock).not.toContain("https://tm.example/2");
    expect(esBlock.indexOf("Barcelona")).toBeLessThan(esBlock.indexOf("Sevilla"));
  });

  it("sign up en su propio mensaje, una línea por preventa (sin la venta general)", () => {
    const su = msgs.find((m) => m.startsWith("## 📝 Sign up"))!;
    expect(su).toBeDefined();
    expect(su).not.toContain("## 🎟️");
    expect(su).toContain("**Priority from O2** →");
    expect(su).toContain("**Artist Presale** →");
    expect(su).not.toContain("Venta general");
  });

  it("no muestra ventas que ya pasaron", () => expect(all).not.toContain("https://tm.example/4"));

  it("las ventas de la misma hora pero en otro país van en su propio bloque", () => {
    const uk = all.split(/\n(?=## )/).find((m) => m.includes("Artist Presale") && m.includes("London"))!;
    expect(uk).toContain(T("2026-11-10T10:00:00Z"));
    expect(uk).not.toContain("Sevilla");
  });
});

describe("renderArtistSheet: datos de enriquecimiento", () => {
  const msgs = renderArtistSheet(artist, shows, NOW, {
    venues: { V1: { capacity: 70000 }, V2: { capacity: 55926 } },
    prices: {
      "1": { min: 85, max: 255, currency: "EUR", source: "abc.es", zones: [{ name: "PL1 Grada", price: 255 }, { name: "PL5 Grada", price: 85 }] },
      "2": { min: 85, max: 255, currency: "EUR", source: "mercadeopop.com", zones: [{ name: "Pista", price: 181.5 }, { name: "PL1 Grada", price: 255 }, { name: "PL5 Grada", price: 85 }] },
      "3": { min: 70, max: 210, currency: "GBP", source: "Ticketmaster" },
    },
    resale: {
      low: 1.8, high: 3.2, confidence: "media", basis: "Basado en 3 giras anteriores de estadio en Europa", difficulty: "muy alta",
      markets: [{ country: "GB", city: "London", localDate: "2027-06-19", median: 320, p25: 240, p75: 450, currency: "USD", listings: 85, source: "StubHub" }],
      history: [{ text: "En 2023 la pista llegó a 600 € en reventa", source: "elpais.com" }],
    },
  });
  const head = msgs[0]!;
  const prices = msgs.find((m) => m.startsWith("## 💶 Precios oficiales"))!;
  it("precios en su propio mensaje, uno por país con la tabla más completa y sin fuentes", () => {
    expect(prices).toContain("🇪🇸 **ESPAÑA**\n• Pista · **181,50 €**\n• PL1 Grada · **255 €**\n• PL5 Grada · **85 €**");
    expect(prices).toContain("🇬🇧 **REINO UNIDO:** **£70** – **£210**");
    expect(prices).not.toMatch(/Fuente|abc\.es|mercadeopop/);
    expect(prices).not.toContain("## 🎟️");
  });
  it("aforo solo por recinto", () => {
    expect(head).not.toContain("Aforo");
    expect(msgs.join("\n")).toContain("· Estadio Sevilla (70.000)");
  });
  it("reventa: solo el multiplicador (sin mercado, historial ni explicación del modelo)", () => {
    expect(head).toContain("**Reventa estimada:** ×1,8–×3,2 sobre el oficial");
    expect(head).toContain("**Dificultad para conseguir entrada:** muy alta");
    expect(head).not.toContain("Basado en");
    expect(head).not.toContain("mediana");
    expect(head).not.toContain("🕘");
  });
  it("límite de entradas de prensa por país cuando la ticketera no lo da", () => {
    const s = { ...shows[2]!, ticketLimit: null };
    expect(renderArtistSheet(artist, [s], NOW, { limits: { GB: 6 } })[0]).toContain("**Límite de entradas:** **6** por persona");
    expect(renderArtistSheet(artist, [s], NOW)[0]).toContain("**Límite de entradas:** sin confirmar todavía");
    // Sin dato del país: el de la misma gira en otro país.
    expect(renderArtistSheet(artist, [s], NOW, { limits: { DE: 4 } })[0]).toContain("**Límite de entradas:** **4** por persona");
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
  it("fuera paquetes por URL y duplicados de la misma fecha (se queda el del artista)", () => {
    const base = show("p1", "FR", "Paris", "2027-07-09", [["general", "Général", "2026-12-01T10:00:00Z"]], { name: "Jamiroquai", url: "https://www.ticketmaster.fr/fr/manifestation/jamiroquai-billet/idmanif/1" });
    const pkg = { ...base, sourceId: "p2", url: "https://www.ticketmaster.fr/fr/manifestation/package-jamiroquai-billet/idmanif/2" };
    expect(sheetShows("Jamiroquai", [base, pkg]).map((x) => x.sourceId)).toEqual(["p1"]);
    const bst = show("h1", "GB", "London", "2027-07-10", [["general", "General", "2026-12-01T10:00:00Z"]], { name: "American Express presents BST Hyde Park", url: "https://www.ticketmaster.co.uk/american-express-presents-bst-hyde-park-london-10-07-2027/event/1" });
    const raye = { ...bst, sourceId: "h2", name: "Amex presents BST Hyde Park - RAYE", url: "https://www.ticketmaster.co.uk/amex-presents-bst-hyde-park-raye-london-10-07-2027/event/2" };
    expect(sheetShows("RAYE", [bst, raye]).map((x) => x.sourceId)).toEqual(["h2"]);
  });
  it("título sin repetir el nombre cuando la gira no tiene nombre propio", () =>
    expect(renderArtistSheet({ name: "The Game" }, [show("g", "NL", "Utrecht", "2027-03-28", [["general", "Venta general", "2026-11-09T09:00:00Z"]], { name: "The Game" })], NOW)[0]).toMatch(/^# 🎤 The Game\n/));

  it("una reventa oficial no cuenta como venta por llegar", () => {
    const s = show("r", "ES", "Madrid", "2027-05-01", [["official_resale", "Reventa oficial", "2026-12-01T10:00:00Z"], ["general", "Venta general", "2026-10-01T09:00:00Z"]]);
    expect(isSheetActive([s], NOW)).toBe(false);
    expect(renderArtistSheet(artist, [s], NOW).join("\n")).not.toContain("Reventa oficial");
  });
});

describe("dónde registrarse en cada preventa (mensaje de sign up)", () => {
  const jam = (id: string, city: string, cc: string, date: string) =>
    show(id, cc, city, date, [["artist", "Artist Presale", "2026-11-10T09:00:00Z"], ["card", "Mastercard Presale", "2026-11-11T09:00:00Z"], ["unknown", "MOJO Presale", "2026-11-12T09:00:00Z"]], { name: "Jamiroquai" });
  const list = [jam("j1", "Amsterdam", "NL", "2027-07-05"), jam("j2", "London", "GB", "2027-07-16")];
  const msgs = renderArtistSheet({ name: "Jamiroquai" }, list, NOW, {
    homepage: "https://www.jamiroquai.com/",
    signups: [{ url: "https://www.bandsintown.com/t/1?release_id=abc", label: "Bandsintown", city: "Amsterdam", localDate: "2027-07-05" }],
  });
  const su = msgs.find((m) => m.startsWith("## 📝 Sign up"))!;
  const line = (label: string) => su.split("\n").find((l) => l.startsWith(`**${label}**`))!;
  it("preventa del artista → enlace de registro de su web oficial", () =>
    expect(line("Artist Presale")).toBe("**Artist Presale** → Registro **[AQUÍ](https://www.bandsintown.com/t/1?release_id=abc)**"));
  it("Mastercard → cómo entrar y web del programa", () => expect(line("Mastercard Presale")).toContain("Pagar con una Mastercard"));
  it("MOJO → newsletter de MOJO", () => expect(line("MOJO Presale")).toContain("**[AQUÍ](https://www.mojo4music.com/)**"));
  it("solo el momento de salida, nunca hasta cuándo dura", () => {
    const s2 = show("e", "GB", "London", "2027-07-16", [["artist", "Artist Presale", "2026-11-10T09:00:00Z"]]);
    s2.sales[0]!.endsAt = "2026-11-11T21:00:00Z";
    const all = renderArtistSheet({ name: "U2" }, [s2], NOW).join("\n");
    expect(all).toContain(`🕙 <t:${Date.parse("2026-11-10T09:00:00Z") / 1000}:F>`);
    expect(all).not.toContain("Hasta");
  });
  it("sin enlace localizado → lo dice y apunta a la web oficial", () => {
    const none = renderArtistSheet({ name: "Jamiroquai" }, list, NOW, { homepage: "https://www.jamiroquai.com/" }).join("\n");
    expect(none).toContain("**Artist Presale** → registro aún no localizado — mira la [web oficial](https://www.jamiroquai.com/)");
  });
});

describe("giras largas (EE. UU.)", () => {
  const cities = ["Atlanta", "Chicago", "Dallas", "Denver", "Houston", "Miami", "Boston", "Seattle", "Phoenix", "Detroit"];
  const list = cities.map((c, i) =>
    show(`us${i}`, "US", c, `2027-07-${String(i + 1).padStart(2, "0")}`, [["registration", "Verified Fan Presale", "2026-11-12T15:00:00Z"], ["general", "General Onsale", "2026-11-14T15:00:00Z"]], { name: "Gira Grande" }),
  );
  const msgs = renderArtistSheet({ name: "Gira Grande", tier: 3 }, list, NOW);
  it("las fechas con enlace salen una vez y cada venta las cita en corto", () => {
    const dates = msgs.find((m) => m.startsWith("## 📍 Fechas (10)"))!;
    expect(dates).toContain("[Atlanta · ");
    const vf = msgs.join("\n").split(/\n(?=## )/).find((b) => b.startsWith("## 🎟️ Verified Fan Presale"))!;
    expect(vf).toContain("🇺🇸 Atlanta 1 jul · Chicago 2 jul · Dallas 3 jul");
    expect(vf).not.toContain("https://");
    expect(msgs.length).toBeLessThanOrEqual(5);
  });
});

describe("cómo se entra en cada venta", () => {
  const sales: [string, string, string][] = [["fanclub", "Fan Club Presale", "2026-11-10T09:00:00Z"], ["card", "Mastercard Presale", "2026-11-11T09:00:00Z"], ["general", "Venta general", "2026-11-13T09:00:00Z"]];
  const all = renderArtistSheet({ name: "U2" }, [show("1", "ES", "Barcelona", "2027-05-13", sales)], NOW).join("\n");
  const block = (label: string) => all.split(/\n(?=## )/).find((b) => b.startsWith(`## 🎟️ ${label}`))!;
  it("fan club / artista / registro → enlace único, sin el enlace del evento", () => {
    expect(block("Fan Club Presale")).toContain("🔑 Enlace único");
    expect(block("Fan Club Presale")).not.toContain("https://tm.example/1");
  });
  it("tarjeta → página del evento con el código o la tarjeta", () => {
    expect(block("Mastercard Presale")).toContain("🔢 Se entra en la página del evento");
    expect(block("Mastercard Presale")).toContain("(https://tm.example/1)");
  });
  it("venta general → página del evento", () => expect(block("Venta general")).toContain("(https://tm.example/1)"));
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

describe("ticketeras oficiales", () => {
  it("SeatGeek sale en enlaces oficiales (no en reventa)", () => {
    const head = renderArtistSheet({ name: "U2" }, shows, NOW, { ticketers: [{ name: "SeatGeek", url: "https://seatgeek.com/u2-tickets" }] })[0]!;
    expect(head).toContain("[SeatGeek](https://seatgeek.com/u2-tickets)");
    expect(head.split("**Enlaces oficiales**")[1]).toContain("SeatGeek");
  });
});

describe("solo salidas de entradas (nunca promociones de algo ya a la venta)", () => {
  const w = (kind: string, label: string, startsAt: string) => ({ kind: kind as never, label, startsAt, endsAt: null, url: null, orderRank: 0 });
  it("evento ya a la venta + 'Holiday Gift Guide' / 'Day of Show' → no hay ficha", () => {
    const hunxho = show("h", "US", "Sacramento", "2026-12-13", []);
    hunxho.sales = [w("general", "Public Onsale", "2026-10-01T17:00:00Z"), w("unknown", "Ticketmaster's Holiday Gift Guide", "2026-11-27T18:00:00Z")];
    const pmj = show("p", "US", "Boise", "2026-11-20", []);
    pmj.sales = [w("unknown", "Day of Show", "2026-11-20T10:00:00Z"), w("unknown", "TM Holiday Promo", "2026-11-27T16:00:00Z")];
    expect(isSheetActive([hunxho], NOW)).toBe(false);
    expect(isSheetActive([pmj], NOW)).toBe(false);
  });
  it("una etiqueta rara sin palabra de venta no cuenta; 'Insider Presale' sí", () => {
    const a = show("r", "US", "Austin", "2027-03-01", []);
    a.sales = [w("unknown", "Special Event", "2026-11-20T15:00:00Z")];
    expect(isSheetActive([a], NOW)).toBe(false);
    a.sales = [w("unknown", "Insider Presale", "2026-11-20T15:00:00Z")];
    expect(isSheetActive([a], NOW)).toBe(true);
  });
  it("una preventa de verdad sí", () => {
    const s = show("v", "US", "Atlanta", "2027-07-01", []);
    s.sales = [w("registration", "Verified Fan Presale", "2026-11-12T15:00:00Z"), w("general", "General Onsale", "2026-11-14T15:00:00Z")];
    expect(isSheetActive([s], NOW)).toBe(true);
  });
});
