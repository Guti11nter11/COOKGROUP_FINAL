import { describe, expect, it } from "vitest";
import { f1Lines, footballLines } from "../src/sports-agenda-lib";

describe("agenda de deporte", () => {
  it("fútbol: un partido una vez, en orden, con entradas del club local", () => {
    const m = (id: number, d: string, home: number, away: number) => ({ id, utcDate: d, competition: { code: "PD" }, homeTeam: { id: home, shortName: home === 86 ? "Real Madrid" : "Rival" }, awayTeam: { id: away, shortName: away === 78 ? "Atleti" : "Rival" } });
    const lines = footballLines([m(2, "2026-11-30T20:00:00Z", 5, 86), m(1, "2026-11-22T20:00:00Z", 86, 78), m(1, "2026-11-22T20:00:00Z", 86, 78)]);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("**Real Madrid – Atleti** · LaLiga · en casa · [Entradas](https://www.realmadrid.com/es-ES/entradas)");
    expect(lines[1]).toContain("fuera (entradas para visitantes vía el club)");
  });
  it("F1: solo carreras futuras, nombre en español", () => {
    const lines = f1Lines([{ raceName: "Brazilian Grand Prix", date: "2026-11-08", time: "17:00:00Z" }, { raceName: "Las Vegas Grand Prix", date: "2026-11-22", time: "06:00:00Z", Circuit: { Location: { locality: "Las Vegas", country: "USA" } } }], new Date("2026-11-08T21:00:00Z"));
    expect(lines).toEqual([`<t:${Date.parse("2026-11-22T06:00:00Z") / 1000}:D> · **GP de Las Vegas** · Las Vegas, USA · [Entradas](https://tickets.formula1.com/en)`]);
  });
});
