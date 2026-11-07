import { it, expect } from "vitest";
import { planSweep, type Follow } from "../src/sweep";

const mk = (n: number, tier: 1 | 2 | 3, prefix: string): Follow[] =>
  Array.from({ length: n }, (_, i) => ({ artistId: `${prefix}${i}`, name: `${prefix}${i}`, tier, tmAttractionId: `TM${prefix}${i}` }));
const follows = [...mk(25, 3, "a"), ...mk(75, 2, "b")];

it("barrido completo cada 20 min: 100 artistas en 5 lotes sin repetir", () => {
  const batches = planSweep(follows, new Date("2026-11-08T00:00:00Z"));
  expect(batches).toHaveLength(5);
  const ids = batches.flat();
  expect(new Set(ids).size).toBe(100);
  expect(batches.every((b) => b.length <= 20)).toBe(true);
});

it("entre barridos completos solo los ⭐⭐⭐ (25 → 2 lotes)", () => {
  const batches = planSweep(follows, new Date("2026-11-08T00:05:00Z"));
  expect(batches).toHaveLength(2);
  expect(batches.flat().sort()).toEqual(mk(25, 3, "a").map((f) => f.tmAttractionId).sort());
});

it("sin seguidos → sin lotes", () => expect(planSweep([], new Date("2026-11-08T00:00:00Z"))).toEqual([]));

it("ignora seguidos sin attractionId", () => {
  const f: Follow[] = [{ artistId: "x", name: "x", tier: 3, tmAttractionId: "" }];
  expect(planSweep(f, new Date("2026-11-08T00:00:00Z"))).toEqual([]);
});

it("los ⭐ (nivel 1) nunca van por la API: se cubren con el Discovery Feed", () => {
  const f = [...mk(2, 3, "c"), ...mk(3, 1, "d")];
  expect(planSweep(f, new Date("2026-11-08T00:00:00Z")).flat().sort()).toEqual(["TMc0", "TMc1"]);
});
