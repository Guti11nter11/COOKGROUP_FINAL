/**
 * Reventa (solo informativa): estadística robusta de precios pedidos en Viagogo/StubHub y un modelo
 * propio de demanda. Son precios *pedidos*, no ventas: se filtran anuncios absurdos con IQR.
 */
import type { ResaleInfo } from "./sheet";

export interface Stats {
  median: number;
  p25: number;
  p75: number;
  n: number;
}

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo);
}

/** Mediana y P25–P75 tras descartar valores fuera de 3×IQR (sin tope fijo: una final puede valer 10.000 €). */
export function robustStats(values: number[]): Stats | null {
  const xs = values.filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
  if (xs.length < 5) return null;
  const q1 = quantile(xs, 0.25);
  const q3 = quantile(xs, 0.75);
  const iqr = q3 - q1;
  const kept = xs.filter((v) => v >= q1 - 3 * iqr && v <= q3 + 3 * iqr);
  return { median: quantile(kept, 0.5), p25: quantile(kept, 0.25), p75: quantile(kept, 0.75), n: kept.length };
}

export interface DemandSignals {
  tier: number;
  /** Ticketmaster la marca como evento de alta demanda. */
  hot: boolean;
  dates: number;
  countries: number;
  /** Multiplicadores observados (mediana de reventa / precio oficial medio), por mercado. */
  observed: number[];
  /** Anuncios usados en total. */
  listings: number;
  /** Fechas con mercado leído aunque falte el precio oficial para comparar. */
  marketsWithoutFace?: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Rango estimado de reventa sobre el precio oficial, con nivel de confianza y explicación. */
export function estimateResale(s: DemandSignals): Pick<ResaleInfo, "low" | "high" | "confidence" | "basis"> {
  if (s.observed.length) {
    const m = s.observed.slice().sort((a, b) => a - b)[Math.floor(s.observed.length / 2)]!;
    const low = Math.max(1, round1(m * 0.8));
    const high = Math.max(low + 0.1, round1(m * 1.25));
    const confidence = s.observed.length >= 2 && s.listings >= 40 ? "alta" : "media";
    return {
      low,
      high,
      confidence,
      basis: `Mercado real: ${s.listings} anuncios en ${s.observed.length} ${s.observed.length === 1 ? "fecha" : "fechas"} comparados con el precio oficial (son precios pedidos, no ventas)`,
    };
  }
  let [low, high] = s.tier >= 3 ? [1.6, 2.8] : s.tier === 2 ? [1.3, 2.0] : [1.1, 1.6];
  const why: string[] = [s.tier >= 3 ? "artista ⭐⭐⭐" : s.tier === 2 ? "artista ⭐⭐" : "artista ⭐"];
  if (s.hot) {
    low *= 1.25;
    high *= 1.3;
    why.push("Ticketmaster la marca como alta demanda");
  }
  if (s.dates / Math.max(1, s.countries) > 3) {
    low *= 0.9;
    high *= 0.9;
    why.push(`${s.dates} fechas (más oferta)`);
  } else if (s.dates <= 2) {
    low *= 1.1;
    high *= 1.15;
    why.push(`solo ${s.dates} ${s.dates === 1 ? "fecha" : "fechas"}`);
  }
  const basis = s.marketsWithoutFace
    ? `Modelo GIRA (${why.join(", ")}); hay ${s.listings} anuncios de reventa abajo, pero falta el precio oficial para calcular el multiplicador real`
    : `Modelo GIRA sin datos de mercado todavía: ${why.join(", ")}`;
  return { low: round1(low), high: round1(high), confidence: "baja", basis };
}
