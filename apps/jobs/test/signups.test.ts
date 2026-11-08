import { describe, expect, it } from "vitest";
import { cleanUrl, mentionsDate, pickSignups } from "../src/signups-lib";

const shows = [
  { city: "Amsterdam", localDate: "2027-07-05" },
  { city: "Amsterdam", localDate: "2027-07-06" },
  { city: "London", localDate: "2027-07-16" },
];

describe("registros en la web oficial", () => {
  it("limpia el seguimiento y rechaza pases de cola", () => {
    expect(cleanUrl("https://www.bandsintown.com/t/109124485?affil_code=&app_id=js_www.jamiroquai.com&came_from=700&release_id=06fa&utm_campaign=x")).toBe(
      "https://www.bandsintown.com/t/109124485?release_id=06fa",
    );
    expect(cleanUrl("https://tm.example/e?queueittoken=abc")).toBeNull();
  });
  it("reconoce fechas en inglés y español", () => {
    expect(mentionsDate("Jul. 5, 2027 AMSTERDAM, NETHERLANDS ZIGGO DOME", "2027-07-05")).toBe(true);
    expect(mentionsDate("Jul. 6, 2027 AMSTERDAM", "2027-07-05")).toBe(false);
    expect(mentionsDate("sábado 16 de julio · Londres", "2027-07-16")).toBe(true);
  });
  it("Bandsintown: solo enlaces de preventa, asociados a su fecha; fuera alertas y redes", () => {
    const got = pickSignups(
      [
        { text: "PRESALE", href: "https://www.bandsintown.com/t/109124485?release_id=a&utm_medium=web", context: "Jul. 5, 2027 AMSTERDAM, NETHERLANDS ZIGGO DOME GET ALERTS PRESALE" },
        { text: "GET ALERTS", href: "https://www.bandsintown.com/artist-rsvp/954-jamiroquai?event_id=1", context: "Jul. 5, 2027 AMSTERDAM" },
        { text: "Instagram", href: "https://www.instagram.com/jamiroquai", context: "" },
        { text: "Sign up for presale", href: "https://signup.livenation.com/gracieabrams", context: "Join the presale list" },
        { text: "Tickets", href: "https://www.ticketmaster.co.uk/event/123", context: "London" },
      ],
      shows,
      "jamiroquai.com",
    );
    expect(got).toEqual([
      { url: "https://www.bandsintown.com/t/109124485?release_id=a", label: "Bandsintown", city: "Amsterdam", localDate: "2027-07-05" },
      { url: "https://signup.livenation.com/gracieabrams", label: "Live Nation (registro)", city: null, localDate: null },
    ]);
  });
});

import { presaleSignal } from "../src/signups-lib";
describe("registros de artistas sin fechas todavía", () => {
  const l = (url: string, label = "Sign up") => ({ url, label, city: null, localDate: null });
  it("plataformas de preventa y enlaces de gira sí", () => {
    expect(presaleSignal(l("https://laylo.com/rush/abc"))).toBe(true);
    expect(presaleSignal(l("https://www.rush.com/sphere/"), { text: "Signup Here", href: "https://www.rush.com/sphere/", context: "RUSH at SPHERE Las Vegas · tickets on sale November 13" })).toBe(true);
    expect(presaleSignal(l("https://signup.ticketmaster.com/noahkahan"))).toBe(true);
  });
  it("newsletter genérica y tienda no", () => {
    expect(presaleSignal(l("https://www.artist.com/newsletter"), { text: "Sign up", href: "", context: "Sign up for our newsletter" })).toBe(false);
    expect(presaleSignal(l("https://www.artist.com/signup"), { text: "Sign up", href: "", context: "Join the mailing list for news and updates" })).toBe(false);
    expect(presaleSignal(l("https://store.artist.com/register"), { text: "Register", href: "", context: "store" })).toBe(false);
  });
});
