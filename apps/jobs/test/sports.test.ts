import { describe, expect, it } from "vitest";
import { addedLines, relevantLines, robotsAllows } from "../src/sports-lib";

describe("webs de entradas de deporte", () => {
  it("se queda con las líneas de entradas y fechas", () => {
    const html = `<nav><a>Inicio</a><a>Tienda</a></nav><h2>Entradas Champions League</h2><p>Venta para socios: 12 de noviembre a las 10:00</p><script>var x="entradas"</script><p>Ver más</p>`;
    expect(relevantLines(html)).toEqual(["Entradas Champions League", "Venta para socios: 12 de noviembre a las 10:00"]);
  });
  it("detecta lo añadido", () => expect(addedLines(["Entradas Champions League"], ["Entradas Champions League", "Public ballot opens 3 December 2026"])).toEqual(["Public ballot opens 3 December 2026"]));
  it("robots.txt", () => {
    const r = "User-agent: Googlebot\nDisallow: /\n\nUser-agent: *\nDisallow: /private\nAllow: /private/tickets\n";
    expect(robotsAllows(r, "/es-ES/entradas")).toBe(true);
    expect(robotsAllows(r, "/private/x")).toBe(false);
    expect(robotsAllows(r, "/private/tickets/2027")).toBe(true);
    expect(robotsAllows("User-agent: *\nDisallow: /", "/tickets")).toBe(false);
  });
});
