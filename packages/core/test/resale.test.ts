import { describe, expect, it } from "vitest";
import { estimateResale, robustStats } from "../src/resale";

describe("reventa", () => {
  it("estadística robusta: descarta anuncios absurdos sin tope fijo", () => {
    const s = robustStats([200, 210, 220, 230, 240, 250, 260, 99999])!;
    expect(s.n).toBe(7);
    expect(s.median).toBe(230);
    expect(robustStats([1, 2])).toBeNull();
    // Una final cara: todo alto pero coherente → se conserva.
    expect(robustStats([9000, 10000, 11000, 12000, 13000])!.median).toBe(11000);
  });
  it("con mercado observado: rango alrededor del multiplicador real", () => {
    const r = estimateResale({ tier: 3, hot: false, dates: 5, countries: 2, observed: [2.0, 2.4], listings: 60 });
    expect(r).toMatchObject({ confidence: "alta" });
    expect(r.low).toBeGreaterThanOrEqual(1.6);
    expect(r.high).toBeLessThanOrEqual(3.0);
  });
  it("sin mercado: modelo con confianza baja y explicación", () => {
    const r = estimateResale({ tier: 3, hot: true, dates: 2, countries: 1, observed: [], listings: 0 });
    expect(r.confidence).toBe("baja");
    expect(r.basis).toContain("alta demanda");
    expect(r.high).toBeGreaterThan(3);
  });
});
