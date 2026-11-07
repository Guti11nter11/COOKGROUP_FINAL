import { describe, it, expect } from "vitest";
import { rankEntities, buildAttractionIndex, resolveEntity } from "../src/follows-lib";

describe("rankEntities", () => {
  const cands = [
    { name: "Coldplay", listeners: 9_000_000 },
    { name: "coldplay", listeners: 8_000_000 },
    { name: "Aitana", listeners: 600_000 },
    { name: "Small Band", listeners: 1_000 },
    { name: "Mid Act", listeners: 2_000_000 },
  ];
  it("deduplica por nombre, respeta los imprescindibles y reparte niveles por oyentes", () => {
    const r = rankEntities(cands, ["Aitana"], { tier2: 1, limit: 3 });
    expect(r).toEqual([
      { name: "Aitana", tier: 3, listeners: 600_000 },
      { name: "Coldplay", tier: 2, listeners: 9_000_000 },
      { name: "Mid Act", tier: 1, listeners: 2_000_000 },
    ]);
  });
});

describe("resolveEntity con el índice del feed", () => {
  const index = buildAttractionIndex([
    { attractionId: "A1", attractionName: "Muse", musicbrainz_id: "mb-muse", events: 12 },
    { attractionId: "A2", attractionName: "MUSE Tribute", musicbrainz_id: null, events: 3 },
    { attractionId: "A3", attractionName: "Rosalía", musicbrainz_id: null, events: 4 },
    { attractionId: "A4", attractionName: "ROSALÍA", musicbrainz_id: null, events: 20 },
  ]);
  it("prefiere el MBID", () => expect(resolveEntity("Muse", "mb-muse", index)).toBe("A1"));
  it("si no, nombre exacto con más fechas", () => expect(resolveEntity("Rosalía", null, index)).toBe("A4"));
  it("no adivina", () => expect(resolveEntity("Desconocido", null, index)).toBeNull());
});
