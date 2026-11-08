/** Vigilancia de webs oficiales de entradas de deporte. Funciones puras. */

const KEY = /(entradas|tickets?|ticketing|billets?|billetterie|venta|on sale|sale|ballot|sorteo|socios|abonad|members?|membership|registr|preventa|presale|pre-sale|priority|prioritaria|hospitality|\b20(2[6-9]|3\d)\b|\b\d{1,2}\s*(de\s+)?(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic|jan|apr|aug|dec)[a-z]*\b)/i;

/** Líneas de texto de la página que hablan de entradas o fechas (sin menús repetidos ni basura). */
export function relevantLines(html: string): string[] {
  const text = html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h\d|\/a|\/span|\/button)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&quot;/g, '"');
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split("\n")) {
    const l = raw.replace(/\s+/g, " ").trim();
    if (l.length < 12 || l.length > 300 || !KEY.test(l) || seen.has(l.toLowerCase())) continue;
    seen.add(l.toLowerCase());
    out.push(l);
  }
  return out.slice(0, 250);
}

/** Lo nuevo respecto a la lectura anterior. */
export const addedLines = (prev: string[], now: string[]) => {
  const before = new Set(prev.map((l) => l.toLowerCase()));
  return now.filter((l) => !before.has(l.toLowerCase()));
};

/** robots.txt: ¿permite leer esta ruta a cualquier agente? (grupo "User-agent: *"). */
export function robotsAllows(robots: string, path: string): boolean {
  let inStar = false;
  const rules: { allow: boolean; prefix: string }[] = [];
  for (const raw of robots.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = /^(user-agent|allow|disallow)\s*:\s*(.*)$/i.exec(line);
    if (!m) continue;
    const [, k, v] = m;
    if (k!.toLowerCase() === "user-agent") inStar = v!.trim() === "*";
    else if (inStar && v!.trim()) rules.push({ allow: k!.toLowerCase() === "allow", prefix: v!.trim().replace(/\*$/, "") });
  }
  const match = rules.filter((r) => path.startsWith(r.prefix)).sort((a, b) => b.prefix.length - a.prefix.length)[0];
  return !match || match.allow;
}
