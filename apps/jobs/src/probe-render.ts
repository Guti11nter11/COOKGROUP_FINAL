/** Diagnóstico puntual: renderiza URLs con Browser Run y muestra formularios de búsqueda y enlaces útiles. */
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID;
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const urls = (process.env.URLS ?? "").split(/\s+/).filter(Boolean);
for (const url of urls) {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/browser-rendering/content`, {
    method: "POST",
    headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ url, gotoOptions: { waitUntil: "networkidle2", timeout: 30000 }, rejectResourceTypes: ["image", "media", "font"] }),
  });
  const html = res.ok ? (((await res.json()) as { result?: string }).result ?? "") : "";
  console.log(`\n== ${url} → HTTP ${res.status} · ${html.length} bytes · título: ${/<title[^>]*>([^<]*)/i.exec(html)?.[1]?.trim() ?? "-"}`);
  for (const m of html.matchAll(/<form\b[^>]*>/gi)) console.log("  form:", m[0].slice(0, 200));
  for (const m of html.matchAll(/<input\b[^>]*(search|query|term|q)[^>]*>/gi)) console.log("  input:", m[0].slice(0, 200));
  const links = [...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)].map((m) => `${m[1]} | ${m[2]!.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 60)}`);
  for (const l of links.filter((l) => /(u2|oasis|buscar|search|concierto|music|event|artist)/i.test(l)).slice(0, 25)) console.log("  a:", l);
  await new Promise((r) => setTimeout(r, 10_000));
}
export {};
