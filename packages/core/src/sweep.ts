export interface Follow {
  artistId: string;
  name: string;
  tier: 1 | 2 | 3;
  tmAttractionId: string;
}

const FULL_SWEEP_EVERY_MIN = 20;
const CRON_EVERY_MIN = 5;

/**
 * Lotes de attractionId para este ciclo del cron. Los ⭐⭐⭐ van en cada ciclo; los ⭐⭐,
 * cada 20 min. Los ⭐ no van por la API: los cubre el Discovery Feed cada hora.
 */
export function planSweep(follows: Follow[], nowUtc: Date, batchSize = 20): string[][] {
  const minuteOfDay = nowUtc.getUTCHours() * 60 + nowUtc.getUTCMinutes();
  const full = minuteOfDay % FULL_SWEEP_EVERY_MIN < CRON_EVERY_MIN;
  const ids = [...new Set(follows.filter((f) => f.tmAttractionId && (f.tier === 3 || (full && f.tier === 2))).map((f) => f.tmAttractionId))];
  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += batchSize) batches.push(ids.slice(i, i + batchSize));
  return batches;
}
