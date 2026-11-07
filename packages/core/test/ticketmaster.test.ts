import { describe, it, expect } from "vitest";
import fixture from "./fixtures/tm-events.json";
import { normalizeTmEvent, showKey } from "../src/ticketmaster";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const [a, b, c, d] = fixture._embedded.events as any[];

describe("normalizeTmEvent", () => {
  it("extrae recinto, artista, fecha y límite", () => {
    const s = normalizeTmEvent(a)!;
    expect(s).toMatchObject({
      source: "ticketmaster",
      sourceId: "Z698xZu0ZaU2SEV1",
      attractionIds: ["K8vZ91712W7"],
      venue: { tmId: "Z698xZu0Za7F7", name: "Estadio de La Cartuja", city: "Sevilla", country: "ES", tz: "Europe/Madrid" },
      startsAt: "2027-06-12T18:30:00Z",
      localDate: "2027-06-12",
      status: "onsale",
      ticketLimit: "Límite de 4 entradas por persona.",
      isPackage: false,
    });
  });

  it("ordena preventas por rango y luego por hora", () =>
    expect(normalizeTmEvent(a)!.sales.map((s) => s.kind)).toEqual(["artist", "telco", "general"]));

  it("conserva etiqueta y horas de cada ventana", () => {
    const o2 = normalizeTmEvent(a)!.sales.find((s) => s.kind === "telco")!;
    expect(o2).toEqual({
      kind: "telco",
      label: "Priority from O2",
      startsAt: "2026-11-11T09:00:00Z",
      endsAt: "2026-11-12T22:00:00Z",
      url: "https://www.ticketmaster.es/presale/o2",
      orderRank: 40,
    });
  });

  it("marca paquetes VIP como variante de la misma fecha", () => {
    expect(normalizeTmEvent(b)!.isPackage).toBe(true);
    expect(showKey(normalizeTmEvent(b)!)).toBe(showKey(normalizeTmEvent(a)!));
  });

  it("traduce canceled → cancelled y omite la venta general sin fecha", () => {
    const s = normalizeTmEvent(c)!;
    expect(s.status).toBe("cancelled");
    expect(s.sales).toEqual([]);
    expect(s.ticketLimit).toBeNull();
  });

  it("descarta eventos sin recinto", () => expect(normalizeTmEvent(d)).toBeNull());

  it("hora TBD → startsAt null pero conserva la fecha local", () => {
    const tba = structuredClone(a);
    tba.dates.start = { localDate: "2027-06-12", timeTBA: true };
    expect(normalizeTmEvent(tba)).toMatchObject({ startsAt: null, localDate: "2027-06-12" });
  });

  it("quita queueittoken de la URL", () =>
    expect(normalizeTmEvent(a)!.url).toBe("https://www.ticketmaster.es/event/u2-sevilla-entradas/1001?lang=es"));

  it("no falla con basura", () => {
    expect(normalizeTmEvent(null)).toBeNull();
    expect(normalizeTmEvent({})).toBeNull();
  });
});

describe("showKey", () => {
  it("es artista:recinto:fecha local", () => expect(showKey(normalizeTmEvent(a)!)).toBe("K8vZ91712W7:Z698xZu0Za7F7:2027-06-12"));
});

describe("normalizeTmEvent: variantes y enlaces de preventa", () => {
  it("quita queueittoken también de los enlaces de preventa", () => {
    const e = structuredClone(a);
    e.sales.presales[0].url = "https://www.ticketmaster.es/presale/o2?queueittoken=zzz";
    expect(normalizeTmEvent(e)!.sales.find((s) => s.kind === "telco")!.url).toBe("https://www.ticketmaster.es/presale/o2");
  });
  it.each([
    "PARKING: U2 - The Greatest Show",
    "U2 - Hospitality Packages",
    "Official Platinum Parking - U2",
    "Hotellrom - Quality Hotel Tønsberg 25.-27. juni - Robbie Williams Live 27",
    "Hotel Room Package - Oasis Live 27",
    "Coach Travel - Robbie Williams - Knebworth",
  ])(
    "listado accesorio '%s' → variante (no es una fecha)",
    (name) => expect(normalizeTmEvent({ ...a, name })!.isPackage).toBe(true),
  );
  it("sin zona horaria del recinto → tz null (no se inventa UTC)", () => {
    const e = structuredClone(a);
    delete e._embedded.venues[0].timezone;
    delete e.dates.timezone;
    expect(normalizeTmEvent(e)!.venue.tz).toBeNull();
  });
});
