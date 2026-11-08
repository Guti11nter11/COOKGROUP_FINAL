import { describe, expect, it } from "vitest";
import { isTravelOffer, nameMatcher } from "../src/news-radar-lib";

describe("radar de noticias: artistas en titulares", () => {
  const m = nameMatcher(["U2", "Yes", "HIM", "Rosalía", "Guns N' Roses", "Bad Bunny"]);
  it("palabra completa, sin acentos ni mayúsculas en nombres largos", () => {
    expect(m.match("ROSALIA anuncia gira por estadios")).toEqual(["Rosalía"]);
    expect(m.match("Guns N' Roses vuelven a Madrid")).toEqual(["Guns N' Roses"]);
    expect(m.match("bad bunny suma fecha extra")).toEqual(["Bad Bunny"]);
  });
  it("nombres cortos solo con mayúsculas exactas", () => {
    expect(m.match("U2 anuncia fecha extra en Roma")).toEqual(["U2"]);
    expect(m.match("Yes, the tickets are on sale for him")).toEqual(["Yes"]);
    expect(m.match("yes we can")).toEqual([]);
    expect(m.match("Su2 nuevo disco")).toEqual([]);
  });
});

describe("ofertas de viaje (fuera de alcance)", () => {
  it("descarta paquetes de hotel y hospitality", () => {
    expect(isTravelOffer("Wimbledon 2027 hotel packages: how to get tickets and a room")).toBe(true);
    expect(isTravelOffer("Premier League Darts hospitality packages on sale")).toBe(true);
    expect(isTravelOffer("Paquetes vuelo + hotel para ver a Bad Bunny")).toBe(true);
  });
  it("mantiene las noticias de entradas", () => {
    expect(isTravelOffer("Noah Kahan announces Manchester date, presale Wednesday")).toBe(false);
  });
});
