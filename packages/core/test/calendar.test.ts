import { describe, expect, it } from "vitest";
import { remindersDue, renderDigest, renderReminder, renderWeek, slotKey, toIcs, type SaleSlot } from "../src/calendar";

const slot: SaleSlot = {
  artistId: "a1", artist: "U2", channelId: "CH", label: "Artist Presale", startsAt: "2026-11-10T09:00:00Z",
  dates: [{ city: "Barcelona", country: "ES", localDate: "2027-05-13", url: "https://tm.example/2" }, { city: "Sevilla", country: "ES", localDate: "2027-05-27", url: "https://tm.example/1" }],
};

describe("recordatorios", () => {
  it("24 h antes → nada (lo cubren los resúmenes); 1 h antes → el de 1 h", () => {
    expect(remindersDue([slot], new Set(), new Date("2026-11-09T09:30:00Z"))).toEqual([]);
    expect(remindersDue([slot], new Set(), new Date("2026-11-10T08:05:00Z")).map((d) => d.reminder.key)).toEqual(["1h"]);
  });
  it("a 8 minutos y sin enviar nada antes → solo el de 10 min (los demás se dan por enviados)", () => {
    const [d] = remindersDue([slot], new Set(), new Date("2026-11-10T08:52:00Z"));
    expect(d!.reminder.key).toBe("10m");
    expect(d!.skip).toEqual([`${slotKey(slot)}|1h`]);
  });
  it("ya enviado o ya empezada → nada", () => {
    expect(remindersDue([slot], new Set([`${slotKey(slot)}|1h`]), new Date("2026-11-10T08:30:00Z"))).toEqual([]);
    expect(remindersDue([slot], new Set(), new Date("2026-11-10T09:01:00Z"))).toEqual([]);
  });
  it("un mensaje para todas las ventas de la misma hora, una línea por artista", () => {
    const raye = { ...slot, artistId: "a2", artist: "RAYE", channelId: "R", label: "MCD Presale", dates: [{ city: "Dublin", country: "IE", localDate: "2027-06-24", url: "u" }] };
    expect(renderReminder([{ slot, labels: ["Artist Presale"] }, { slot: raye, labels: ["MCD Presale", "Live Nation Presale"] }], "en 1 hora")).toBe(
      `⏰ **En 1 hora** · <t:${Date.parse(slot.startsAt) / 1000}:F>\n• **U2** · Artist Presale · 🇪🇸 Barcelona, 🇪🇸 Sevilla → <#CH>\n• **RAYE** · MCD Presale · Live Nation Presale · 🇮🇪 Dublin → <#R>`,
    );
  });
});

describe("resúmenes y calendario", () => {
  const now = new Date("2026-11-09T20:00:00Z");
  it("resumen de la noche con novedades y ventas de 48 h", () => {
    const d = renderDigest([slot], [{ artist: "Jamiroquai", text: "gira europea 2027", channelId: "J" }], now).join("\n");
    expect(d).toContain("🌙 Resumen del día");
    expect(d).toContain("• **Jamiroquai** · gira europea 2027 → <#J>");
    expect(d).toContain("`10:00` **U2** · Artist Presale · 🇪🇸 Barcelona, 🇪🇸 Sevilla → <#CH>");
  });
  it("esta semana", () => expect(renderWeek([slot], now).join("\n")).toContain("martes, 10 de noviembre"));
  it(".ics válido con aviso 10 min antes", () => {
    const ics = toIcs([slot], now);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("DTSTART:20261110T090000Z");
    expect(ics).toContain("TRIGGER:-PT10M");
    expect(ics.split("\r\n").every((l) => l.length <= 75)).toBe(true);
  });
});

describe("esta semana: un día largo se ve igual que uno corto", () => {
  it("sin líneas en blanco entre las ventas de un mismo día", () => {
    const many = Array.from({ length: 40 }, (_, i) => ({
      artistId: `a${i}`, artist: `Artista número ${i} con nombre largo`, channelId: "C", label: "Live Nation Presale",
      startsAt: "2026-11-11T09:00:00Z", dates: [{ city: "Ciudad", country: "US", localDate: "2027-07-01", url: "u" }],
    }));
    const msgs = renderWeek(many, new Date("2026-11-09T12:00:00Z"));
    expect(msgs.length).toBeGreaterThan(1);
    for (const m of msgs) expect(m).not.toMatch(/\*\*Artista número \d+[^\n]*\n\n`/);
    expect(msgs.every((m) => m.length <= 1900)).toBe(true);
  });
});

describe("una línea por artista y día", () => {
  it("junta las ventas de la misma hora y añade las de otra hora en la misma línea", async () => {
    const { artistLines } = await import("../src/calendar");
    const mk = (label: string, at: string, city: string, cc = "DE") => ({ artistId: "nk", artist: "Noah Kahan", channelId: "NK", label, startsAt: at, dates: [{ city, country: cc, localDate: "2027-07-02", url: `u-${city}` }] });
    const lines = artistLines([
      mk("Artist Presale", "2026-11-10T11:00:00Z", "Berlin"),
      mk("Telekom Prio Tickets", "2026-11-10T11:00:00Z", "Berlin"),
      mk("Venta general", "2026-11-10T17:00:00Z", "Tampa", "US"),
      { artistId: "u2", artist: "U2", channelId: "U2", label: "Venta general", startsAt: "2026-11-10T09:00:00Z", dates: [{ city: "Milano", country: "IT", localDate: "2027-07-09", url: "m" }] },
    ]);
    expect(lines).toEqual([
      "`10:00` **U2** · Venta general · 🇮🇹 Milano → <#U2>",
      "`12:00` **Noah Kahan** · Artist Presale · Telekom Prio Tickets · 🇩🇪 Berlin — `18:00` Venta general · 🇺🇸 Tampa → <#NK>",
    ]);
  });
});
