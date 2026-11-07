import { describe, expect, it } from "vitest";
import { assignToShows, priceSnippets, validPrices } from "../src/prices-lib";

const text =
  "U2 vuelve a España. Las entradas para el concierto de Sevilla costarán desde 45 euros hasta 250 euros, según la promotora. El grupo tocará también en Barcelona. Hay paquetes VIP de 1.200 euros.";
const url = "https://elpais.com/u2";

describe("precios desde prensa", () => {
  it("solo frases con cifras y moneda que hablan de entradas", () =>
    expect(priceSnippets(text)).toEqual(["Las entradas para el concierto de Sevilla costarán desde 45 euros hasta 250 euros, según la promotora."]));

  it("descarta lo que la IA se inventa (cita inexistente o sin la cifra) y rangos absurdos", () => {
    const ok = { city: "Sevilla", min: 45, max: 250, currency: "EUR", quote: "costarán desde 45 euros hasta 250 euros", url };
    expect(validPrices([ok], [{ url, text }])).toEqual([ok]);
    expect(validPrices([{ ...ok, quote: "costarán desde 30 euros hasta 250 euros", min: 30 }], [{ url, text }])).toEqual([]);
    expect(validPrices([{ ...ok, quote: "El grupo tocará también en Barcelona", min: 45 }], [{ url, text }])).toEqual([]);
    expect(validPrices([{ ...ok, max: 99999 }], [{ url, text }])).toEqual([]);
    const vip = "El paquete de hospitalidad cuesta 437 libras por persona.";
    expect(validPrices([{ city: "London", min: 437, max: 437, currency: "GBP", quote: "cuesta 437 libras", url }], [{ url, text: vip }])).toEqual([]);
    expect(validPrices([{ ...ok, url: "https://otra" }], [{ url, text }])).toEqual([]);
  });

  it("zonas: solo las que aparecen en la fuente; el rango sale de ellas", () => {
    const t = "BARCELONA (RED) ZONE 181,50€ PISTA GENERAL 181,50€ PL1 GRADA 255€ PL5 GRADA 85€ Los precios incluyen gastos.";
    const p = { city: "Barcelona", min: 85, max: 255, currency: "EUR", quote: "PL5 GRADA 85€", url, zones: [{ name: "(RED) ZONE", price: 181.5 }, { name: "PL1 GRADA", price: 255 }, { name: "PL5 GRADA", price: 85 }, { name: "Inventada", price: 999 }] };
    const [v] = validPrices([p], [{ url, text: t }]);
    expect(v!.zones!.map((z) => z.name)).toEqual(["(RED) ZONE", "PL1 GRADA", "PL5 GRADA"]);
    expect([v!.min, v!.max]).toEqual([85, 255]);
  });

  it("asigna el precio a las fechas de esa ciudad", () => {
    const p = { city: "Sevilla", min: 45, max: 250, currency: "EUR", quote: "x", url };
    const m = assignToShows([p], [{ sourceId: "1", city: "Sevilla" }, { sourceId: "2", city: "Barcelona" }]);
    expect([...m.keys()]).toEqual(["1"]);
  });
});
