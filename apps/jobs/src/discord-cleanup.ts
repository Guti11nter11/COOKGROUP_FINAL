import { discord } from "./discord-api";

// Borra los mensajes del bot publicados en los canales de avisos desde SINCE (incidente del
// 2026-11-07: avisos de fechas que no eran nuevas). Solo mensajes propios del bot.
const token = process.env.DISCORD_BOT_TOKEN;
const guild = process.env.DISCORD_GUILD_ID ?? "1568641743853715516";
const since = Date.parse(process.env.SINCE ?? "2026-11-07T20:30:00Z");
if (!token) throw new Error("Falta DISCORD_BOT_TOKEN");
const CHANNELS = new Set(["nuevas-giras", "fechas-extra", "preventas", "nfl", "futbol", "f1", "tenis", "otros-deportes"]);
const DISCORD_EPOCH = 1420070400000n;
const snowflake = (ms: number) => ((BigInt(ms) - DISCORD_EPOCH) << 22n).toString();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const me = await discord<{ id: string }>(token, "GET", "/users/@me");
const channels = (await discord<{ id: string; name: string; type: number }[]>(token, "GET", `/guilds/${guild}/channels`)).filter(
  (c) => c.type === 0 && CHANNELS.has(c.name),
);
let total = 0;
for (const ch of channels) {
  let after = snowflake(since);
  const mine: string[] = [];
  for (;;) {
    const msgs = await discord<{ id: string; author: { id: string } }[]>(token, "GET", `/channels/${ch.id}/messages?after=${after}&limit=100`);
    if (!msgs.length) break;
    mine.push(...msgs.filter((m) => m.author.id === me.id).map((m) => m.id));
    after = msgs.map((m) => m.id).sort((a, b) => (BigInt(a) < BigInt(b) ? 1 : -1))[0]!;
    if (msgs.length < 100) break;
  }
  for (let i = 0; i < mine.length; i += 100) {
    const part = mine.slice(i, i + 100);
    if (part.length >= 2) await discord(token, "POST", `/channels/${ch.id}/messages/bulk-delete`, { messages: part });
    else await discord(token, "DELETE", `/channels/${ch.id}/messages/${part[0]}`);
    await sleep(1100);
  }
  total += mine.length;
  console.log(`#${ch.name}: ${mine.length} borrados`);
}
console.log(`Total borrados: ${total}`);
