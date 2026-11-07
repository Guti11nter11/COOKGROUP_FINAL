import type { EnrichInput, EnrichTodo } from "@gira/core";
import { gira } from "./gira-client";
import { findCapacities } from "./enrich-venues";
import { findPrices } from "./enrich-prices";
import { findSignups } from "./enrich-signups";

/**
 * Enriquecimiento de las fichas activas: aforo de recintos (Wikidata), precios oficiales (prensa con
 * IA) y estimación de reventa. Cada parte es independiente: si una falla, las demás siguen.
 */
const todo = await gira<EnrichTodo>("/enrich/todo");
console.log(`Pendiente: ${todo.venues.length} recintos sin aforo · ${todo.shows.length} fechas sin precio · ${todo.artists.length} artistas`);

const steps: [string, () => Promise<EnrichInput>][] = [
  ["aforos", async () => ({ venues: await findCapacities(todo.venues) })],
  ["registros", async () => ({ signups: await findSignups(todo.artists) })],
  ["precios", async () => ({ prices: await findPrices(todo.shows) })],
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
if (failed === steps.length) process.exit(1);
