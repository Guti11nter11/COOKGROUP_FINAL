export interface Follow {
  artistId: string;
  name: string;
  tier: 1 | 2 | 3;
  tmAttractionId: string;
}

/**
 * Lotes de attractionId para este ciclo del cron (cada 5 min): solo los ⭐⭐⭐. El resto de
 * entidades (⭐⭐ y ⭐, ~1.000) las cubre el Discovery Feed cada hora; así la API de Ticketmaster
 * (5.000/día) y las colas de Cloudflare (10.000 operaciones/día) quedan holgadas.
 */
export function planSweep(follows: Follow[], _nowUtc: Date, batchSize = 20): string[][] {
  const ids = [...new Set(follows.filter((f) => f.tmAttractionId && f.tier === 3).map((f) => f.tmAttractionId))];
  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += batchSize) batches.push(ids.slice(i, i + batchSize));
  return batches;
}
