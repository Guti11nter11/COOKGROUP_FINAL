import { describe, it, expect } from "vitest";
import fixture from "./fixtures/tm-events.json";
import { normalizeTmEvent, type Show } from "../src/ticketmaster";
import { detectAlerts } from "../src/changes";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const raw = fixture._embedded.events as any[];
const base = normalizeTmEvent(raw[0])!;
const vip = normalizeTmEvent(raw[1])!;
const ctx = { bootstrap: false, knownDatesInCountry: 0, artistName: "U2", tier: 3 as const };
const clone = (s: Show): Show => structuredClone(s);

describe("detectAlerts: fechas nuevas", () => {
  it("primer barrido del artista (arranque) → sin avisos", () =>
    expect(detectAlerts(null, base, { ...ctx, bootstrap: true })).toEqual([]));

  it("fecha nueva sin otras en el país → new_event", () => {
    const [a, ...rest] = detectAlerts(null, base, ctx);
    expect(rest).toEqual([]);
    expect(a).toMatchObject({ kind: "new_event", sourceId: base.sourceId, artistName: "U2", tier: 3, showKey: "K8vZ91712W7:Z698xZu0Za7F7:2027-06-12" });
  });

  it("fecha nueva con otras ya conocidas en el país → extra_date", () =>
    expect(detectAlerts(null, base, { ...ctx, knownDatesInCountry: 2 }).map((a) => a.kind)).toEqual(["extra_date"]));

  it("paquete VIP nuevo de una fecha → sin avisos (no es fecha extra)", () =>
    expect(detectAlerts(null, vip, { ...ctx, knownDatesInCountry: 2 })).toEqual([]));
});

describe("detectAlerts: cambios", () => {
  it("cancelación → status_changed con antes/después", () => {
    const next = clone(base);
    next.status = "cancelled";
    const [a] = detectAlerts(base, next, ctx);
    expect(a).toMatchObject({ kind: "status_changed", detail: { before: "onsale", after: "cancelled" } });
  });

  it("preventa nueva → sale_added con su hora de inicio", () => {
    const prev = clone(base);
    prev.sales = prev.sales.filter((s) => s.kind !== "telco");
    const [a, ...rest] = detectAlerts(prev, base, ctx);
    expect(rest).toEqual([]);
    expect(a).toMatchObject({ kind: "sale_added", startsAt: "2026-11-11T09:00:00Z", detail: { label: "Priority from O2", kind: "telco" } });
  });

  it("misma preventa con otra hora → sale_changed en hora de Madrid", () => {
    const next = clone(base);
    next.sales.find((s) => s.kind === "telco")!.startsAt = "2026-11-11T09:00:00Z";
    const prev = clone(base);
    prev.sales.find((s) => s.kind === "telco")!.startsAt = "2026-11-11T08:00:00Z";
    const [a] = detectAlerts(prev, next, ctx);
    expect(a).toMatchObject({ kind: "sale_changed", detail: { label: "Priority from O2", before: "09:00", after: "10:00" } });
  });

  it("sin cambios → sin avisos", () => expect(detectAlerts(base, clone(base), ctx)).toEqual([]));

  it("el mismo cambio produce la misma clave de deduplicación; otro cambio, otra clave", () => {
    const next = clone(base);
    next.status = "cancelled";
    const k1 = detectAlerts(base, next, ctx)[0]!.dedupeKey;
    expect(detectAlerts(base, clone(next), ctx)[0]!.dedupeKey).toBe(k1);
    const next2 = clone(base);
    next2.status = "postponed";
    expect(detectAlerts(base, next2, ctx)[0]!.dedupeKey).not.toBe(k1);
  });
});
