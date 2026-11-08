import { gira } from "./gira-client";

/** Imprime el texto de las fichas activas (datos públicos) para revisar formato y contenido. */
const sheets = await gira<{ name: string; messages: string[] }[]>("/enrich/preview");
for (const s of sheets) console.log(`\n########## ${s.name}\n${s.messages.join("\n\n—— (mensaje siguiente) ——\n\n")}`);
