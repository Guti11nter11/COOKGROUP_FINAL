export interface Candidate {
  id: string;
  name: string;
  upcomingEvents: number;
  segment: string;
}

/** Minúsculas, sin acentos, sin artículo inicial "the" y solo letras y números. */
export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/^the\s+/, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Elige el attraction de Ticketmaster que es exactamente ese artista; si no hay, no adivina. */
export function pickAttraction(name: string, candidates: Candidate[]): { id: string } | { unresolved: string } {
  const target = normalizeName(name);
  const best = candidates
    .filter((c) => c.segment === "Music" && normalizeName(c.name) === target)
    .sort((a, b) => b.upcomingEvents - a.upcomingEvents)[0];
  return best ? { id: best.id } : { unresolved: name };
}
