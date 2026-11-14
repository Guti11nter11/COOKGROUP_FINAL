import { findArtist, inboxPrompt, looksLikePresaleMail, readPresaleMail, verifyAiAccess, type AiAccess, type InboxMail, type PresaleAccess } from "@gira/core";
import { askJson } from "./ai";
import { addLnPage } from "./livenation";
import type { Env } from "./env";
import { pushAll } from "./push";

/**
 * Correos de preventa del propietario: su script de Google (en su Gmail, solo lectura) manda los
 * correos nuevos; aquí se saca un código y un enlace por preventa y se guarda uno solo por artista y
 * tipo. Nunca se guarda el correo, ni se escribe su contenido en registros.
 */
const KEEP_DAYS = 45;

export async function inboxToken(env: Env): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`gira-inbox:${env.TICKETMASTER_API_KEY}`));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function ingestInbox(env: Env, body: { mails?: InboxMail[] }, now: Date): Promise<{ read: number; stored: number }> {
  const mails = (body.mails ?? []).slice(0, 10).filter((m) => m && typeof m.subject === "string" && typeof m.text === "string");
  if (!mails.length) return { read: 0, stored: 0 };
  // Candidatos: artistas con ficha activa o con registro conocido (el acceso puede llegar antes que la ficha).
  const { results: artists } = await env.DB.prepare(
    `SELECT a.id, a.name FROM artist a WHERE a.id IN (SELECT artist_id FROM sheet WHERE status = 'active'
       UNION SELECT artist_id FROM artist_signup UNION SELECT artist_id FROM artist_signup_manual)`,
  ).all<{ id: string; name: string }>();
  const iso = now.toISOString();
  const old = new Date(now.getTime() - KEEP_DAYS * 86_400_000).toISOString();
  let stored = 0;
  const fresh: string[] = [];
  for (const raw of mails) {
    const m = { ...raw, from: String(raw.from ?? ""), links: Array.isArray(raw.links) ? raw.links.slice(0, 200) : [] };
    // Enlaces de evento de Live Nation en el correo: GIRA empieza a leer esa página (y su gira).
    for (const l of m.links.slice(0, 200)) if (typeof l?.href === "string") await addLnPage(env, l.href.replace(/[?#].*$/, ""), now);
    if (!looksLikePresaleMail(m) || !findArtist(m, artists)) continue;
    // Cada correo es distinto: lo lee la IA y lo que dice se comprueba contra el correo. Sin IA, las reglas.
    const ai = await askJson<AiAccess>(env, inboxPrompt(m)).catch(() => null);
    const checked = ai ? verifyAiAccess(m, ai, artists) : null;
    if (ai?.is_access === false) continue;
    const r = checked?.access ?? readPresaleMail(m);
    const a = checked?.artist ?? findArtist(m, artists);
    if (!r || !a) continue;
    const at = Number.isNaN(Date.parse(m.date)) ? iso : new Date(m.date).toISOString();
    // Uno por preventa: lo primero que llegó se queda; solo se completa lo que faltaba (código o enlace).
    // Lo de otra gira (más de 45 días) se sustituye.
    const res = await env.DB.prepare(
      `INSERT INTO presale_access (artist_id, kind, label, code, url, received_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
       ON CONFLICT (artist_id, kind) DO UPDATE SET
         label = CASE WHEN presale_access.received_at < ?7 THEN excluded.label ELSE presale_access.label END,
         code = CASE WHEN presale_access.received_at < ?7 THEN excluded.code ELSE COALESCE(presale_access.code, excluded.code) END,
         url = CASE WHEN presale_access.received_at < ?7 THEN excluded.url ELSE COALESCE(presale_access.url, excluded.url) END,
         received_at = CASE WHEN presale_access.received_at < ?7 THEN excluded.received_at ELSE presale_access.received_at END
       WHERE presale_access.received_at < ?7
          OR (presale_access.code IS NULL AND excluded.code IS NOT NULL)
          OR (presale_access.url IS NULL AND excluded.url IS NOT NULL)`,
    )
      .bind(a.id, r.kind, r.label.slice(0, 80), r.code, r.url, at, old)
      .run();
    if (!res.meta.changes) continue;
    stored++;
    await env.DB.prepare("INSERT OR IGNORE INTO sheet_dirty (artist_id, since) VALUES (?, ?)").bind(a.id, iso).run();
    fresh.push(`${a.name} · ${r.label}`);
  }
  if (fresh.length) await pushAll(env, { title: "🔐 Acceso de preventa recibido", body: `${fresh.slice(0, 3).join(" · ")}. Ya está en su ficha.`, tag: "inbox" }).catch(() => 0);
  return { read: mails.length, stored };
}

export async function loadAccess(env: Env, artistId: string, now: Date): Promise<PresaleAccess[]> {
  const old = new Date(now.getTime() - KEEP_DAYS * 86_400_000).toISOString();
  const { results } = await env.DB.prepare("SELECT kind, label, code, url, received_at FROM presale_access WHERE artist_id = ? AND received_at >= ? ORDER BY received_at")
    .bind(artistId, old)
    .all<{ kind: PresaleAccess["kind"]; label: string; code: string | null; url: string | null; received_at: string }>();
  return results.map((r) => ({ kind: r.kind, label: r.label, code: r.code, url: r.url, receivedAt: r.received_at }));
}

/** Para registros públicos (vista previa en GitHub Actions): las líneas de acceso personal se ocultan. */
export const redactAccess = (msg: string) => msg.replace(/^🔐.*$/gm, "🔐 (acceso personal: oculto en la vista previa)");
