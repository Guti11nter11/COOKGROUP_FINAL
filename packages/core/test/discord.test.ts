import { describe, it, expect } from "vitest";
import fixture from "./fixtures/tm-events.json";
import { normalizeTmEvent } from "../src/ticketmaster";
import { detectAlerts } from "../src/changes";
import { LAYOUT, planGuildLayout, channelFor, renderAlertMessage } from "../src/discord";

const CAT = 4;

describe("planGuildLayout", () => {
  it("servidor vacío → crea todas las categorías y canales del layout", () => {
    const ops = planGuildLayout([], true);
    const cats = ops.filter((o) => o.op === "create_category").map((o) => o.name);
    expect(cats).toEqual(LAYOUT.map((c) => c.name));
    expect(cats).toHaveLength(9);
    const chans = ops.filter((o) => o.op === "create_channel");
    expect(chans).toHaveLength(LAYOUT.flatMap((c) => c.channels).length);
  });

  it("no repite lo que ya existe", () => {
    const existing = [
      { id: "1", name: "📌 INICIO", type: CAT, parent_id: null },
      { id: "2", name: "bienvenida", type: 0, parent_id: "1" },
    ];
    const ops = planGuildLayout(existing, true);
    expect(ops.some((o) => o.name === "📌 INICIO")).toBe(false);
    expect(ops.some((o) => o.op === "create_channel" && o.name === "bienvenida")).toBe(false);
    expect(ops.some((o) => o.op === "create_channel" && o.name === "estado" && o.parent === "📌 INICIO")).toBe(true);
  });

  it("no toca canales ajenos ni devuelve borrados", () => {
    const ops = planGuildLayout([{ id: "9", name: "charla", type: 0, parent_id: null }], true);
    expect(ops.some((o) => o.name === "charla")).toBe(false);
    expect(ops.every((o) => o.op === "create_category" || o.op === "create_channel")).toBe(true);
  });

  it("con Comunidad: fichas es foro y daily-release es de anuncios", () => {
    const ops = planGuildLayout([], true);
    expect(ops.find((o) => o.name === "fichas")).toMatchObject({ type: 15, parent: "🎤 GIRAS" });
    expect(ops.find((o) => o.name === "daily-release")).toMatchObject({ type: 5 });
  });

  it("sin Comunidad: fichas y daily-release son de texto", () => {
    const ops = planGuildLayout([], false);
    expect(ops.find((o) => o.name === "fichas")).toMatchObject({ type: 0 });
    expect(ops.find((o) => o.name === "daily-release")).toMatchObject({ type: 0 });
  });

  it("incluye ARCHIVO y nunca un canal por artista (lista cerrada)", () => {
    const names = planGuildLayout([], true).map((o) => o.name);
    expect(names).toContain("📦 ARCHIVO");
    expect(names).toContain("archivo");
    expect(names).not.toContain("u2");
  });
});

describe("channelFor", () => {
  it.each([
    ["new_event", "nuevas-giras"],
    ["status_changed", "nuevas-giras"],
    ["extra_date", "fechas-extra"],
    ["sale_added", "preventas"],
    ["sale_changed", "preventas"],
    ["sale_soon", "preventas"],
  ] as const)("%s → #%s", (k, c) => expect(channelFor(k)).toBe(c));
});

describe("renderAlertMessage", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const show = normalizeTmEvent((fixture._embedded.events as any[])[0])!;
  const alert = detectAlerts(null, show, { bootstrap: false, knownDatesInCountry: 0, artistName: "U2", tier: 3 })[0]!;
  const day = new Date("2026-11-08T12:00:00Z");

  it("muestra horas de Madrid y Londres, marca de tiempo de Discord y enlace oficial", () => {
    const text = JSON.stringify(renderAlertMessage(alert, show, day));
    expect(text).toContain("Madrid 09:00 · Londres 08:00");
    expect(text).toContain(`<t:${Date.parse("2026-11-10T08:00:00Z") / 1000}:F>`);
    expect(text).toContain(show.url);
    expect(text).toContain("U2");
  });

  it("lista las preventas en orden", () => {
    const text = JSON.stringify(renderAlertMessage(alert, show, day));
    expect(text.indexOf("Artist Presale")).toBeLessThan(text.indexOf("Priority from O2"));
    expect(text.indexOf("Priority from O2")).toBeLessThan(text.indexOf("Venta general"));
  });

  it("de noche y no urgente → mensaje silencioso (flags 4096); de día → normal", () => {
    expect(renderAlertMessage(alert, show, new Date("2026-11-08T02:12:00Z")).flags).toBe(4096);
    expect(renderAlertMessage(alert, show, day).flags).toBeUndefined();
  });
});
