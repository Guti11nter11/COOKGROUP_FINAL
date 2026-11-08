/** Agenda de entradas de deporte (fútbol, F1, tenis): textos para los canales. Funciones puras. */

export const CLUBS: { id: number; name: string; tickets: string }[] = [
  { id: 86, name: "Real Madrid", tickets: "https://www.realmadrid.com/es-ES/entradas" },
  { id: 81, name: "FC Barcelona", tickets: "https://www.fcbarcelona.es/es/entradas" },
  { id: 78, name: "Atlético de Madrid", tickets: "https://www.atleticodemadrid.com/entradas" },
];

const COMP: Record<string, string> = { PD: "LaLiga", CL: "Champions League", CDR: "Copa del Rey", SA: "Supercopa", EL: "Europa League" };
const ts = (iso: string, style = "f") => `<t:${Math.floor(Date.parse(iso) / 1000)}:${style}>`;

export type FdMatch = { id: number; utcDate: string; competition?: { code?: string; name?: string }; homeTeam?: { id?: number; name?: string; shortName?: string }; awayTeam?: { id?: number; name?: string; shortName?: string } };

/** Próximos partidos de los clubes seguidos, sin repetir (un Madrid–Atleti sale una vez). */
export function footballLines(matches: FdMatch[], max = 12): string[] {
  const seen = new Set<number>();
  return [...matches]
    .filter((m) => !seen.has(m.id) && seen.add(m.id))
    .sort((a, b) => a.utcDate.localeCompare(b.utcDate))
    .slice(0, max)
    .map((m) => {
      const home = CLUBS.find((c) => c.id === m.homeTeam?.id);
      const ours = home ?? CLUBS.find((c) => c.id === m.awayTeam?.id);
      const comp = COMP[m.competition?.code ?? ""] ?? m.competition?.name ?? "";
      const where = home ? "en casa" : "fuera (entradas para visitantes vía el club)";
      return `${ts(m.utcDate)} · **${m.homeTeam?.shortName ?? m.homeTeam?.name} – ${m.awayTeam?.shortName ?? m.awayTeam?.name}** · ${comp} · ${where}${ours ? ` · [Entradas](${ours.tickets})` : ""}`;
    });
}

export type F1Race = { raceName: string; date: string; time?: string; Circuit?: { circuitName?: string; Location?: { locality?: string; country?: string } } };

const GP_ES: Record<string, string> = {
  Spanish: "España", Madrid: "Madrid", British: "Gran Bretaña", Italian: "Italia", Monaco: "Mónaco", Belgian: "Bélgica", Dutch: "Países Bajos",
  Austrian: "Austria", Hungarian: "Hungría", Azerbaijan: "Azerbaiyán", Singapore: "Singapur", Japanese: "Japón", Australian: "Australia",
  Brazilian: "Brasil", "São Paulo": "São Paulo", "Las Vegas": "Las Vegas", Qatar: "Catar", "Abu Dhabi": "Abu Dabi", Mexico: "México",
  "Mexico City": "Ciudad de México", "United States": "Estados Unidos", Miami: "Miami", Canadian: "Canadá", Chinese: "China",
  Bahrain: "Baréin", "Saudi Arabian": "Arabia Saudí", "Emilia Romagna": "Emilia-Romaña", Barcelona: "Barcelona",
};

/** Próximas carreras de F1 con el enlace de la tienda oficial de entradas. */
export function f1Lines(races: F1Race[], now: Date, max = 8): string[] {
  return races
    .filter((r) => Date.parse(`${r.date}T${r.time ?? "12:00:00Z"}`) > now.getTime())
    .slice(0, max)
    .map((r) => {
      const key = r.raceName.replace(/ Grand Prix$/, "");
      const name = GP_ES[key] ? `GP de ${GP_ES[key]}` : r.raceName;
      const place = [r.Circuit?.Location?.locality, r.Circuit?.Location?.country].filter(Boolean).join(", ");
      return `${ts(`${r.date}T${r.time ?? "12:00:00Z"}`, "D")} · **${name}** · ${place} · [Entradas](https://tickets.formula1.com/en)`;
    });
}

/** Grandes torneos de tenis: cuándo se juegan y dónde se compran (las ventas nuevas llegan por la vigilancia de sus webs). */
export const TENNIS: { name: string; when: string; where: string; tickets: string }[] = [
  { name: "Open de Australia", when: "enero", where: "Melbourne", tickets: "https://ausopen.com/tickets" },
  { name: "Mutua Madrid Open", when: "finales de abril", where: "Madrid (Caja Mágica)", tickets: "https://mutuamadridopen.com/entradas/" },
  { name: "Internazionali d'Italia", when: "mayo", where: "Roma", tickets: "https://www.internazionalibnlditalia.com/en/tickets" },
  { name: "Roland-Garros", when: "finales de mayo", where: "París", tickets: "https://www.rolandgarros.com/en-us/page/tickets" },
  { name: "Wimbledon", when: "finales de junio", where: "Londres (sorteo público)", tickets: "https://www.wimbledon.com/en_GB/tickets/index.html" },
  { name: "US Open", when: "finales de agosto", where: "Nueva York", tickets: "https://www.usopen.org/en_US/tickets/index.html" },
  { name: "Nitto ATP Finals", when: "noviembre", where: "Turín", tickets: "https://www.nittoatpfinals.com/en/tickets" },
];
export const tennisLines = () => TENNIS.map((t) => `**${t.name}** · ${t.when} · ${t.where} · [Entradas](${t.tickets})`);
