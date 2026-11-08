import { describe, expect, it } from "vitest";
import { instagramHandle, itemConsistent } from "../src/social-lib";

describe("Instagram oficial desde MusicBrainz", () => {
  it("toma la cuenta vigente y descarta enlaces a publicaciones", () => {
    expect(
      instagramHandle([
        { type: "social network", url: { resource: "https://www.instagram.com/p/ABC/" } },
        { type: "social network", ended: true, url: { resource: "https://www.instagram.com/vieja/" } },
        { type: "social network", url: { resource: "https://www.instagram.com/u2/" } },
      ]),
    ).toBe("u2");
    expect(instagramHandle([{ url: { resource: "https://twitter.com/u2" } }])).toBeNull();
  });
});

describe("Coherencia de lo que devuelve la IA con la publicación", () => {
  it("descarta un resultado que habla de otra publicación (índice cruzado)", () => {
    // La cuenta de Metallica no anuncia a Amon Amarth en Lisboa: la IA mezcló el índice.
    expect(itemConsistent({ artist: "Amon Amarth" }, "New merch drop! Link in bio 🤘", { name: "Metallica", artist: true })).toBe(false);
  });
  it("cuenta de artista: el resultado tiene que ser del propio artista", () => {
    expect(itemConsistent({ artist: "Metallica" }, "M72 World Tour: Madrid added! Tickets Friday 10am", { name: "Metallica", artist: true })).toBe(true);
    expect(itemConsistent({ artist: "Metallica · M72" }, "Madrid added", { name: "Metallica", artist: true })).toBe(true);
    expect(itemConsistent({ artist: "Pantera" }, "Pantera joins us in Madrid", { name: "Metallica", artist: true })).toBe(false);
  });
  it("ticketera: el artista tiene que aparecer en el texto", () => {
    expect(itemConsistent({ artist: "Amon Amarth" }, "AMON AMARTH • Lisboa • bilhetes à venda", { name: "Blueticket", artist: false })).toBe(true);
    expect(itemConsistent({ artist: "Björk" }, "bjork ao vivo no MEO Arena", { name: "Blueticket" })).toBe(true);
    expect(itemConsistent({ artist: "Amon Amarth" }, "Sorteio de bilhetes para o Rock in Rio", { name: "Blueticket" })).toBe(false);
  });
});
