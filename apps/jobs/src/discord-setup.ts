import { planGuildLayout, type ExistingChannel } from "@gira/core";
import { discord } from "./discord-api";

const token = process.env.DISCORD_BOT_TOKEN;
const guild = process.env.DISCORD_GUILD_ID ?? "1568641743853715516";
if (!token) throw new Error("Falta DISCORD_BOT_TOKEN");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const info = await discord<{ features: string[] }>(token, "GET", `/guilds/${guild}`);
const hasCommunity = info.features.includes("COMMUNITY");
const existing = await discord<ExistingChannel[]>(token, "GET", `/guilds/${guild}/channels`);
const ops = planGuildLayout(existing, hasCommunity);
console.log(`Comunidad: ${hasCommunity ? "sí" : "no"} · canales actuales: ${existing.length} · cambios: ${ops.length}`);

const categoryIds = new Map(existing.filter((c) => c.type === 4).map((c) => [c.name, c.id]));
let position = existing.length;
for (const op of ops) {
  if (op.op === "create_category") {
    const c = await discord<{ id: string }>(token, "POST", `/guilds/${guild}/channels`, { name: op.name, type: 4, position: position++ });
    categoryIds.set(op.name, c.id);
    console.log(`+ categoría ${op.name}`);
  } else {
    const parent_id = categoryIds.get(op.parent);
    await discord(token, "POST", `/guilds/${guild}/channels`, { name: op.name, type: op.type, parent_id, topic: op.topic });
    console.log(`+ #${op.name} (${op.parent})`);
  }
  await sleep(1000);
}
console.log(ops.length ? "Listo." : "0 cambios: el servidor ya tiene la estructura completa.");
