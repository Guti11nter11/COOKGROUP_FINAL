import { describe, expect, it } from "vitest";
import { remindersDue, renderDigest, renderReminder, renderWeek, slotKey, toIcs, type SaleSlot } from "../src/calendar";

const slot: SaleSlot = {
  artistId: "a1", artist: "U2", channelId: "CH", label: "Artist Presale", startsAt: "2026-11-10T09:00:00Z",
  dates: [{ city: "Barcelona", country: "ES", localDate: "2027-05-13", url: "https://tm.example/2" }, { city: "Sevilla", country: "ES", localDate: "2027-05-27", url: "https://tm.example/1" }],
};

describe("recordatorios", () => {
  it("24 h antes → el de mañana", () => {
    const due = remindersDue([slot], new Set(), new Date("2026-11-09T09:30:00Z"));
    expect(due.map((d) => d.reminder.key)).toEqual(["24h"]);
  });
  it("a 8 minutos y sin enviar nada antes → solo el de 10 min (los demás se dan por enviados)", () => {
    const [d] = remindersDue([slot], new Set(), new Date("2026-11-10T08:52:00Z"));
    expect(d!.reminder.key).toBe("10m");
    expect(d!.skip).toEqual([`${slotKey(slot)}|24h`, `${slotKey(slot)}|1h`]);
  });
  it("ya enviado o ya empezada → nada", () => {
    expect(remindersDue([slot], new Set([`${slotKey(slot)}|1h`]), new Date("2026-11-10T08:30:00Z"))).toEqual([]);
    expect(remindersDue([slot], new Set(), new Date("2026-11-10T09:01:00Z"))).toEqual([]);
  });
  it("texto con hora de Madrid y Londres y el canal", () =>
    expect(renderReminder(slot, "en 1 hora")).toContain("⏰ **U2** · Artist Presale en 1 hora — **10:00** Madrid · 09:00 Londres"));
});

describe("resúmenes y calendario", () => {
  const now = new Date("2026-11-09T20:00:00Z");
  it("resumen de la noche con novedades y ventas de 48 h", () => {
    const d = renderDigest([slot], [{ artist: "Jamiroquai", text: "gira europea 2027", channelId: "J" }], now, "21:00").join("\n");
    expect(d).toContain("🌙 Resumen de la noche");
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
