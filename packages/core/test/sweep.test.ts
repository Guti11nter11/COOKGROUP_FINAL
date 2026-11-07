import { it, expect } from "vitest";
import { planSweep, type Follow } from "../src/sweep";

const mk = (n: number, tier: 1 | 2 | 3, prefix: string): Follow[] =>
  Array.from({ length: n }, (_, i) => ({ artistId: `${prefix}${i}`, name: `${prefix}${i}`, tier, tmAttractionId: `TM${prefix}${i}` }));

it("cada ciclo: solo los ⭐⭐⭐ (25 → 2 lotes de ≤ 20)", () => {
  const batches = planSweep([...mk(25, 3, "a"), ...mk(264, 2, "b"), ...mk(700, 1, "c")], new Date("2026-11-08T00:00:00Z"));
  expect(batches).toHaveLength(2);
  expect(batches.every((b) => b.length <= 20)).toBe(true);
  expect(batches.flat().sort()).toEqual(mk(25, 3, "a").map((f) => f.tmAttractionId).sort());
});

it("⭐⭐ y ⭐ nunca van por la API: los cubre el Discovery Feed cada hora (cuota y cola)", () =>
  expect(planSweep([...mk(5, 2, "b"), ...mk(5, 1, "c")], new Date("2026-11-08T00:00:00Z"))).toEqual([]));

it("sin seguidos → sin lotes", () => expect(planSweep([], new Date("2026-11-08T00:00:00Z"))).toEqual([]));

it("ignora seguidos sin attractionId", () => {
  const f: Follow[] = [{ artistId: "x", name: "x", tier: 3, tmAttractionId: "" }];
  expect(planSweep(f, new Date("2026-11-08T00:00:00Z"))).toEqual([]);
});
