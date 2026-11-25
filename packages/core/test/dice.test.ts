import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { diceArtistEvents, parseDiceEvent } from "../src/dice";

const event = readFileSync(new URL("./fixtures/dice-event.html", import.meta.url), "utf8");
const artist = readFileSync(new URL("./fixtures/dice-artist.html", import.meta.url), "utf8");

describe("DICE (páginas públicas de artista y de evento)", () => {
  it("la página del artista da sus eventos futuros", () => {
    expect(diceArtistEvents(artist, new Date("2026-11-24T00:00:00Z"))).toEqual(["https://dice.fm/event/6aec7477b4defd0001a0ba28"]);
    expect(diceArtistEvents(artist, new Date("2026-12-03T00:00:00Z"))).toEqual([]);
  });
  it("la página del evento da recinto, venta, límite, precio y estado (Charli xcx en Apple Music Hall)", () => {
    const s = parseDiceEvent(event, "K8vZ917CDKf", "https://dice.fm/event/6aec7477b4defd0001a0ba28")!;
    expect(s).toMatchObject({
      sourceId: "dice:6aec7477b4defd0001a0ba28",
      name: "Charli xcx",
      attractionIds: ["K8vZ917CDKf"],
      venue: { tmId: "dice:19890", name: "Apple Music Hall", city: "London", country: "GB", tz: "Europe/London" },
      startsAt: "2026-12-02T18:30:00.000Z",
      localDate: "2026-12-02",
      status: "offsale",
      ticketLimit: "Límite de 4 entradas por persona (DICE).",
      url: "https://dice.fm/event/6aec7477b4defd0001a0ba28",
      price: { min: 40, max: 40, currency: "GBP" },
      segment: "Music",
    });
    expect(s.sales).toEqual([{ kind: "general", label: "Venta general", startsAt: "2026-11-25T10:00:00.000Z", endsAt: null, url: null, orderRank: 90 }]);
  });
  it("con preventa, la preventa va antes", () => {
    const pre = event.replace('\\"pre_sale_start_date\\": null', '\\"pre_sale_start_date\\": \\"2026-11-24T10:00:00+00:00\\"');
    const s = parseDiceEvent(pre, "K1", "https://dice.fm/event/x")!;
    expect(s.sales.map((w) => [w.label, w.startsAt])).toEqual([["Preventa DICE", "2026-11-24T10:00:00.000Z"], ["Venta general", "2026-11-25T10:00:00.000Z"]]);
  });
});

describe("DICE: recintos", () => {
  const venue = readFileSync(new URL("./fixtures/dice-venue.html", import.meta.url), "utf8");
  it("la página del recinto da sus eventos futuros con nombre", async () => {
    const { diceVenueEvents } = await import("../src/dice");
    expect(diceVenueEvents(venue, new Date("2026-11-25T00:00:00Z"))).toEqual([
      { name: "Chase & Status (Live)", url: "https://dice.fm/event/6aec730b2a1bb4000161052f" },
      { name: "Charli xcx", url: "https://dice.fm/event/6aec7477b4defd0001a0ba28" },
      { name: "Kings Of Leon", url: "https://dice.fm/event/6aec651977cbe90001eb6dcd" },
      { name: "Jorja Smith", url: "https://dice.fm/event/6aec67e766dab8000131301f" },
    ]);
  });
});
