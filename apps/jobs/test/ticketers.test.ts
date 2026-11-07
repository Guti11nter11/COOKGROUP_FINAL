import { describe, expect, it } from "vitest";
import { listingsFor, TICKETERS } from "../src/ticketers-lib";

const entradas = TICKETERS.find((t) => t.id === "entradas")!;
const html = `
<a href="/artist/u2/?affiliate=EES">U2</a>
<a href="/event/u2-the-greatest-show-on-earth-estadi-olimpic-barcelona-20123456/">U2 · Barcelona · 13/05/2027</a>
<a href="/event/u2-the-greatest-show-on-earth-estadi-olimpic-barcelona-20123456/#tickets">Entradas</a>
<a href="/event/coldplay-madrid-1/">Coldplay</a>
<a href="https://otra.com/event/u2">U2 fuera</a>
<a href="/event/u2-x/?queueittoken=abc">U2 cola</a>`;

describe("ticketeras sin API", () => {
  it("solo fichas del artista en la propia ticketera, sin seguimiento ni pases de cola", () => {
    const got = listingsFor(html, "https://www.entradas.com/search/?searchterm=U2", "U2", entradas);
    expect(got.map((l) => l.url)).toEqual([
      "https://www.entradas.com/artist/u2/",
      "https://www.entradas.com/event/u2-the-greatest-show-on-earth-estadi-olimpic-barcelona-20123456/",
    ]);
    expect(got[1]!.text).toBe("U2 · Barcelona · 13/05/2027");
  });
});
