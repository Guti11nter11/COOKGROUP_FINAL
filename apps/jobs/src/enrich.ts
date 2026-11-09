import type { EnrichInput, EnrichTodo } from "@gira/core";
import { gira } from "./gira-client";
import { findCapacities } from "./enrich-venues";
import { findPrices } from "./enrich-prices";
import { findSignups } from "./enrich-signups";
import { estimateAll } from "./enrich-resale";
import { findLimits } from "./enrich-limits";
import { uploadPriceImages } from "./enrich-price-images";
import { findTicketers } from "./enrich-ticketers";

/**
 * Enriquecimiento de las fichas activas: aforo de recintos (Wikidata), precios oficiales (prensa con
 * IA) y estimación de reventa. Cada parte es independiente: si una falla, las demás siguen.
 */
const todo = await gira<EnrichTodo>("/enrich/todo");
console.log(`Pendiente: ${todo.venues.length} recintos sin aforo · ${todo.shows.length} fechas sin precio · ${todo.artists.length} artistas`);

/** Artistas sin fechas, por turnos: 8 por pasada (3 pasadas al día cubren a los ⭐⭐⭐ en un día y medio). */
function watchTurn(watch: NonNullable<EnrichTodo["watch"]>): EnrichTodo["artists"] {
  const turn = Math.floor(Date.now() / (8 * 3600_000));
  const start = watch.length ? (turn * 8) % watch.length : 0;
  return [...watch.slice(start), ...watch.slice(0, start)].slice(0, 8).map((w) => ({
    artistId: w.artistId, mbid: w.mbid, homepage: w.homepage, needsSignup: true, name: w.name, tier: w.tier, dates: 0, when: [],
    countries: [], venues: [], hot: false, firstSale: null, resaleAt: null, resale: null, prices: [],
  }));
}

const steps: [string, () => Promise<EnrichInput>][] = [
  ["aforos", async () => ({ venues: await findCapacities(todo.venues) })],
  ["registros", async () => ({ signups: await findSignups(todo.artists) })],
  ["límites", async () => ({ limits: await findLimits(todo.artists) })],
  ["ticketeras oficiales (SeatGeek)", async () => ({ ticketers: await findTicketers(todo.artists) })],
  ["registros sin fechas", async () => ({ signups: await findSignups(watchTurn(todo.watch ?? []), 8, true) })],
  ["precios", async () => ({ prices: await findPrices(todo.shows) })],
  // La reventa va al final: usa los precios oficiales ya guardados (la siguiente pasada los tiene todos).
  ["reventa", async () => ({ resale: await estimateAll(todo.artists) })],
];
let failed = 0;
for (const [name, step] of steps) {
  try {
    const input = await step();
    const r = await gira<Record<string, number>>("/enrich", input);
    console.log(`${name}: guardado ${JSON.stringify(r)}`);
  } catch (e) {
    failed++;
    console.log(`⚠️ ${name}: ${String(e)}`);
  }
}
// Imagen de precios por país (con los precios recién guardados): solo se sube si cambió.
try {
  const fresh = await gira<EnrichTodo>("/enrich/todo");
  console.log(`imágenes de precios: ${JSON.stringify(await uploadPriceImages(fresh.artists))}`);
} catch (e) {
  console.log(`⚠️ imágenes de precios: ${String(e)}`);
}
if (failed === steps.length) process.exit(1);
