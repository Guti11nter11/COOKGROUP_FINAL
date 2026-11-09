import { describe, expect, it } from "vitest";
import { clip, mentions } from "../src/enrich-resale";
import { chooseEvents, convert, faceValue } from "../src/resale-lib";

describe("reventa: muestreo y precio de referencia", () => {
  const found = [
    { eventUrl: "a", eventDate: "2027-03-12", venueCity: "São Paulo", venueCountry: "Brazil" },
    { eventUrl: "b", eventDate: "2027-06-19", venueCity: "London", venueCountry: "United Kingdom" },
    { eventUrl: "c", eventDate: "2027-05-13", venueCity: "Barcelona", venueCountry: "Spain" },
    { eventUrl: "d", eventDate: "2027-05-27", venueCity: "Sevilla", venueCountry: "Spain" },
  ];
  it("dos fechas nuestras y una de otro país", () =>
    expect(chooseEvents(found, [{ city: "Barcelona", localDate: "2027-05-13" }, { city: "Sevilla", localDate: "2027-05-27" }]).map((e) => e.eventUrl)).toEqual(["c", "d", "a"]));
  it("precio de referencia: media de zonas del mismo país", () => {
    const prices = [{ country: "ES", city: "Barcelona", min: 85, max: 255, currency: "EUR", zones: [{ name: "Pista", price: 181.5 }, { name: "PL5", price: 85 }] }];
    expect(faceValue(prices, "ES")).toEqual({ amount: 133.25, currency: "EUR" });
    expect(faceValue(prices, "GB")).toBeNull(); // solo el mismo país
    expect(faceValue([{ country: "GB", city: "London", min: 49.1, max: 49.1, currency: "GBP" }], "GB")).toBeNull(); // precio suelto
    expect(faceValue([], "ES")).toBeNull();
  });
  it("multiplicador creíble", async () => {
    const { plausibleMultiplier } = await import("../src/resale-lib");
    expect([plausibleMultiplier(2.1), plausibleMultiplier(7.6), plausibleMultiplier(0.3)]).toEqual([true, false, false]);
  });
  it("conversión con tasas base EUR", () => expect(convert(100, "EUR", "USD", { USD: 1.1 })).toBeCloseTo(110));
});

describe("historial de reventa", () => {
  it("solo datos que nombran al artista", () => {
    expect(mentions("tras los dos conciertos de U2 en España", "U2")).toBe(true);
    expect(mentions("En Massachusetts, una ley de 2026 limita la reventa al 110 %", "Noah Kahan")).toBe(false);
    expect(mentions("Las entradas de Beyoncé se revendieron a 900 €", "Beyonce")).toBe(true);
  });
  it("corta en palabra completa", () => {
    expect(clip("Ciudadanos pidió limitar la reventa", 22)).toBe("Ciudadanos pidió…");
    expect(clip("corto", 22)).toBe("corto");
  });
});


import { seatGeekPage } from "../src/enrich-ticketers";
describe("SeatGeek como ticketera oficial", () => {
  it("solo el artista exacto y con eventos", () => {
    const ps = [
      { name: "Noah Kahan Tribute", url: "https://seatgeek.com/noah-kahan-tribute-tickets", has_upcoming_events: true },
      { name: "Noah Kahan", url: "https://seatgeek.com/noah-kahan-tickets", has_upcoming_events: true },
    ];
    expect(seatGeekPage("Noah Kahan", ps)).toBe("https://seatgeek.com/noah-kahan-tickets");
    expect(seatGeekPage("Noah Kahan", [{ name: "Noah Kahan", url: "https://seatgeek.com/noah-kahan-tickets", has_upcoming_events: false }])).toBeNull();
  });
});
