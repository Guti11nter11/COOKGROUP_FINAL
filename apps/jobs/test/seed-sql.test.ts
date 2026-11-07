import { it, expect } from "vitest";
import { buildSeedSql } from "../src/seed-sql";

const artists = [
  { name: "Guns N' Roses", tier: 3 as const, tmAttractionId: "K8vZ9171ob7", mbid: "eeb1195b", deezerId: 1, deezerFans: 10 },
  { name: "Sin ID", tier: 2 as const, tmAttractionId: null, mbid: null, deezerId: null, deezerFans: null },
];

it("escapa comillas simples y usa ids estables", () => {
  const sql = buildSeedSql(artists);
  expect(sql).toContain("'a_K8vZ9171ob7', 'Guns N'' Roses', 'K8vZ9171ob7', 'eeb1195b', 1, 10");
  expect(sql).toContain("INSERT INTO follow (artist_id, tier) VALUES ('a_K8vZ9171ob7', 3)");
});

it("no pisa el nivel que el propietario cambie después (follow: DO NOTHING)", () =>
  expect(buildSeedSql(artists)).toMatch(/INSERT INTO follow .* ON CONFLICT \(artist_id\) DO NOTHING/));

it("omite artistas sin attractionId", () => expect(buildSeedSql(artists)).not.toContain("Sin ID"));
