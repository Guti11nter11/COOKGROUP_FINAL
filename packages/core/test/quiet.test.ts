import { describe, it, expect } from "vitest";
import { isQuietTime, decideDelivery } from "../src/quiet";

describe("isQuietTime (01:00–08:00 Europe/Madrid)", () => {
  it.each([
    ["2026-11-07T23:59:00Z", false], // 00:59 Madrid
    ["2026-11-08T00:00:00Z", true], // 01:00
    ["2026-11-08T06:59:00Z", true], // 07:59
    ["2026-11-08T07:00:00Z", false], // 08:00
    ["2027-06-30T23:00:00Z", true], // 01:00 en verano
  ])("isQuietTime(%s) = %s", (iso, q) => expect(isQuietTime(new Date(iso))).toBe(q));
});

describe("decideDelivery", () => {
  const night = new Date("2026-11-08T02:12:00Z"); // 03:12 Madrid
  it("fecha extra de noche → now", () => expect(decideDelivery({ kind: "extra_date" }, night)).toBe("now"));
  it("venta en 47 min de noche → now", () =>
    expect(decideDelivery({ kind: "sale_soon", startsAt: "2026-11-08T02:59:00Z" }, night)).toBe("now"));
  it("venta en 3 h de noche → silent", () =>
    expect(decideDelivery({ kind: "sale_soon", startsAt: "2026-11-08T05:12:00Z" }, night)).toBe("silent"));
  it("sala de espera abierta de noche → now", () =>
    expect(decideDelivery({ kind: "waiting_room" }, night)).toBe("now"));
  it("preventa recién publicada que empieza en 30 min, de noche → now", () =>
    expect(decideDelivery({ kind: "sale_added", startsAt: "2026-11-08T02:42:00Z" }, night)).toBe("now"));
  it("venta que ya empezó no despierta → silent", () =>
    expect(decideDelivery({ kind: "sale_soon", startsAt: "2026-11-08T02:00:00Z" }, night)).toBe("silent"));
  it("gira nueva de noche → silent", () => expect(decideDelivery({ kind: "new_event" }, night)).toBe("silent"));
  it("gira nueva de día → now", () =>
    expect(decideDelivery({ kind: "new_event" }, new Date("2026-11-08T12:00:00Z"))).toBe("now"));
});
