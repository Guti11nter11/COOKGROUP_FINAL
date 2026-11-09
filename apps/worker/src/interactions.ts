import { formatHHmm, MADRID } from "@gira/core";
import { loadSlots } from "./calendar";
import type { Env } from "./env";
import { inboxToken } from "./inbox";

const GMAIL_SCRIPT = "https://github.com/Guti11nter11/COOKGROUP_FINAL/blob/claude/vigilant-euler-pkmop0/tools/gmail/gira-gmail.gs";

/**
 * Comandos de Discord (/seguir, /dejar, /proximas, /gira, /registro, /gmail). Discord firma cada petición con Ed25519;
 * sin firma válida se responde 401 (Discord lo exige para aceptar la URL de interacciones).
 */
const hex = (h: string) => Uint8Array.from(h.match(/../g) ?? [], (b) => parseInt(b, 16));

export async function verifyDiscord(env: Env, req: Request, body: string): Promise<boolean> {
  const sig = req.headers.get("x-signature-ed25519");
  const ts = req.headers.get("x-signature-timestamp");
  if (!sig || !ts || !env.DISCORD_PUBLIC_KEY) return false;
  try {
    const key = await crypto.subtle.importKey("raw", hex(env.DISCORD_PUBLIC_KEY), { name: "Ed25519" }, false, ["verify"]);
    return await crypto.subtle.verify("Ed25519", key, hex(sig), new TextEncoder().encode(ts + body));
  } catch {
    return false;
  }
}

type Interaction = { type: number; member?: { permissions?: string }; data?: { name: string; options?: { name: string; value: string }[] } };
const reply = (content: string) => Response.json({ type: 4, data: { content, flags: 64 | 4, allowed_mentions: { parse: [] } } });

/** Busca una entidad en Ticketmaster (atracciones) y devuelve la que mejor encaja con el nombre. */
async function findAttraction(env: Env, name: string): Promise<{ id: string; name: string; segment?: string } | null> {
  const url = `https://app.ticketmaster.com/discovery/v2/attractions.json?keyword=${encodeURIComponent(name)}&size=10&apikey=${env.TICKETMASTER_API_KEY}`;
  const res = await fetch(url).catch(() => null);
  if (!res?.ok) return null;
  const items = (((await res.json()) as { _embedded?: { attractions?: { id: string; name: string; upcomingEvents?: { _total?: number }; classifications?: { segment?: { name?: string } }[] }[] } })._embedded?.attractions ?? []);
  const fold = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const exact = items.filter((a) => fold(a.name) === fold(name));
  const pool = exact.length ? exact : items;
  const best = pool.sort((a, b) => (b.upcomingEvents?._total ?? 0) - (a.upcomingEvents?._total ?? 0))[0];
  return best ? { id: best.id, name: best.name, segment: best.classifications?.[0]?.segment?.name } : null;
}

export async function handleInteraction(env: Env, raw: string, now: Date): Promise<Response> {
  const i = JSON.parse(raw) as Interaction;
  if (i.type === 1) return Response.json({ type: 1 }); // PING
  if (i.type !== 2 || !i.data) return reply("No entiendo esa acción.");
  const opt = (n: string) => i.data!.options?.find((o) => o.name === n)?.value?.trim() ?? "";

  if (i.data.name === "proximas") {
    const slots = (await loadSlots(env, now)).slice(0, 12);
    if (!slots.length) return reply("No hay preventas ni ventas a la vista ahora mismo.");
    const day = new Intl.DateTimeFormat("es-ES", { timeZone: MADRID, weekday: "short", day: "numeric", month: "short" });
    return reply(
      ["**Próximas ventas** (hora de Madrid)", ...slots.map((s) => `\`${day.format(new Date(s.startsAt))} ${formatHHmm(s.startsAt, MADRID)}\` **${s.artist}** · ${s.label}${s.channelId ? ` → <#${s.channelId}>` : ""}`)].join("\n"),
    );
  }

  if (i.data.name === "gira") {
    const name = opt("artista");
    const row = await env.DB.prepare(
      "SELECT a.name, h.channel_id, h.status FROM artist a LEFT JOIN sheet h ON h.artist_id = a.id WHERE lower(a.name) = lower(?) LIMIT 1",
    )
      .bind(name)
      .first<{ name: string; channel_id: string | null; status: string | null }>();
    if (!row) return reply(`No sigo a «${name}». Usa \`/seguir\` para añadirlo.`);
    if (row.status === "active" && row.channel_id) return reply(`**${row.name}** → <#${row.channel_id}>`);
    return reply(`**${row.name}**: ahora mismo no tiene preventas ni ventas por llegar. Te avisaré en cuanto las tenga.`);
  }

  if (i.data.name === "seguir") {
    const name = opt("artista");
    if (name.length < 2) return reply("Escribe el nombre del artista o evento.");
    const a = await findAttraction(env, name);
    if (!a) return reply(`No encuentro «${name}» en Ticketmaster. Prueba con el nombre exacto.`);
    const id = `a_${a.id}`;
    const iso = now.toISOString();
    await env.DB.batch([
      env.DB.prepare("INSERT OR IGNORE INTO artist (id, name, tm_attraction_id) VALUES (?, ?, ?)").bind(id, a.name, a.id),
      // ⭐⭐⭐: barrido por API cada pocos minutos; ya arrancado para que avise de lo accionable desde ya.
      env.DB.prepare(
        "INSERT INTO follow (artist_id, tier, bootstrapped_at, feed_bootstrapped_at) VALUES (?, 3, ?, ?) ON CONFLICT (artist_id) DO UPDATE SET tier = 3, muted_until = NULL",
      ).bind(id, iso, iso),
    ]);
    return reply(`✅ Siguiendo a **${a.name}**${a.segment ? ` (${a.segment})` : ""} como ⭐⭐⭐. Tendrá canal en cuanto haya una preventa o venta por llegar.`);
  }

  if (i.data.name === "dejar") {
    const name = opt("artista");
    const r = await env.DB.prepare("DELETE FROM follow WHERE artist_id IN (SELECT id FROM artist WHERE lower(name) = lower(?))").bind(name).run();
    return reply(r.meta.changes ? `Dejo de seguir a **${name}**. Su canal se archivará cuando pasen sus ventas.` : `No seguía a «${name}».`);
  }
  if (i.data.name === "registro") {
    const name = opt("artista");
    const url = opt("url");
    const label = (opt("texto") || "Registro (añadido a mano)").slice(0, 60);
    if (!/^https:\/\/[^\s]+$/.test(url) || /queueittoken/i.test(url)) return reply("El enlace tiene que empezar por https:// (y nunca un pase de cola).");
    const a = await env.DB.prepare("SELECT id, name FROM artist WHERE lower(name) = lower(?) LIMIT 1").bind(name).first<{ id: string; name: string }>();
    if (!a) return reply(`No sigo a «${name}». Usa \`/seguir\` primero.`);
    const iso = now.toISOString();
    await env.DB.batch([
      env.DB.prepare("INSERT INTO artist_signup_manual (artist_id, url, label, added_at) VALUES (?, ?, ?, ?) ON CONFLICT (artist_id, url) DO UPDATE SET label = excluded.label").bind(a.id, url, label, iso),
      env.DB.prepare("INSERT OR IGNORE INTO sheet_dirty (artist_id, since) VALUES (?, ?)").bind(a.id, iso),
    ]);
    return reply(`📝 Registro de **${a.name}** guardado: ${label}. Sale en su ficha en el próximo repaso (unos minutos).`);
  }
  if (i.data.name === "gmail") {
    // Solo administradores (el propietario): la clave permite mandar correos al Worker. La respuesta es efímera.
    if (!i.member?.permissions || (BigInt(i.member.permissions) & 8n) === 0n) return reply("Solo el propietario del servidor puede usar este comando.");
    return reply(
      [
        "📬 **Conectar tu Gmail** (solo lectura; solo lo ves tú)",
        "1. Abre <https://script.google.com> con la cuenta de Gmail donde te registras en las preventas → **Nuevo proyecto**.",
        `2. Pega el script: <${GMAIL_SCRIPT}> (botón *Raw*, copiar todo).`,
        "3. ⚙️ **Configuración del proyecto → Propiedades del script → Añadir**: `GIRA_TOKEN` =",
        `\`${await inboxToken(env)}\``,
        "4. Arriba elige la función `instalar` → **Ejecutar** → acepta los permisos de Google (leer Gmail y conectar con GIRA).",
        "Desde ese momento, cada 5 min lee tus correos nuevos de preventas y pone **un** código y **un** enlace por preventa en la ficha (🔐 Tu acceso). No guarda los correos.",
        "-# No compartas esta clave. Si la pierdes, vuelve a usar /gmail.",
      ].join("\n"),
    );
  }
  return reply("Comando desconocido.");
}

