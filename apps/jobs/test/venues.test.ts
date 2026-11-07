import { describe, expect, it } from "vitest";
import { capacityOf, matchesVenue, pickVenue, type WdEntity } from "../src/venues-lib";

const cap = (amount: string, rank = "normal") => ({ rank, mainsnak: { datavalue: { value: { amount } } } });
const country = (id: string) => ({ mainsnak: { datavalue: { value: { id } } } });
const metropolitano: WdEntity = {
  id: "Q1194488",
  labels: { en: { value: "Metropolitano Stadium" }, es: { value: "Estadio Metropolitano" } },
  aliases: { es: [{ value: "Riyadh Air Metropolitano" }] },
  claims: { P1083: [cap("+70460"), cap("+68456")], P17: [country("Q29")] },
};
const madrid: WdEntity = { id: "Q2807", labels: { en: { value: "Madrid" } }, claims: { P17: [country("Q29")] } };
const wembleyArena: WdEntity = { id: "Q1", labels: { en: { value: "OVO Arena Wembley" } }, claims: { P1083: [cap("+12500")], P17: [country("Q145")] } };

describe("aforo desde Wikidata", () => {
  it("capacidad: preferida si existe, si no la mayor", () => {
    expect(capacityOf(metropolitano)).toBe(70460);
    expect(capacityOf({ id: "x", claims: { P1083: [cap("+50000"), cap("+42000", "preferred")] } })).toBe(42000);
    expect(capacityOf(madrid)).toBeNull();
  });
  it("el recinto debe estar en el país y compartir una palabra distintiva", () => {
    expect(matchesVenue(metropolitano, { name: "Estadio Riyadh Air Metropolitano", country: "ES" })).toBe(true);
    expect(matchesVenue(metropolitano, { name: "Estadio Metropolitano", country: "GB" })).toBe(false);
    expect(matchesVenue(wembleyArena, { name: "Wembley Stadium", country: "GB" })).toBe(true);
    expect(matchesVenue(metropolitano, { name: "Estadio de La Cartuja", country: "ES" })).toBe(false);
  });
  it("pickVenue prefiere el mismo tipo de recinto (estadio frente a arena)", () => {
    const stadium: WdEntity = { id: "Q2", labels: { en: { value: "Wembley Stadium" } }, claims: { P1083: [cap("+90000")], P17: [country("Q145")] } };
    expect(pickVenue([wembleyArena, stadium], { name: "Wembley Stadium", country: "GB" })).toEqual({ id: "Q2", capacity: 90000 });
  });
  it("pickVenue salta la ciudad y elige el estadio", () =>
    expect(pickVenue([madrid, metropolitano], { name: "Riyadh Air Metropolitano", country: "ES" })).toEqual({ id: "Q1194488", capacity: 70460 }));
});

describe("aforo desde el cuadro de datos de Wikipedia", async () => {
  const { capacityFromWikitext } = await import("../src/venues-lib");
  it("lee la capacidad con separadores de miles", () => {
    expect(capacityFromWikitext("{{Infobox venue\n| name = Co-op Live\n| capacity = 23,500<ref>x</ref>\n}}")).toBe(23500);
    expect(capacityFromWikitext("| capacidad = 17.453 espectadores")).toBe(17453);
    expect(capacityFromWikitext("| capacity = {{nowrap|12 500}}")).toBe(12500);
    expect(capacityFromWikitext("| opened = 2023")).toBeNull();
  });
});
