import { estimateResale, robustStats, type EnrichInput, type EnrichTodo, type ResaleInfo } from "@gira/core";
import { aiJson } from "./ai";
import { apifyBudget, runActor } from "./apify";
import { getJson } from "./gira-client";
import { articleText, searchNews } from "./news";
import { chooseEvents, convert, countryCode, faceValue, type StubEvent } from "./resale-lib";

const RESAMPLE_DAYS = 7;
/** Por encima de este gasto mensual de Apify no se muestrea (queda margen para redes sociales). */
const APIFY_MONTHLY_CAP_USD = 3;
const LISTINGS_PER_EVENT = 30;

type Listing = { raw_price?: number; from_url?: string; section?: string };

async function ratesFromEur(): Promise<Record<string, number>> {
  const d = await getJson<{ rates?: Record<string, number> }>("https://api.frankfurter.app/latest?from=EUR");
  return d?.rates ?? {};
}

const HISTORY_SYSTEM = `Eres un analista de reventa de entradas. De los fragmentos de prensa, extrae como mucho 3 datos
CONCRETOS de reventa de giras ANTERIORES o de otros países del artista indicado (precio pedido o pagado en
reventa, multiplicador sobre el precio oficial, agotado en minutos…), cada uno con su año y lugar si aparecen.
Frases cortas en español. "quote" es un trozo LITERAL del fragmento. No inventes nada.
Responde en JSON: {"facts":[{"text":"","quote":"","url":""}]}`;

/** Datos de reventa de otros años/países en prensa (con cita literal comprobada). */
async function history(artist: string): Promise<{ text: string; source: string }[]> {
  const items = [
    ...(await searchNews(`"${artist}" reventa entradas precio`, "ES")).slice(0, 4),
    ...(await searchNews(`"${artist}" resale ticket prices`, "GB")).slice(0, 4),
  ];
  const sources: { url: string; text: string }[] = [];
  for (const it of items) {
    const body = (await articleText(it.link)) ?? "";
    const text = `${it.title}. ${it.description}. ${body}`
      .split(/(?<=[.!?])\s+/)
      .filter((s) => /(reventa|resale|viagogo|stubhub|revend|resold|touts?|secondary)/i.test(s) && /\d/.test(s))
      .slice(0, 8)
      .join(" ");
    if (text) sources.push({ url: it.link, text });
  }
  if (!sources.length) return [];
  const res = await aiJson<{ facts?: { text: string; quote: string; url: string }[] }>(
    HISTORY_SYSTEM,
    `Artista: ${artist}\n\n${sources.map((s) => `Fuente: ${s.url}\n${s.text}`).join("\n\n")}`.slice(0, 12000),
  );
  const fold = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ");
  return (res?.facts ?? [])
    .filter((f) => f.quote?.length >= 15 && sources.some((s) => s.url === f.url && fold(s.text).includes(fold(f.quote))))
    .slice(0, 3)
    .map((f) => {
      let source = "prensa";
      try {
        source = new URL(f.url).hostname.replace(/^www\./, "");
      } catch {
        /* sin dominio */
      }
      return { text: f.text.slice(0, 160), source };
    });
}

/**
 * Estimación de reventa por artista: mercado actual en StubHub (fechas suyas + otro país para comparar),
 * comparado con el precio oficial, más datos de giras anteriores en prensa y el modelo de demanda.
 */
export async function estimateAll(artists: EnrichTodo["artists"], now = new Date(), maxSampled = 3): Promise<NonNullable<EnrichInput["resale"]>> {
  const fresh = (a: EnrichTodo["artists"][number]) => a.resaleAt && now.getTime() - Date.parse(a.resaleAt) < RESAMPLE_DAYS * 86_400_000;
  // Todos se recalculan (los precios oficiales pueden haber llegado); solo los no recientes gastan en mercado.
  const todo = [...artists].sort((a, b) => Number(!!fresh(a)) - Number(!!fresh(b)) || b.tier - a.tier || Number(b.hot) - Number(a.hot));
  const budget = process.env.APIFY_TOKEN ? await apifyBudget() : null;
  let canSample = !!budget && budget.used < Math.min(APIFY_MONTHLY_CAP_USD, budget.limit * 0.6);
  console.log(`Apify: ${budget ? `${budget.used.toFixed(2)} $ de ${budget.limit} $ este mes` : "sin acceso"} · muestreo ${canSample ? "sí" : "no"}`);
  const rates = await ratesFromEur();
  const out: NonNullable<EnrichInput["resale"]> = [];
  let sampled = 0;

  for (const a of todo.slice(0, 20)) {
    const markets: NonNullable<ResaleInfo["markets"]> = [];
    a.prices ??= [];
    const observed: number[] = [];
    let listings = 0;
    const reuse = fresh(a) ? a.resale : null;
    if (reuse?.markets?.length) {
      // Mercado leído hace menos de una semana: se reutiliza y se compara con los precios oficiales de ahora.
      for (const m of reuse.markets) {
        markets.push(m);
        listings += m.listings;
        const face = faceValue(a.prices, m.country);
        const faceUsd = face ? convert(face.amount, face.currency, "USD", rates) : null;
        if (faceUsd) observed.push(m.median / faceUsd);
      }
    } else if (!reuse && canSample && sampled < maxSampled && a.tier >= 3) {
      try {
        sampled++;
        const found = await runActor<StubEvent & { error?: string }>("parseforge/stubhub-scraper", { query: a.name, maxItems: 25, maxConcurrency: 2 }, { maxItems: 25, timeoutSecs: 180 });
        const events = chooseEvents(found.filter((e) => e.eventUrl && !e.error), a.when);
        if (events.length) {
          const urls = events.map((e) => e.eventUrl.split("?")[0]!);
          const rows = await runActor<Listing>(
            "stealth_mode/stubhub-tickets-listings-scraper",
            { urls, ignore_url_failures: true, max_items_per_url: LISTINGS_PER_EVENT },
            { maxItems: LISTINGS_PER_EVENT * urls.length, timeoutSecs: 240 },
          );
          for (const e of events) {
            const url = e.eventUrl.split("?")[0]!;
            const prices = rows.filter((r) => r.from_url?.startsWith(url) && typeof r.raw_price === "number").map((r) => r.raw_price!);
            const st = robustStats(prices);
            if (!st) continue;
            const cc = countryCode(e.venueCountry);
            markets.push({ country: cc, city: e.venueCity, localDate: e.eventDate, median: Math.round(st.median), p25: Math.round(st.p25), p75: Math.round(st.p75), currency: "USD", listings: st.n, source: "StubHub" });
            listings += st.n;
            const face = faceValue(a.prices, cc);
            const faceUsd = face ? convert(face.amount, face.currency, "USD", rates) : null;
            if (faceUsd) observed.push(st.median / faceUsd);
          }
        }
      } catch (e) {
        console.log(`⚠️ ${a.name}: mercado no disponible (${String(e)})`);
      }
      const after = await apifyBudget();
      if (after && after.used >= APIFY_MONTHLY_CAP_USD) canSample = false;
    }
    const hist = reuse ? (reuse.history ?? []) : a.tier >= 2 ? await history(a.name).catch(() => []) : [];
    const est = estimateResale({ tier: a.tier, hot: a.hot, dates: a.dates, countries: a.countries.length, observed, listings, marketsWithoutFace: markets.length - observed.length });
    out.push({ artistId: a.artistId, info: { ...est, ...(markets.length ? { markets } : {}), ...(hist.length ? { history: hist } : {}) } });
    console.log(`✓ ${a.name}: ×${est.low}–×${est.high} (${est.confidence}) · ${markets.length} mercados · ${hist.length} datos históricos`);
  }
  return out;
}
