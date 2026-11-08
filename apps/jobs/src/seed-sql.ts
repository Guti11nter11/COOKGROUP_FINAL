export interface ResolvedArtist {
  name: string;
  tier: 1 | 2 | 3;
  tmAttractionId: string | null;
  mbid: string | null;
  deezerId: number | null;
  deezerFans: number | null;
}

const q = (v: string | null) => (v === null ? "NULL" : `'${v.replace(/'/g, "''")}'`);
const n = (v: number | null) => (v === null ? "NULL" : String(Math.trunc(v)));

/**
 * SQL idempotente para cargar los artistas seguidos en D1. Actualiza nombre e IDs externos,
 * y solo sube el nivel (follow), nunca lo baja. Las filas sin cambios no se reescriben (cada fila
 * escrita cuenta para el cupo diario de D1).
 */
export function buildSeedSql(artists: ResolvedArtist[]): string {
  const lines: string[] = [];
  for (const a of artists) {
    if (!a.tmAttractionId) continue;
    const id = `a_${a.tmAttractionId}`;
    lines.push(
      `INSERT INTO artist (id, name, tm_attraction_id, mbid, deezer_id, deezer_fans) VALUES (${q(id)}, ${q(a.name)}, ${q(a.tmAttractionId)}, ${q(a.mbid)}, ${n(a.deezerId)}, ${n(a.deezerFans)}) ON CONFLICT (id) DO UPDATE SET name = excluded.name, mbid = excluded.mbid, deezer_id = excluded.deezer_id, deezer_fans = excluded.deezer_fans WHERE artist.name IS NOT excluded.name OR artist.mbid IS NOT excluded.mbid OR artist.deezer_id IS NOT excluded.deezer_id OR artist.deezer_fans IS NOT excluded.deezer_fans;`,
      `INSERT INTO follow (artist_id, tier) VALUES (${q(id)}, ${a.tier}) ON CONFLICT (artist_id) DO UPDATE SET tier = excluded.tier WHERE excluded.tier > follow.tier;`,
    );
  }
  return lines.join("\n") + "\n";
}
