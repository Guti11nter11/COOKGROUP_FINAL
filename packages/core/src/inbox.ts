/**
 * Lector de los correos de preventa del propietario (su propio Gmail, solo lectura): de cada correo
 * saca UNA preventa con, como mucho, UN código y UN enlace. Nunca guarda pases de cola
 * (`queueittoken`) ni enlaces de baja o de preferencias. Funciones puras.
 */
import { classifySaleLabel, type SaleKind } from "./presale";
import type { SaleWindow } from "./ticketmaster";

export interface InboxMail {
  id: string;
  from: string;
  subject: string;
  date: string;
  text: string;
  /** Enlaces del HTML con su texto visible (el texto dice si es "Unlock tickets" o "Unsubscribe"). */
  links: { text: string; href: string }[];
}

export interface PresaleAccess {
  kind: SaleKind;
  label: string;
  code: string | null;
  url: string | null;
  receivedAt: string;
}

const fold = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const PRESALE_WORD = /\b(pre-?sale|preventa|pr[ée]-?vente|vorverkauf|prevendita|voorverkoop|early access)\b/gi;
const PRESALE_HINT = /(pre-?sale|preventa|pr[ée]-?vente|vorverkauf|prevendita|voorverkoop|early access|verified fan|access code|unlock|c[oó]digo de (acceso|preventa))/i;
const ORDER = /(order confirmation|your order|order #|confirmaci[oó]n de (tu )?(pedido|compra)|\breceipt\b|\brecibo\b|refund|reembolso|has been cancel+ed|ha sido cancelad)/i;
const REGISTERED =
  /(you('|’)re registered|you are registered|you('|’)re on the (list|waitlist)|thanks for (signing up|registering)|registration (is )?(confirmed|complete|received)|successfully registered|te has registrado|registro (completado|confirmado)|inscription confirm[ée]e)/i;

const CODE =
  /\b(?:code|c[oó]digo|password|passcode|contrase[nñ]a|kennwort|codice)\b(?:\s+(?:is|es|ist|est|è|de|del|acceso|preventa|for|the|presale|access|unlock|was|será|sera)){0,4}\s*[:：\-–]?\s*["“'‘«]?([A-Za-z0-9][A-Za-z0-9-]{3,24})\b/gi;
const NOT_CODE = new Set(["below", "here", "will", "this", "that", "sent", "needed", "required", "your", "with", "when", "which", "abajo", "aqui", "para", "sera", "unique", "access", "presale", "ticketmaster", "email", "link", "only", "valid"]);

function firstCode(text: string): string | null {
  for (const m of text.matchAll(CODE)) {
    const c = m[1]!;
    if (NOT_CODE.has(fold(c))) continue;
    if (!/\d/.test(c) && c !== c.toUpperCase()) continue; // palabra normal, no un código
    if (/^(19|20)\d\d$/.test(c)) continue; // un año
    return c;
  }
  return null;
}

const BAD_HREF = /(unsub|opt-?out|preferences|privacy|terms|legal|\bhelp\b|faq|support|facebook\.|instagram\.|twitter\.|\bx\.com|tiktok\.|youtube\.|apps\.apple|play\.google|mailto:|queueittoken|queue-it|\/\/queue\.)/i;
const BAD_TEXT = /(unsubscribe|darse de baja|privacy|privacidad|terms|preferences|preferencias|view in browser|ver en el navegador|\bhelp\b|ayuda)/i;
const ACTION = /(unlock|access|acceso|pre-?sale|preventa|tickets|entradas|billets|tickets kaufen|comprar|buy|shop|enter|join|click here|haz clic)/i;
const TICKETING = /(ticketmaster|livenation|live-nation|axs\.com|seetickets|eventim|ticketone|dice\.fm|seatgeek|fnac|laylo|seated\.com|tmstor\.es|musicglue|entradas\.com)/i;
const ACCESS_PARAM = /[?&](did|discount|code|accesscode|access|ac_link|invite|unlock|promo|pc)=/i;

function bestLink(m: InboxMail): string | null {
  const fromText = [...m.text.matchAll(/https:\/\/[^\s<>"')\]]+/g)].map((x) => ({ text: "", href: x[0] }));
  let best: { href: string; score: number } | null = null;
  for (const l of [...m.links, ...fromText]) {
    if (!/^https:\/\//i.test(l.href) || BAD_HREF.test(l.href) || BAD_TEXT.test(l.text)) continue;
    const score = (ACTION.test(l.text) ? 2 : 0) + (TICKETING.test(l.href) ? 2 : 0) + (ACCESS_PARAM.test(l.href) ? 1 : 0);
    if (score >= 3 && (!best || score > best.score)) best = { href: l.href, score };
  }
  return best?.href ?? null;
}

/** El nombre de la preventa: la palabra "presale/preventa" con las 1–4 palabras que la acompañan y le dan tipo. */
function presaleName(text: string): { kind: SaleKind; label: string } | null {
  let fallback: { kind: SaleKind; label: string } | null = null;
  for (const m of text.matchAll(PRESALE_WORD)) {
    const at = m.index ?? 0;
    const before = text.slice(Math.max(0, at - 60), at).split(/[^\p{L}\p{N}&'’+-]+/u).filter(Boolean);
    const after = text.slice(at + m[0].length, at + m[0].length + 60).split(/[^\p{L}\p{N}&'’+-]+/u).filter(Boolean);
    const tries = [
      ...[1, 2, 3].map((n) => `${before.slice(-n).join(" ")} ${m[0]}`),
      ...[1, 2, 3, 4].map((n) => `${m[0]} ${after.slice(0, n).join(" ")}`),
    ];
    for (const label of tries) {
      const { kind } = classifySaleLabel(label);
      if (kind !== "unknown" && kind !== "general" && kind !== "official_resale") return { kind, label: label.trim() };
    }
    fallback ??= { kind: "unknown", label: "Preventa" };
  }
  return fallback;
}

/** Filtro previo (sin IA): habla de preventa y no es un pedido, recibo o cancelación. */
export function looksLikePresaleMail(m: Pick<InboxMail, "subject" | "text">): boolean {
  return PRESALE_HINT.test(`${m.subject}\n${m.text}`) && !ORDER.test(m.subject) && !ORDER.test(m.text.slice(0, 400));
}

/** Una preventa por correo (código y enlace, uno de cada como mucho), o null si no es un correo de acceso. Sin IA. */
export function readPresaleMail(m: InboxMail): Omit<PresaleAccess, "receivedAt"> | null {
  const all = `${m.subject}\n${m.text}`;
  if (!looksLikePresaleMail(m)) return null;
  const code = firstCode(all);
  if (!code && REGISTERED.test(all)) return null; // "ya estás registrado": aún no trae el acceso
  const url = bestLink(m);
  if (!code && !url) return null;
  const name = presaleName(m.subject) ?? presaleName(m.text.slice(0, 3000));
  const verified = /verified fan/i.test(all) ? { kind: "registration" as SaleKind, label: "Verified Fan" } : null;
  const { kind, label } = name && name.kind !== "unknown" ? name : (verified ?? name ?? { kind: "unknown" as SaleKind, label: "Preventa" });
  return { kind, label, code, url };
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** El artista del correo: primero en remitente y asunto, luego en el texto; palabra completa y el nombre más largo. */
export function findArtist<A extends { id: string; name: string }>(m: InboxMail, artists: A[]): A | null {
  const sorted = [...artists].filter((a) => a.name.trim().length >= 2).sort((a, b) => b.name.length - a.name.length);
  for (const hay of [fold(`${m.from}\n${m.subject}`), fold(m.text.slice(0, 5000))]) {
    const hit = sorted.find((a) => new RegExp(`(^|[^\\p{L}\\p{N}])${escape(fold(a.name.trim()))}([^\\p{L}\\p{N}]|$)`, "u").test(hay));
    if (hit) return hit;
  }
  return null;
}

const tokens = (label: string) =>
  fold(label)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= 3 && !/^(pre|sale|presale|preventa|del|the|for)$/.test(t));

/** El acceso del correo que corresponde a una venta de la ficha: mismo tipo o, si no, mismas palabras. */
export function accessFor(w: Pick<SaleWindow, "kind" | "label">, list: PresaleAccess[]): PresaleAccess | null {
  if (w.kind === "general") return null;
  const sameKind = list.find((a) => a.kind === w.kind && a.kind !== "unknown");
  if (sameKind) return sameKind;
  const wl = fold(w.label);
  return list.find((a) => a.kind === "unknown" && tokens(a.label).length > 0 && tokens(a.label).every((t) => wl.includes(t))) ?? null;
}

/** Enlaces que la IA puede elegir (nunca bajas, preferencias, redes ni pases de cola), numerados. */
export function candidateLinks(m: InboxMail): { text: string; href: string }[] {
  const fromText = [...m.text.matchAll(/https:\/\/[^\s<>"')\]]+/g)].map((x) => ({ text: "", href: x[0] }));
  const seen = new Set<string>();
  return [...m.links, ...fromText]
    .filter((l) => /^https:\/\//i.test(l.href) && !BAD_HREF.test(l.href) && !BAD_TEXT.test(l.text) && !seen.has(l.href) && seen.add(l.href))
    .slice(0, 40);
}

/**
 * Instrucciones para la IA: cada correo es distinto (Ticketmaster, Live Nation, fan clubs, Laylo, tiendas…),
 * así que la IA lo lee entero y dice qué preventa es, de qué artista, y UN código y UN enlace. Lo que
 * conteste se comprueba contra el propio correo (verifyAiAccess): nada inventado llega a la ficha.
 */
export function inboxPrompt(m: InboxMail): string {
  const links = candidateLinks(m).map((l, i) => `[${i + 1}] ${l.text || "(sin texto)"} → ${l.href.slice(0, 160)}`);
  return [
    "Lee este correo y devuelve SOLO un JSON con esta forma:",
    '{"is_access": true|false, "artist": "nombre del artista o evento" | null, "presale": "nombre de la preventa tal como aparece" | null, "code": "código literal" | null, "link": número | null}',
    "- is_access = true solo si el correo da acceso a una preventa o venta de entradas (un código o un enlace para entrar/comprar). Un \"te has registrado\", un boletín, un pedido o un recibo = false.",
    "- code: cópialo literal, tal cual aparece. Si hay varios, elige UNO (el principal). Si no hay, null.",
    "- link: el número del enlace que lleva a la preventa (desbloquear o comprar entradas). Si hay varios, UNO. Si no hay, null.",
    "- No inventes nada.",
    "",
    `De: ${m.from}`,
    `Asunto: ${m.subject}`,
    "Texto:",
    m.text.replace(/https:\/\/\S+/g, "(enlace)").slice(0, 4000),
    "",
    "Enlaces:",
    ...(links.length ? links : ["(ninguno)"]),
  ].join("\n");
}

export interface AiAccess {
  is_access?: boolean;
  artist?: string | null;
  presale?: string | null;
  code?: string | null;
  link?: number | null;
}

/** Comprueba la respuesta de la IA contra el correo: código literal, enlace de la lista y artista seguido que aparece en él. */
export function verifyAiAccess<A extends { id: string; name: string }>(
  m: InboxMail,
  ai: AiAccess,
  artists: A[],
): { artist: A; access: Omit<PresaleAccess, "receivedAt"> } | null {
  if (!ai || ai.is_access !== true || !looksLikePresaleMail(m)) return null;
  const all = `${m.subject}\n${m.text}`;
  const rawCode = typeof ai.code === "string" ? ai.code.trim() : "";
  const code = rawCode && rawCode.length >= 4 && rawCode.length <= 40 && !/\s/.test(rawCode) && all.includes(rawCode) && !NOT_CODE.has(fold(rawCode)) ? rawCode : null;
  const links = candidateLinks(m);
  const url = typeof ai.link === "number" && Number.isInteger(ai.link) && ai.link >= 1 && ai.link <= links.length ? links[ai.link - 1]!.href : null;
  if (!code && !url) return null;
  // El artista: el que dice la IA, si lo seguimos y aparece en el correo; si no, el que aparece en el correo.
  const named = typeof ai.artist === "string" && ai.artist.trim() ? findArtist({ ...m, from: "", subject: ai.artist, text: "" }, artists) : null;
  const artist = named && findArtist(m, [named]) ? named : findArtist(m, artists);
  if (!artist) return null;
  const presale = typeof ai.presale === "string" && ai.presale.trim() && fold(all).includes(fold(ai.presale.trim())) ? ai.presale.trim().slice(0, 80) : null;
  const byAi = presale ? classifySaleLabel(presale).kind : "unknown";
  const name = presaleName(m.subject) ?? presaleName(m.text.slice(0, 3000));
  const { kind, label } =
    byAi !== "unknown" && byAi !== "general" && byAi !== "official_resale"
      ? { kind: byAi, label: presale! }
      : name && name.kind !== "unknown"
        ? name
        : /verified fan/i.test(all)
          ? { kind: "registration" as SaleKind, label: "Verified Fan" }
          : { kind: "unknown" as SaleKind, label: presale ?? "Preventa" };
  return { artist, access: { kind, label, code, url } };
}
