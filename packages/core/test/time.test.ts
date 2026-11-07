import { describe, it, expect } from "vitest";
import { formatTriple, formatMadridDate, localDateIn, formatDateIn } from "../src/time";

describe("formatTriple", () => {
  it("invierno: Madrid UTC+1, Londres UTC+0", () => {
    expect(formatTriple("2026-12-03T09:00:00Z")).toEqual({ madrid: "10:00", london: "09:00", local: null });
  });
  it("verano: Madrid UTC+2, Londres UTC+1", () => {
    expect(formatTriple("2027-06-12T08:00:00Z")).toEqual({ madrid: "10:00", london: "09:00", local: null });
  });
  it("noche del cambio de hora 2027 (28 mar)", () => {
    expect(formatTriple("2027-03-28T00:30:00Z").madrid).toBe("01:30");
    expect(formatTriple("2027-03-28T01:30:00Z").madrid).toBe("03:30");
  });
  it("muestra la hora local si el recinto está en otro huso", () => {
    expect(formatTriple("2027-06-12T08:00:00Z", "America/New_York").local).toBe("04:00");
  });
  it("no repite la hora local si el recinto está en Madrid o Londres", () => {
    expect(formatTriple("2027-06-12T08:00:00Z", "Europe/Madrid").local).toBeNull();
    expect(formatTriple("2027-06-12T08:00:00Z", "Europe/London").local).toBeNull();
  });
  it("fecha legible en Madrid", () => {
    expect(formatMadridDate("2026-12-03T09:00:00Z")).toBe("jue 3 dic 2026, 10:00");
  });
});

describe("localDateIn", () => {
  it("23:30 UTC del 7-nov ya es 8-nov en Madrid", () =>
    expect(localDateIn(new Date("2026-11-07T23:30:00Z"), "Europe/Madrid")).toBe("2026-11-08"));
  it("acepta ISO", () => expect(localDateIn("2026-11-07T12:00:00Z", "Europe/London")).toBe("2026-11-07"));
});

describe("formatDateIn", () => {
  it("fecha y hora en la zona del recinto", () => expect(formatDateIn("2027-06-12T18:30:00Z", "Europe/London")).toBe("sáb 12 jun 2027, 19:30"));
});
