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

import { deadPage, outOfScope, presaleSignal } from "../src/signups-lib";
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
    expect(presaleSignal(l("https://oasismusic.lnk.to/live"), { text: "Live 25", href: "", context: "tour tickets" })).toBe(false);
    expect(presaleSignal(l("https://artist.lnk.to/presale"), { text: "Presale sign up", href: "", context: "" })).toBe(true);
    // La palabra "Tour" del menú de la web no convierte la newsletter en registro de preventa.
    expect(presaleSignal(l("https://www.sabrinacarpenter.com/sign-up/"), { text: "Sign Up", href: "", context: "Home Music Videos Tour Shop Sign Up Instagram TikTok" })).toBe(false);
  });
});

describe("registros que no sirven", () => {
  it("países no cubiertos y páginas que ya no existen", () => {
    expect(outOfScope("https://signup.ticketmaster.com.au/brunomars")).toBe(true);
    expect(outOfScope("https://signup.ticketmaster.com/noahkahan")).toBe(false);
    expect(presaleSignal({ url: "https://signup.ticketmaster.com.au/brunomars", label: "Ticketmaster (registro)", city: null, localDate: null })).toBe(false);
    expect(deadPage("PAGE NOT FOUND Sorry! Looks like the tour you were looking for isn't on this page.")).toBe(true);
    expect(deadPage("Register for Verified Fan access")).toBe(false);
  });
});

describe("revisión 17:47 (10-11)", () => {
  it("un archivo de calendario no es un registro; etiquetas sin saltos de línea", async () => {
    const { pickSignups } = await import("../src/signups-lib");
    const raw = [
      { text: "10 Nov, Tue at 10:00AM (local)", href: "https://www.bryanadams.com/add-to-calendar/1922/presale.ics", context: "presale" },
      { text: "Join the mailing list\n                  ", href: "https://www.bryanadams.com/mailing-list", context: "presale sign up" },
    ];
    const out = pickSignups(raw, [], "bryanadams.com");
    expect(out.map((o) => o.url)).toEqual(["https://www.bryanadams.com/mailing-list"]);
    expect(out[0]!.label).toBe("Join the mailing list");
  });
});

describe("revisión 09:47 (13-11)", () => {
  it("las páginas legales de la plataforma (términos, cookies, privacidad) no son registros", async () => {
    const { pickSignups } = await import("../src/signups-lib");
    const raw = ["https://laylo.com/samfender/m/sY0U7F", "https://laylo.com/terms", "https://laylo.com/cookies", "https://laylo.com/privacy"].map((href) => ({ text: "Laylo", href, context: "presale" }));
    expect(pickSignups(raw, [], "samfender.com").map((o) => o.url)).toEqual(["https://laylo.com/samfender/m/sY0U7F"]);
  });
});

