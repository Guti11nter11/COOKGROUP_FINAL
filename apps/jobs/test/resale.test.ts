import { describe, expect, it } from "vitest";
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
