import { describe, expect, it } from "vitest";
import { nameMatcher } from "../src/news-radar-lib";

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
