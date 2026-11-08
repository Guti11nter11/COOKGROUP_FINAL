import type { EnrichInput, EnrichTodo } from "@gira/core";
import { consensus, LIMIT_QUERY, limitFromText } from "./limits-lib";
import { articleText, searchNews } from "./news";

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
const fold = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Límite de entradas por persona de las fichas activas, donde la ticketera no lo publica: prensa del
 * país (en su idioma), solo artículos que nombran al artista, y el valor en que coinciden las fuentes.
 */
export async function findLimits(artists: EnrichTodo["artists"], maxGroups = 12): Promise<NonNullable<EnrichInput["limits"]>> {
  const out: NonNullable<EnrichInput["limits"]> = [];
  const groups = [...artists]
    .sort((a, b) => b.tier - a.tier)
    .flatMap((a) => (a.limitCountries ?? []).map((cc) => ({ a, cc })))
    .slice(0, maxGroups);
  for (const { a, cc } of groups) {
    try {
      const items = (await searchNews(`"${a.name}" ${LIMIT_QUERY[cc] ?? LIMIT_QUERY.GB}`, cc)).slice(0, 6);
      const found: number[] = [];
      for (const it of items) {
        const head = `${it.title}. ${it.description}`;
        const body = (await articleText(it.link)) ?? "";
        if (!fold(`${head} ${body}`).includes(fold(a.name))) continue;
        const n = limitFromText(head) ?? limitFromText(body);
        if (n) found.push(n);
        await pause(300);
      }
      const n = consensus(found);
      if (n) out.push({ artistId: a.artistId, country: cc, limit: n });
      console.log(`${n ? "✓" : "·"} ${a.name} (${cc}): ${n ? `${n} por persona (${found.length} fuentes)` : "sin dato en prensa"}`);
    } catch (e) {
      console.log(`⚠️ ${a.name} (${cc}): ${String(e)}`);
    }
    await pause(1000);
  }
  // Sin dato en ningún país: búsqueda general de la gira (inglés y español). Se guarda como límite
  // general ("ZZ"), que la ficha usa en los países sin dato propio.
  const done = new Set(out.map((o) => o.artistId));
  const general = [...artists].filter((a) => (a.limitCountries?.length ?? 0) > 0 && a.limitCountries!.length === a.countries.length && !done.has(a.artistId)).slice(0, 6);
  for (const a of general) {
    const found: number[] = [];
    for (const [q, cc] of [
      [`"${a.name}" tour tickets "per person" limit`, "GB"],
      [`"${a.name}" ticket limit 2027 tour`, "US"],
      [`"${a.name}" entradas "por persona" máximo gira`, "ES"],
    ] as const) {
      try {
        for (const it of (await searchNews(q, cc)).slice(0, 5)) {
          const head = `${it.title}. ${it.description}`;
          const body = (await articleText(it.link)) ?? "";
          if (!fold(`${head} ${body}`).includes(fold(a.name))) continue;
          const n = limitFromText(head) ?? limitFromText(body);
          if (n) found.push(n);
          await pause(300);
        }
      } catch {
        /* fuente caída: se sigue con la siguiente */
      }
      await pause(800);
    }
    const n = consensus(found);
    if (n) out.push({ artistId: a.artistId, country: "ZZ", limit: n });
    console.log(`${n ? "✓" : "·"} ${a.name} (gira): ${n ? `${n} por persona (${found.length} fuentes)` : "sin dato en prensa"}`);
  }
  return out;
}
