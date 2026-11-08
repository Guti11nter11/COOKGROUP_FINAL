/** Cuenta oficial de Instagram de un artista a partir de las relaciones de MusicBrainz. Pura. */
export function instagramHandle(relations: { type?: string; ended?: boolean; url?: { resource?: string } }[]): string | null {
  for (const r of relations) {
    if (r.ended) continue;
    const m = /^https?:\/\/(?:www\.)?instagram\.com\/([A-Za-z0-9._]{1,30})\/?$/.exec(r.url?.resource ?? "");
    if (m && !["p", "explore", "reel", "stories"].includes(m[1]!.toLowerCase())) return m[1]!;
  }
  return null;
}
