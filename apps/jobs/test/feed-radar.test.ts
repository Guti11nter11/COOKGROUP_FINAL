import { describe, it, expect } from "vitest";
import type { Show } from "@gira/core";
import { diffFeed, chunkByArtist, pickFollowed } from "../src/feed-radar-lib";

const show = (id: string, attraction: string, hashSeed = "a"): Show =>
  ({
    source: "ticketmaster", sourceId: id, name: id, attractionIds: [attraction],
    venue: { tmId: "V", name: "V", city: "Madrid", country: "ES", tz: "Europe/Madrid" },
    startsAt: `2027-01-01T20:00:00Z`, localDate: "2027-01-01", status: "onsale", ticketLimit: null, url: "", isPackage: false,
    sales: [{ kind: "general", label: "Venta general", startsAt: hashSeed === "a" ? "2026-12-01T09:00:00Z" : "2026-12-02T09:00:00Z", endsAt: null, url: null, orderRank: 90 }],
  }) as Show;

describe("pickFollowed", () => {
  it("se queda con las fechas de entidades seguidas (por cualquier atracción del evento)", () => {
    const shows = [show("1", "A"), { ...show("2", "X"), attractionIds: ["X", "B"] }, show("3", "Z")];
    expect(pickFollowed(shows, new Set(["A", "B"])).map((s) => s.sourceId)).toEqual(["1", "2"]);
  });
});

describe("diffFeed", () => {
  it("sin estado previo → todo es cambio", () => {
    const { changed, state } = diffFeed({}, [show("1", "A"), show("2", "A")]);
    expect(changed.map((s) => s.sourceId)).toEqual(["1", "2"]);
    expect(Object.keys(state)).toEqual(["1", "2"]);
  });
  it("solo envía lo que cambió de verdad", () => {
    const { state } = diffFeed({}, [show("1", "A"), show("2", "A")]);
    const { changed } = diffFeed(state, [show("1", "A"), show("2", "A", "b"), show("3", "A")]);
    expect(changed.map((s) => s.sourceId)).toEqual(["2", "3"]);
  });
});

describe("chunkByArtist", () => {
  it("no parte las fechas de un mismo artista entre dos envíos", () => {
    const shows = [show("1", "A"), show("2", "B"), show("3", "A"), show("4", "B"), show("5", "C")];
    const chunks = chunkByArtist(shows, 3);
    for (const c of chunks) {
      const artists = new Set(c.map((s) => s.attractionIds[0]));
      for (const a of artists) expect(chunks.filter((k) => k.some((s) => s.attractionIds[0] === a))).toHaveLength(1);
    }
    expect(chunks.flat()).toHaveLength(5);
  });
});
