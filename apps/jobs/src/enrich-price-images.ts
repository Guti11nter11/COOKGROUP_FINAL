import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { pricesByCountry, type EnrichTodo } from "@gira/core";
import { gira } from "./gira-client";
import { priceCardHtml } from "./price-image-lib";

type Page = { setContent: (h: string, o?: unknown) => Promise<void>; $: (s: string) => Promise<{ screenshot: (o: unknown) => Promise<Buffer> } | null>; close: () => Promise<void> };
type Browser = { newPage: (o?: unknown) => Promise<Page>; close: () => Promise<void> };

/** Imagen de precios oficiales por artista (solo si cambió): JPEG nítido y ligero para Discord. */
export async function uploadPriceImages(artists: EnrichTodo["artists"]): Promise<{ uploaded: number }> {
  const todo = artists
    .filter((a) => a.prices.length)
    .map((a) => {
      const rows = pricesByCountry(a.prices);
      return { a, rows, hash: createHash("sha1").update(JSON.stringify([a.name, rows])).digest("hex").slice(0, 16) };
    })
    .filter((x) => x.hash !== x.a.priceImageHash);
  if (!todo.length) return { uploaded: 0 };
  const { chromium } = createRequire(import.meta.url)("playwright") as { chromium: { launch: () => Promise<Browser> } };
  const browser = await chromium.launch();
  let uploaded = 0;
  try {
    for (const { a, rows, hash } of todo.slice(0, 20)) {
      const page = await browser.newPage({ deviceScaleFactor: 1.5 });
      try {
        await page.setContent(priceCardHtml(a.name, null, rows), { waitUntil: "networkidle" });
        const shot = await (await page.$("#card"))!.screenshot({ type: "jpeg", quality: 88 });
        const r = await gira<{ stored: boolean }>("/enrich/price-image", { artistId: a.artistId, hash, mime: "image/jpeg", data: shot.toString("base64") });
        if (r.stored) uploaded++;
        console.log(`${r.stored ? "✓" : "⚠️"} ${a.name}: imagen de precios (${rows.length} países, ${Math.round(shot.length / 1024)} KB)`);
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
  return { uploaded };
}
