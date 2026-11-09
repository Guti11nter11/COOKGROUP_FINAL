import type { EnrichInput, EnrichTodo } from "@gira/core";
import { getJson } from "./gira-client";

const fold = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
type Performer = { name?: string; url?: string; has_upcoming_events?: boolean; num_upcoming_events?: number };

/** Página del artista en SeatGeek si vende ahí (búsqueda por nombre exacto). Pura. */
export function seatGeekPage(name: string, performers: Performer[]): string | null {
  const p = performers.find((x) => fold(x.name ?? "") === fold(name) && x.has_upcoming_events && x.url?.startsWith("https://seatgeek.com/"));
  return p?.url ?? null;
}

/**
 * SeatGeek como ticketera de venta oficial (sobre todo EE. UU.): para los artistas con fechas en EE. UU.
 * o Canadá, su página de SeatGeek si tiene eventos. Sin SEATGEEK_CLIENT_ID no hace nada.
 */
export async function findTicketers(artists: EnrichTodo["artists"], max = 25): Promise<NonNullable<EnrichInput["ticketers"]>> {
  const id = process.env.SEATGEEK_CLIENT_ID;
  if (!id) return [];
  const out: NonNullable<EnrichInput["ticketers"]> = [];
  for (const a of artists.filter((x) => x.countries.some((cc) => cc === "US" || cc === "CA")).slice(0, max)) {
    const d = await getJson<{ performers?: Performer[] }>(`https://api.seatgeek.com/2/performers?${new URLSearchParams({ q: a.name, per_page: "5", client_id: id })}`);
    if (!d) continue; // fallo de red: no se toca lo guardado
    const url = seatGeekPage(a.name, d.performers ?? []);
    out.push({ artistId: a.artistId, name: "SeatGeek", url });
    console.log(`${url ? "✓" : "·"} ${a.name}: ${url ? "vende en SeatGeek" : "sin eventos en SeatGeek"}`);
    await new Promise((r) => setTimeout(r, 300));
  }
  return out;
}
