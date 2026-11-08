/**
 * Agenda de entradas de deporte para los canales de Discord: próximos partidos de Real Madrid, Barça y
 * Atleti (football-data.org), próximas carreras de F1 (Jolpica) y grandes torneos de tenis. El Worker
 * añade lo que ya vende Ticketmaster y edita un mensaje fijo por canal.
 */
import { gira, getJson } from "./gira-client";
import { CLUBS, f1Lines, footballLines, tennisLines, type F1Race, type FdMatch } from "./sports-agenda-lib";

const FD = process.env.FOOTBALL_DATA_API_KEY;
const now = new Date();
const sections: { channel: string; title: string; lines: string[] }[] = [];

if (FD) {
  const matches: FdMatch[] = [];
  const to = new Date(now.getTime() + 45 * 86_400_000).toISOString().slice(0, 10);
  for (const c of CLUBS) {
    const d = await getJson<{ matches?: FdMatch[] }>(
      `https://api.football-data.org/v4/teams/${c.id}/matches?status=SCHEDULED,TIMED&dateFrom=${now.toISOString().slice(0, 10)}&dateTo=${to}`,
      { headers: { "X-Auth-Token": FD } },
    );
    matches.push(...(d?.matches ?? []));
    await new Promise((r) => setTimeout(r, 6500)); // plan gratuito: 10 peticiones por minuto
  }
  const lines = footballLines(matches);
  console.log(`Fútbol: ${lines.length} partidos`);
  if (lines.length) sections.push({ channel: "futbol", title: "⚽ Próximos partidos (Real Madrid, Barça, Atleti)", lines });
} else console.log("Sin FOOTBALL_DATA_API_KEY: fútbol sin partidos");

const year = now.getUTCFullYear();
const races: F1Race[] = [];
for (const y of [year, year + 1]) {
  const d = await getJson<{ MRData?: { RaceTable?: { Races?: F1Race[] } } }>(`https://api.jolpi.ca/ergast/f1/${y}/races.json`);
  races.push(...(d?.MRData?.RaceTable?.Races ?? []));
}
const f1 = f1Lines(races, now);
console.log(`F1: ${f1.length} carreras`);
sections.push({ channel: "f1", title: "🏎️ Próximas carreras de F1", lines: f1.length ? f1 : ["Calendario de la próxima temporada aún sin publicar."] });
sections.push({ channel: "tenis", title: "🎾 Grandes torneos y dónde comprar", lines: tennisLines() });
for (const ch of ["nfl", "otros-deportes"]) sections.push({ channel: ch, title: "", lines: [] });

console.log(JSON.stringify(await gira("/enrich/agenda", { sections })));
