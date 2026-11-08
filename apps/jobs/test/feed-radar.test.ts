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

describe("descubrimiento de giras de alta demanda", async () => {
  const { discoverHot } = await import("../src/feed-radar-lib");
  const ev = (id: string, name: string, hot = true, extra: object = {}) => ({ attractionId: id, attractionName: name, hot, country: "ES", segment: "Music", isPackage: false, ...extra });
  it("solo hotEvent, no seguidas, sin tributos ni paquetes; las de más fechas primero", () => {
    const got = discoverHot(
      [ev("A", "Artista Nuevo"), ev("A", "Artista Nuevo", true, { country: "GB" }), ev("B", "Otra"), ev("C", "Queen Tribute Experience"), ev("D", "Seguida"), ev("E", "Frío", false), ev("F", "Paquete", true, { isPackage: true }), ev("G", "Teatro", true, { segment: "Arts & Theatre" })],
      new Set(["D"]),
    );
    expect(got).toEqual([
      { tmAttractionId: "A", name: "Artista Nuevo", hotDates: 2, countries: ["ES", "GB"] },
      { tmAttractionId: "B", name: "Otra", hotDates: 1, countries: ["ES"] },
    ]);
  });
  it("también giras grandes a punto de salir a la venta (estadio, o arenas en 2 países); no las locales", () => {
    const sale = (id: string, name: string, country: string, extra: object = {}) => ev(id, name, false, { country, upcomingSale: true, ...extra });
    const got = discoverHot(
      [
        sale("S", "Gira Estadio", "ES", { bigVenue: true, stadium: true }),
        sale("A", "Gira Arenas", "ES", { bigVenue: true }), sale("A", "Gira Arenas", "FR", { bigVenue: true }),
        sale("M", "Arena Un País", "MX", { bigVenue: true }), sale("M", "Arena Un País", "MX", { bigVenue: true }),
        sale("L", "Lucha Libre CMLL", "MX", { bigVenue: true, segment: "Sports" }), sale("L", "Lucha Libre CMLL", "ES", { bigVenue: true, segment: "Sports" }),
        sale("N", "Navidad en las montañas", "MX", { bigVenue: true, stadium: true }),
        sale("C", "Corona Capital Festival", "MX", { bigVenue: true, stadium: true }),
      ],
      new Set(),
    );
    expect(got.map((d) => d.name)).toEqual(["Gira Estadio", "Gira Arenas"]);
  });
  it("recinto grande por nombre", async () => {
    const { BIG_VENUE } = await import("../src/feed-radar-lib");
    expect(["Estadio Metropolitano", "Movistar Arena", "Palau Sant Jordi", "The O2", "Foro Sol", "Ziggo Dome"].every((v) => BIG_VENUE.test(v))).toBe(true);
    expect(["Sala Riviera", "TivoliVredenburg", "Teatro Real"].some((v) => BIG_VENUE.test(v))).toBe(false);
  });
});
