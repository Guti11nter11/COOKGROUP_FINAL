import type { EnrichInput, EnrichTodo } from "@gira/core";
import { aiJson } from "./ai";
import { articleText, searchNews } from "./news";
import { assignToShows, PRICE_QUERY, priceSnippets, validPrices, type ExtractedPrice } from "./prices-lib";

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

const SYSTEM = `Eres un extractor de datos para un radar personal de conciertos. De los fragmentos de noticias,
extrae SOLO los precios oficiales de venta primaria (no reventa, no Viagogo/StubHub) de las entradas
estándar del artista indicado, por ciudad. No incluyas paquetes VIP/hospitality en el máximo si se
distinguen. No inventes nada: si un fragmento no da cifras explícitas para una ciudad, no la incluyas.
Si el texto da precio por zona (pista, Red Zone, Inner Circle, gradas…), inclúyelos en "zones" con el
nombre tal como aparece y el precio como número (181,50 → 181.5). "quote" debe ser un trozo LITERAL
copiado del fragmento que contiene el precio mínimo. "url" es la de su fuente.
Responde en JSON: {"prices":[{"city":"","min":0,"max":0,"currency":"EUR","quote":"","url":"","zones":[{"name":"","price":0}]}]}`;

/** Precios oficiales de las fechas sin precio, desde prensa (por artista y país). */
export async function findPrices(shows: EnrichTodo["shows"], maxGroups = 14): Promise<NonNullable<EnrichInput["prices"]>> {
  const groups = new Map<string, EnrichTodo["shows"]>();
  for (const s of shows) groups.set(`${s.artistId}|${s.country}`, [...(groups.get(`${s.artistId}|${s.country}`) ?? []), s]);
  const out: NonNullable<EnrichInput["prices"]> = [];
  for (const [, list] of [...groups].slice(0, maxGroups)) {
    try {
      await priceGroup(list, out);
    } catch (e) {
      console.log(`⚠️ ${list[0]!.artist} (${list[0]!.country}): ${String(e)}`);
    }
    await pause(1500);
  }
  return out;
}

async function priceGroup(list: EnrichTodo["shows"], out: NonNullable<EnrichInput["prices"]>): Promise<void> {
  {
    const { artist, country } = list[0]!;
    const items = (await searchNews(`"${artist}" ${PRICE_QUERY[country] ?? "ticket prices"}`, country)).slice(0, 6);
    const sources: { url: string; text: string; name: string }[] = [];
    for (const it of items) {
      const body = (await articleText(it.link)) ?? "";
      const snippets = priceSnippets(`${it.title}. ${it.description}. ${body}`);
      if (snippets.length) sources.push({ url: it.link, text: snippets.join(" "), name: it.source });
      await pause(400);
    }
    if (!sources.length) {
      console.log(`· ${artist} (${country}): sin precios en prensa`);
      return;
    }
    const cities = [...new Set(list.map((s) => s.city))].join(", ");
    const user = `Artista: ${artist}\nCiudades: ${cities}\n\n${sources.map((s) => `Fuente: ${s.url}\n${s.text}`).join("\n\n")}`;
    const res = await aiJson<{ prices?: ExtractedPrice[] }>(SYSTEM, user.slice(0, 12000));
    const ok = validPrices(res?.prices ?? [], sources);
    const assigned = assignToShows(ok, list);
    for (const [sourceId, p] of assigned) {
      // Nombre del medio (Google News enlaza por su dominio; el medio real viene en el RSS).
      let source = sources.find((x) => x.url === p.url)?.name || "prensa";
      try {
        const host = new URL(p.url).hostname.replace(/^www\./, "");
        if (!/news\.google\.com$/.test(host) && !source.includes(".")) source = `${source} (${host})`;
        else if (!/news\.google\.com$/.test(host)) source = host;
      } catch {
        /* sin dominio */
      }
      out.push({ sourceId, min: p.min, max: p.max, currency: p.currency, source, ...(p.zones ? { zones: p.zones } : {}) });
    }
    console.log(`${assigned.size ? "✓" : "·"} ${artist} (${country}): ${ok.map((p) => `${p.city} ${p.min}-${p.max} ${p.currency}`).join(" · ") || "nada verificable"}`);
  }
}
