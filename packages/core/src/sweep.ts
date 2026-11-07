export interface Follow {
  artistId: string;
  name: string;
  tier: 1 | 2 | 3;
  tmAttractionId: string;
}

const FULL_SWEEP_EVERY_MIN = 20;
const CRON_EVERY_MIN = 5;

/**
 * Lotes de attractionId para este ciclo del cron. Los ⭐⭐⭐ van en cada ciclo; todos los
 * seguidos, cuando empieza un barrido completo (cada 20 min).
 */
export function planSweep(follows: Follow[], nowUtc: Date, batchSize = 20): string[][] {
  const minuteOfDay = nowUtc.getUTCHours() * 60 + nowUtc.getUTCMinutes();
  const full = minuteOfDay % FULL_SWEEP_EVERY_MIN < CRON_EVERY_MIN;
  const ids = [...new Set(follows.filter((f) => f.tmAttractionId && (full || f.tier === 3)).map((f) => f.tmAttractionId))];
  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += batchSize) batches.push(ids.slice(i, i + batchSize));
  return batches;
}
