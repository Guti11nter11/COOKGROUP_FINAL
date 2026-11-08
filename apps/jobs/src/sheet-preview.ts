import { gira } from "./gira-client";

/** Fuerza una pasada de publicación (resultado y errores de Discord, sin contenido privado). */
console.log(`Publicación: ${JSON.stringify(await gira("/enrich/publish", {}))}`);

/** Imprime el texto de las fichas activas (datos públicos) para revisar formato y contenido. */
const sheets = await gira<{ name: string; messages: string[] }[]>("/enrich/preview");
for (const s of sheets) console.log(`\n########## ${s.name}\n${s.messages.join("\n\n—— (mensaje siguiente) ——\n\n")}`);
