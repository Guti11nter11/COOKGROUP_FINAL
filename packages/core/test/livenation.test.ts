import { describe, expect, it } from "vitest";
import { LN_EVENT_URL, parseLnEvent, withExtraSales } from "../src/livenation";
import type { Show } from "../src/ticketmaster";

// Fragmento con la forma de una página de evento de Live Nation (datos de ejemplo, JSON escapado).
const PAGE = [
  '<a href="/event/u2-world-tour-barcelona-tickets-edp1001">x</a><a href="/event/u2-world-tour-sevilla-tickets-edp1002">y</a>',
  String.raw`\"type\":\"Preventa Registrados LiveNation.es\",\"typeId\":13,\"ticketStatus\":1,\"ticketUrl\":\"https://www.ticketmaster.es/event/1271385480?subchannel_id=1&brand=es\",\"validFromUtc\":\"2026-11-12T09:00:00Z\",\"validToUtc\":\"2026-11-12T21:00:00Z\"`,
  String.raw`\"type\":\"Preventa Live Nation - S.SMusic VIP Tickets\",\"typeId\":406,\"ticketStatus\":1,\"ticketUrl\":\"https://www.ticketmaster.es/event/1271385480\",\"validFromUtc\":\"2026-11-11T09:00:00Z\",\"validToUtc\":\"2026-11-12T08:00:00Z\"`,
  String.raw`\"type\":\"A la venta - general\",\"typeId\":2,\"ticketStatus\":1,\"ticketUrl\":\"\",\"validFromUtc\":\"2026-11-13T09:00:00Z\",\"validToUtc\":\"2027-05-13T21:00:00Z\"`,
].join("");

describe("páginas de evento de Live Nation", () => {
  it("saca las preventas con su hora y el evento de Ticketmaster; fuera VIP y venta general; enlaza las otras fechas", () => {
    const r = parseLnEvent(PAGE, "https://www.livenation.es/event/u2-world-tour-barcelona-tickets-edp1001");
    expect(r.sales).toEqual([{ label: "Preventa Registrados LiveNation.es", startsAt: "2026-11-12T09:00:00.000Z", tmEventId: "1271385480" }]);
    expect(r.siblings).toEqual(["https://www.livenation.es/event/u2-world-tour-sevilla-tickets-edp1002"]);
    expect(r.lastDate).toBe("2027-05-13T21:00:00Z");
  });
  it("solo acepta enlaces de evento de Live Nation", () => {
    expect(LN_EVENT_URL.test("https://www.livenation.es/event/u2-the-greatest-show-on-earth-world-tour-sevilla-tickets-edp1708683")).toBe(true);
    expect(LN_EVENT_URL.test("https://www.livenation.es/search?query=U2")).toBe(false);
  });
  it("une la preventa a la fecha sin repetirla", () => {
    const show = { sales: [{ kind: "general", label: "Venta general", startsAt: "2026-11-13T09:00:00Z", endsAt: null, url: null, orderRank: 90 }] } as unknown as Show;
    const extra = [{ label: "Preventa Registrados LiveNation.es", startsAt: "2026-11-12T09:00:00.000Z", url: "https://www.livenation.es/event/x-edp1" }];
    const s = withExtraSales(withExtraSales(show, extra), extra);
    expect(s.sales.map((w) => `${w.kind}|${w.label}`)).toEqual(["general|Venta general", "promoter|Preventa Registrados LiveNation.es"]);
  });
});
