import { describe, expect, it } from "vitest";
import { pricesByCountry } from "@gira/core";
import { priceCardHtml } from "../src/price-image-lib";

describe("imagen de precios", () => {
  it("un bloque por país, zonas de más cara a más barata, sin fuentes", () => {
    const rows = pricesByCountry([
      { country: "ES", min: 85, max: 255, currency: "EUR", zones: [{ name: "PL5 Grada", price: 85 }, { name: "Red Zone", price: 181.5 }] },
      { country: "ES", min: 85, max: 255, currency: "EUR" },
      { country: "GB", min: 70, max: 210, currency: "GBP" },
    ]);
    const html = priceCardHtml("U2", "The Greatest Show On Earth", rows);
    expect(html.indexOf("Red Zone")).toBeLessThan(html.indexOf("PL5 Grada"));
    expect(html).toContain("181,50 €");
    expect(html).toContain("ESPAÑA");
    expect(html).toContain("REINO UNIDO");
    expect(html).toContain("£70");
    expect(html).not.toMatch(/Fuente/i);
  });
});
