import { describe, expect, it } from "vitest";
import { consensus, limitFromText } from "../src/limits-lib";

describe("límite de entradas en prensa", () => {
  it("lee el número en varios idiomas", () => {
    expect(limitFromText("Habrá un máximo de 4 entradas por persona en la preventa.")).toBe(4);
    expect(limitFromText("There is a limit of four tickets per person.")).toBe(4);
    expect(limitFromText("Fans will be restricted to 6 tickets per household")).toBe(6);
    expect(limitFromText("Si potranno acquistare massimo 4 biglietti a persona")).toBe(4);
    expect(limitFromText("Pro Person können maximal 4 Tickets pro Bestellung gekauft werden")).toBe(4);
    expect(limitFromText("Limite de 6 billets par commande")).toBe(6);
    expect(limitFromText("Er geldt een maximum: maximaal 4 tickets per persoon")).toBe(4);
  });
  it("no confunde precios, fechas ni límites sin 'por persona'", () => {
    expect(limitFromText("Las entradas cuestan 4 euros por persona")).toBeNull();
    expect(limitFromText("4 conciertos y entradas desde 85 €")).toBeNull();
    expect(limitFromText("Tickets on sale 4 December")).toBeNull();
  });
  it("consenso entre fuentes", () => {
    expect(consensus([4, 4, 6])).toBe(4);
    expect(consensus([6, 4])).toBe(4);
    expect(consensus([])).toBeNull();
  });
});
