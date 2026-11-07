import { describe, it, expect } from "vitest";
import feed from "./fixtures/feed-events.json";
import api from "./fixtures/tm-events.json";
import { normalizeFeedEvent, semanticHash, topicOf, extractTicketLimit } from "../src/feed";
import { normalizeTmEvent } from "../src/ticketmaster";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const [jake, nfl, icicle] = feed.events as any[];

describe("normalizeFeedEvent (Discovery Feed real)", () => {
  it("convierte un concierto con dos preventas", () => {
    const s = normalizeFeedEvent(jake)!;
    expect(s).toMatchObject({
      source: "ticketmaster",
      sourceId: "Z698xZ2qZ1k_y8V-_",
      name: "JAKE BUGG - Alamo – Solo Acoustic Tour",
      attractionIds: ["K8vZ917COCV"],
      venue: { tmId: "Z598xZ2qZd61k", name: "Teatro Eslava", city: "Madrid", country: "ES", tz: "Europe/Madrid" },
      startsAt: "2027-04-06T18:30:00Z",
      localDate: "2027-04-06",
      status: "onsale",
      url: "https://www.ticketmaster.es/event/jake-bugg-alamo--solo-acoustic-tour-entradas/679434859",
      isPackage: false,
      segment: "Music",
      promoters: ["Live Nation España S.A.U."],
    });
    expect(s.sales.map((w) => [w.kind, w.label, w.startsAt])).toEqual([
      ["artist", "Preventa Artista", "2026-09-09T09:00:00Z"],
      ["platform", "Preventa Spotify", "2026-09-10T10:00:00Z"],
      ["general", "Venta general", "2026-09-11T09:00:00Z"],
    ]);
  });

  it("toma el límite de entradas de 'pleaseNote'", () =>
    expect(normalizeFeedEvent(icicle)!.ticketLimit).toBe("A max of 12 tickets per person and per household applies."));

  it("conserva el género del deporte desde la atracción (NFL)", () =>
    expect(normalizeFeedEvent(nfl)).toMatchObject({ segment: "Sports", genre: "Football", subGenre: "NFL", venue: { name: "Bernabéu" } }));

  it("descarta basura", () => {
    expect(normalizeFeedEvent(null)).toBeNull();
    expect(normalizeFeedEvent({ eventId: "x" })).toBeNull();
  });
});

describe("topicOf", () => {
  it("música", () => expect(topicOf(normalizeFeedEvent(jake)!)).toBe("music"));
  it("NFL", () => expect(topicOf(normalizeFeedEvent(nfl)!)).toBe("nfl"));
  it.each([
    [{ segment: "Sports", genre: "Soccer" }, "football"],
    [{ segment: "Sports", genre: "Motorsports/Racing", subGenre: "Formula 1" }, "f1"],
    [{ segment: "Sports", genre: "Tennis" }, "tennis"],
    [{ segment: "Sports", genre: "Boxing" }, "other_sport"],
    [{ segment: "Arts & Theatre" }, "other"],
  ] as const)("%o → %s", (c, t) => expect(topicOf({ ...normalizeFeedEvent(jake)!, ...c })).toBe(t));
});

describe("semanticHash", () => {
  it("ignora campos no semánticos (URL, promotores, límite)", () => {
    const s = normalizeFeedEvent(jake)!;
    expect(semanticHash({ ...s, url: "https://otra", promoters: [], ticketLimit: "x" })).toBe(semanticHash(s));
  });
  it("cambia si cambia una preventa", () => {
    const s = normalizeFeedEvent(jake)!;
    const t = structuredClone(s);
    t.sales[0]!.startsAt = "2026-09-09T10:00:00Z";
    expect(semanticHash(t)).not.toBe(semanticHash(s));
  });
  it("la misma fecha leída por la API o por el feed da el mismo hash", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fromApi = normalizeTmEvent((api._embedded.events as any[])[0])!;
    const asFeed = normalizeFeedEvent({
      eventId: fromApi.sourceId,
      eventName: "otro nombre",
      eventStatus: "onsale",
      eventStartDateTime: fromApi.startsAt,
      eventStartLocalDate: fromApi.localDate,
      primaryEventUrl: "https://x",
      venue: { venueId: fromApi.venue.tmId, venueName: "x", venueTimezone: "Europe/Madrid", venueCity: "Sevilla", venueCountryCode: "ES" },
      attractions: [{ attraction: { attractionId: "K8vZ91712W7" } }],
      onsaleStartDateTime: "2026-11-13T09:00:00Z",
      presales: [
        { presale: { name: "Priority from O2", startDatetime: "2026-11-11T09:00:00Z", endDatetime: "2026-11-12T22:00:00Z" } },
        { presale: { name: "Artist Presale", startDatetime: "2026-11-10T08:00:00Z", endDatetime: "2026-11-11T22:00:00Z" } },
      ],
    })!;
    expect(semanticHash(asFeed)).toBe(semanticHash(fromApi));
  });
});

describe("extractTicketLimit", () => {
  it.each([
    ["A max of 12 tickets per person and per household applies. Other.", "A max of 12 tickets per person and per household applies."],
    ["Edades: +16. Límite de 4 entradas por persona.", "Límite de 4 entradas por persona."],
    ["Nada relevante aquí.", null],
    [null, null],
  ])("%s", (t, r) => expect(extractTicketLimit(t)).toBe(r));
});
