import type { PushSubscription } from "@block65/webcrypto-web-push";
import { currentSession } from "./auth";
import { icsToken, loadSlots } from "./calendar";
import type { Env } from "./env";
import { saveSubscription, vapidKeys } from "./push";
import { renderSheetFor } from "./sheets";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store", "X-Robots-Tag": "noindex, nofollow" } });

/** API privada de la app (/api/*, salvo /api/auth/*): exige sesión. */
export async function handleApi(env: Env, req: Request, url: URL): Promise<Response> {
  if (!(await currentSession(env, req))) return json({ error: "Inicia sesión con Face ID" }, 401);
  const now = new Date();

  if (url.pathname === "/api/feed") {
    const slots = await loadSlots(env, now);
    const { results: active } = await env.DB.prepare(
      "SELECT h.artist_id, h.channel_id, h.rendered_json, a.name FROM sheet h JOIN artist a ON a.id = h.artist_id WHERE h.status = 'active' ORDER BY h.updated_at DESC LIMIT 80",
    ).all<{ artist_id: string; channel_id: string; rendered_json: string | null; name: string }>();
    // La ficha ya renderizada al publicarla; solo se calcula aquí (como mucho 3) si aún no está guardada.
    const sheets = [];
    let rendered = 0;
    for (const a of active) {
      if (a.rendered_json) sheets.push({ artistId: a.artist_id, channelId: a.channel_id, name: a.name, messages: JSON.parse(a.rendered_json) as string[] });
      else if (rendered++ < 3) {
        const s = await renderSheetFor(env, a.artist_id, now);
        if (s) sheets.push({ artistId: a.artist_id, channelId: a.channel_id, ...s });
      }
    }
    const { results: news } = await env.DB.prepare(
      "SELECT artist_name, title, url, source, category, summary, published_at, created_at FROM news ORDER BY created_at DESC LIMIT 80",
    ).all();
    return json({ generatedAt: now.toISOString(), guildId: env.DISCORD_GUILD_ID, slots, sheets, news });
  }
  if (url.pathname === "/api/calendar") {
    return json({ url: `${url.origin.replace(/^https:/, "webcal:")}/calendar.ics?t=${await icsToken(env)}` });
  }
  if (url.pathname === "/api/push/key") return json({ publicKey: (await vapidKeys(env)).publicKey });
  if (url.pathname === "/api/push/subscribe" && req.method === "POST") {
    return json({ ok: await saveSubscription(env, (await req.json()) as PushSubscription) });
  }
  return json({ error: "No encontrado" }, 404);
}
