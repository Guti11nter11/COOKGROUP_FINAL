import { describe, expect, it } from "vitest";
import { isSweepTick, slotDue, sweepEveryMin, JOB_SLOTS } from "../src/schedule";

// Noviembre: Madrid = UTC+1.
const at = (hhmm: string) => new Date(`2026-11-09T${hhmm}:00+01:00`);

describe("horario por franjas (hora de Madrid)", () => {
  it("frecuencia de barrido por franja", () => {
    expect(sweepEveryMin(at("03:00"))).toBe(0);
    expect(sweepEveryMin(at("08:10"))).toBe(15);
    expect(sweepEveryMin(at("10:00"))).toBe(10);
    expect(sweepEveryMin(at("15:00"))).toBe(15);
    expect(sweepEveryMin(at("18:00"))).toBe(10);
    expect(sweepEveryMin(at("23:00"))).toBe(30);
  });
  it("tics del cron que barren", () => {
    expect(isSweepTick(at("03:00"))).toBe(false);
    expect(isSweepTick(at("10:05"))).toBe(false);
    expect(isSweepTick(at("10:10"))).toBe(true);
    expect(isSweepTick(at("18:05"))).toBe(false);
    expect(isSweepTick(at("18:10"))).toBe(true);
    expect(isSweepTick(at("23:30"))).toBe(true);
    expect(isSweepTick(at("23:35"))).toBe(false);
  });
  it("hora fija de un trabajo: una vez, y no se recuperan las antiguas", () => {
    const slots = JOB_SLOTS["enrich.yml"]!;
    expect(slotDue(slots, at("09:02"), new Set())).toBe("09:00");
    expect(slotDue(slots, at("09:07"), new Set(["09:00"]))).toBeNull();
    expect(slotDue(slots, at("10:30"), new Set())).toBeNull(); // 09:00 ya pasó hace más de 60 min
    expect(slotDue(slots, at("07:00"), new Set())).toBeNull();
  });
  it("todos los trabajos tienen horas fijas y ninguna de madrugada", () => {
    for (const slots of Object.values(JOB_SLOTS)) for (const s of slots) expect(s >= "08:00").toBe(true);
    expect(Object.keys(JOB_SLOTS).sort()).toEqual(["enrich.yml", "feed-radar.yml", "news-radar.yml", "social.yml", "sports.yml", "ticketers.yml"]);
  });
  it("en verano también (Madrid = UTC+2)", () => expect(sweepEveryMin(new Date("2027-07-01T08:00:00Z"))).toBe(10));
});
