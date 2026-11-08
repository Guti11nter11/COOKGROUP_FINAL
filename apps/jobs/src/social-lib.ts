/** Cuenta oficial de Instagram de un artista a partir de las relaciones de MusicBrainz. Pura. */
export function instagramHandle(relations: { type?: string; ended?: boolean; url?: { resource?: string } }[]): string | null {
  for (const r of relations) {
    if (r.ended) continue;
    const m = /^https?:\/\/(?:www\.)?instagram\.com\/([A-Za-z0-9._]{1,30})\/?$/.exec(r.url?.resource ?? "");
    if (m && !["p", "explore", "reel", "stories"].includes(m[1]!.toLowerCase())) return m[1]!;
  }
  return null;
}

const fold = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const STOP = new Set(["the", "los", "las", "and", "les", "der", "die", "das", "del", "con", "feat", "tour", "live"]);
const words = (t: string) => fold(t).split(" ").filter((w) => w.length >= 3 && !STOP.has(w));

/**
 * ¿Lo que devolvió la IA corresponde de verdad a esa publicación? Evita índices cruzados (un aviso de
 * Blueticket atribuido a la cuenta de Metallica). Cuenta de artista: el resultado es del propio artista.
 * Ticketera: el artista nombrado aparece en el texto (basta una palabra significativa). Pura.
 */
export function itemConsistent(item: { artist: string }, caption: string, account: { name: string; artist?: boolean } | undefined): boolean {
  const said = fold(item.artist);
  if (!said) return false;
  if (account?.artist) {
    const own = fold(account.name);
    return said.includes(own) || own.includes(said);
  }
  const text = ` ${fold(caption)} `;
  const ws = words(item.artist);
  return ws.length ? ws.some((w) => text.includes(` ${w} `)) : text.includes(` ${said} `);
}
