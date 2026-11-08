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

describe("AXS por sitemap", async () => {
  const { axsEventsFor } = await import("../src/ticketers-lib");
  const xml = `
  <url><loc>https://www.axs.com/uk/events/1240904/metallica-reloaded-tickets</loc><lastmod>2026-01-01</lastmod></url>
  <url><loc>https://www.axs.com/uk/events/1362958/metallica-parking-tickets</loc></url>
  <url><loc>https://www.axs.com/uk/events/1362974/metallica-tickets</loc><lastmod>2026-11-01</lastmod></url>
  <url><loc>https://www.axs.com/uk/events/1331570/unforgettable-fire-u2-tribute-tickets</loc></url>`;
  it("solo eventos del artista (sin tributos, parkings ni pases)", () => {
    expect(axsEventsFor(xml, "Metallica")).toEqual([{ url: "https://www.axs.com/uk/events/1362974/metallica-tickets", id: 1362974, lastmod: "2026-11-01" }]);
    expect(axsEventsFor(xml, "U2")).toEqual([]);
    expect(axsEventsFor(`<loc>https://www.axs.com/uk/events/5/u2-tickets</loc>`, "U2").map((e) => e.id)).toEqual([5]);
  });
});
