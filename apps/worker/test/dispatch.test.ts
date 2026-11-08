import { describe, expect, it } from "vitest";
import { due } from "../src/dispatch";

describe("lanzar trabajos desde el cron del Worker", () => {
  const now = new Date("2026-11-08T08:00:00Z");
  it("toca si nunca se lanzó o si pasó el intervalo (con 1 min de margen)", () => {
    expect(due(null, 60, now)).toBe(true);
    expect(due("2026-11-08T07:01:00Z", 60, now)).toBe(true);
    expect(due("2026-11-08T07:30:00Z", 60, now)).toBe(false);
  });
});
