import type { EnrichInput, EnrichTodo } from "@gira/core";
import { getJson } from "./gira-client";
import { capacityFromWikitext, COUNTRY_LANG, pickVenue, tokens, type WdEntity } from "./venues-lib";

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Ids de Wikidata de los primeros resultados de búsqueda en una Wikipedia. */
async function searchWikipedia(lang: string, q: string): Promise<string[]> {
  const url = `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&generator=search&gsrlimit=4&prop=pageprops&ppprop=wikibase_item&gsrsearch=${encodeURIComponent(q)}`;
  const data = await getJson<{ query?: { pages?: Record<string, { index: number; pageprops?: { wikibase_item?: string } }> } }>(url);
  return Object.values(data?.query?.pages ?? {})
    .sort((a, b) => a.index - b.index)
    .map((p) => p.pageprops?.wikibase_item)
    .filter((x): x is string => !!x);
}

async function entities(ids: string[]): Promise<WdEntity[]> {
  if (!ids.length) return [];
  const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=labels|aliases|claims&ids=${ids.join("|")}`;
  const data = await getJson<{ entities?: Record<string, WdEntity> }>(url);
  return ids.map((id) => data?.entities?.[id]).filter((e): e is WdEntity => !!e && !!e.claims);
}

/** Respaldo: cuadro de datos del primer artículo de la Wikipedia inglesa cuyo título comparte una palabra distintiva. */
async function fromInfobox(v: EnrichTodo["venues"][number]): Promise<{ id: string; capacity: number } | null> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&list=search&srlimit=3&srsearch=${encodeURIComponent(`${v.name} ${v.city}`)}`;
  const data = await getJson<{ query?: { search?: { title: string }[] } }>(url);
  const mine = new Set(tokens(v.name));
  const title = data?.query?.search?.map((s) => s.title).find((t) => tokens(t).some((w) => mine.has(w)));
  if (!title) return null;
  const page = await getJson<{ parse?: { wikitext?: { "*": string } } }>(
    `https://en.wikipedia.org/w/api.php?action=parse&format=json&prop=wikitext&section=0&page=${encodeURIComponent(title)}`,
  );
  const capacity = capacityFromWikitext(page?.parse?.wikitext?.["*"] ?? "");
  return capacity ? { id: `enwiki:${title}`, capacity } : null;
}

/** Busca el aforo de cada recinto en Wikipedia (inglesa y local) → Wikidata. */
export async function findCapacities(venues: EnrichTodo["venues"], max = 60): Promise<NonNullable<EnrichInput["venues"]>> {
  const out: NonNullable<EnrichInput["venues"]> = [];
  for (const v of venues.slice(0, max)) {
    const langs = [...new Set(["en", COUNTRY_LANG[v.country]].filter((l): l is string => !!l))];
    const ids: string[] = [];
    for (const lang of langs) {
      for (const q of [`${v.name} ${v.city}`, v.name]) {
        for (const id of await searchWikipedia(lang, q)) if (!ids.includes(id)) ids.push(id);
        await pause(250);
      }
    }
    const hit = pickVenue(await entities(ids.slice(0, 12)), v) ?? (await fromInfobox(v));
    out.push({ tmId: v.tmId, name: v.name, city: v.city, country: v.country, capacity: hit?.capacity ?? null, wikidataId: hit?.id ?? null, ...(hit ? { source: hit.id.startsWith("enwiki:") ? "Wikipedia" : "Wikidata" } : {}) });
    console.log(`${hit ? "✓" : "·"} ${v.name} (${v.city}, ${v.country})${hit ? ` → ${hit.capacity} [${hit.id}]` : " sin aforo"}`);
    await pause(250);
  }
  return out;
}
