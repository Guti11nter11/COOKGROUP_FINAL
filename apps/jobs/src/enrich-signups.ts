import { createRequire } from "node:module";
import type { EnrichInput, EnrichTodo } from "@gira/core";
import { getJson } from "./gira-client";
import { readFileSync } from "node:fs";
import { cleanUrl, deadPage, homepageGuesses, labelFor, outOfScope, pickSignups, presaleSignal, SHORT, titleMatches, type RawLink } from "./signups-lib";

/** Registros que el propietario ya conoce (data/watchlist.json): se añaden siempre a su ficha. */
type Watch = { entity: string; kind: string; url?: string };
const fold = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const watchlist: Watch[] = (() => {
  try {
    return (JSON.parse(readFileSync("data/watchlist.json", "utf8")) as { items: Watch[] }).items;
  } catch {
    return [];
  }
})();

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Web oficial desde MusicBrainz ("official homepage"). */
async function homepageOf(mbid: string | null): Promise<string | null> {
  if (!mbid) return null;
  const data = await getJson<{ relations?: { type: string; ended?: boolean; url?: { resource: string } }[] }>(
    `https://musicbrainz.org/ws/2/artist/${mbid}?inc=url-rels&fmt=json`,
  );
  await pause(1100); // MusicBrainz: 1 petición por segundo
  const rel = data?.relations?.find((r) => r.type === "official homepage" && !r.ended && r.url?.resource.startsWith("http"));
  return rel?.url?.resource.replace(/^http:/, "https:") ?? null;
}

const UA = "Mozilla/5.0 (compatible; GIRA personal tour radar; +https://github.com/Guti11nter11/COOKGROUP_FINAL)";

/** Sin web en MusicBrainz: «nombre.com» y variantes, solo si el título de la página nombra al artista. */
async function guessHomepage(name: string): Promise<string | null> {
  for (const url of homepageGuesses(name)) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow", signal: AbortSignal.timeout(12000) });
      if (!res.ok) continue;
      const title = /<title[^>]*>([^<]*)/i.exec((await res.text()).slice(0, 60000))?.[1] ?? "";
      if (titleMatches(title, name)) return res.url || url;
    } catch {
      /* siguiente */
    }
  }
  return null;
}

/** Adónde lleva un enlace corto (lnk.to/presale → drop.cobrand.com/…): solo se leen las redirecciones. */
async function resolveShort(url: string): Promise<string> {
  let cur = url;
  for (let hop = 0; hop < 4; hop++) {
    try {
      const res = await fetch(cur, { method: "GET", headers: { "User-Agent": UA }, redirect: "manual", signal: AbortSignal.timeout(10000) });
      const loc = res.headers.get("location");
      if (res.status < 300 || res.status >= 400 || !loc) break;
      cur = new URL(loc, cur).toString();
    } catch {
      break;
    }
  }
  return cleanUrl(cur) ?? url;
}

/** Plataformas de registro con protección antibots: no se abren (solo se enlazan). */
const NO_PROBE = /^(drop\.cobrand\.com|signup\.livenation\.com|signup\.ticketmaster\.[a-z.]+|verifiedfan\.ticketmaster\.[a-z.]+)$/;

type Browser = { newPage: (o?: unknown) => Promise<Page>; close: () => Promise<void> };
type Page = {
  goto: (u: string, o?: unknown) => Promise<unknown>;
  waitForTimeout: (ms: number) => Promise<void>;
  $$eval: <T>(sel: string, fn: (els: Element[]) => T) => Promise<T>;
  close: () => Promise<void>;
};

/** Enlaces de una página ya renderizada (los widgets de giras se pintan con JavaScript). */
async function linksOf(browser: Browser, url: string): Promise<RawLink[]> {
  const page = await browser.newPage({ userAgent: "Mozilla/5.0 (compatible; GIRA personal tour radar; +https://github.com/Guti11nter11/COOKGROUP_FINAL)" });
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 40000 }).catch(() => undefined);
    await page.waitForTimeout(3000);
    return await page.$$eval("a[href]", (as) =>
      as.map((a) => {
        let ctx = a as Element;
        for (let i = 0; i < 4 && ctx.parentElement && (ctx.textContent ?? "").length < 60; i++) ctx = ctx.parentElement;
        return { text: ((a as HTMLElement).innerText ?? "").trim().slice(0, 80), href: (a as HTMLAnchorElement).href, context: (ctx.textContent ?? "").replace(/\s+/g, " ").slice(0, 300) };
      }),
    );
  } finally {
    await page.close();
  }
}

/** El enlace abre una página que existe (no "page not found"). Ante la duda, se considera vivo. */
async function isAlive(browser: Browser, url: string): Promise<boolean> {
  const page = await browser.newPage({ userAgent: "Mozilla/5.0 (compatible; GIRA personal tour radar; +https://github.com/Guti11nter11/COOKGROUP_FINAL)" });
  try {
    const res = (await page.goto(url, { waitUntil: "networkidle", timeout: 30000 }).catch(() => null)) as { status?: () => number } | null;
    if (res?.status && res.status() === 404) return false;
    await page.waitForTimeout(1500);
    const text = await page.$$eval("body", (b) => (b[0] as HTMLElement | undefined)?.innerText ?? "");
    return !deadPage(text.slice(0, 3000));
  } catch {
    return true;
  } finally {
    await page.close();
  }
}

/** Busca dónde registrarse para las preventas del artista en su web oficial (y su página de gira). */
export async function findSignups(artists: EnrichTodo["artists"], max = 25, onlyPresale = false): Promise<NonNullable<EnrichInput["signups"]>> {
  // Primero los que tienen la preventa más cerca.
  const todo = artists
    .filter((a) => a.needsSignup)
    .sort((a, b) => (a.firstSale ?? "9999").localeCompare(b.firstSale ?? "9999"))
    .slice(0, max);
  if (!todo.length) return [];
  // Playwright se instala solo en el trabajo de Actions (no es dependencia del repo).
  const { chromium } = createRequire(import.meta.url)("playwright") as { chromium: { launch: () => Promise<Browser> } };
  const browser = await chromium.launch();
  const out: NonNullable<EnrichInput["signups"]> = [];
  try {
    for (const a of todo) {
      const mine = watchlist.filter((w) => fold(w.entity) === fold(a.name) && w.url);
      const homepage = a.homepage ?? mine.find((w) => w.kind === "official_site")?.url ?? (await homepageOf(a.mbid)) ?? (await guessHomepage(a.name));
      const known = pickSignups(
        mine.filter((w) => w.kind === "registration" || w.kind === "drop").map((w) => ({ text: "Registro", href: w.url!, context: "" })),
        a.when,
        "",
      );
      if (!homepage) {
        if (known.length) out.push({ artistId: a.artistId, links: known });
        console.log(`${known.length ? "✓" : "·"} ${a.name}: sin web oficial conocida${known.length ? ` · ${known.length} registro(s) de la lista` : ""}`);
        continue;
      }
      const host = new URL(homepage).hostname.replace(/^www\./, "");
      const raw = await linksOf(browser, homepage);
      // Página de gira de la misma web, si la hay.
      const tour = raw.find((l) => /^(tour|tours|live|dates|shows|events|conciertos|gira|tickets)$/i.test(l.text) && l.href.includes(host));
      if (tour) raw.push(...(await linksOf(browser, tour.href)));
      // Su Linktree, si la web lo enlaza (ahí suelen ir los registros de preventa).
      const tree = raw.find((l) => /^https:\/\/(www\.)?linktr\.ee\/[^/?#]+/.test(l.href));
      if (tree) raw.push(...(await linksOf(browser, tree.href)));
      const picked = pickSignups(raw, a.when, host);
      // Sin fechas todavía: solo lo que apunta a una preventa o gira, no la newsletter de siempre.
      const found = onlyPresale ? picked.filter((f) => presaleSignal(f, raw.find((r) => cleanUrl(r.href) === f.url))) : picked;
      // Solo enlaces vivos y de países cubiertos (un registro antiguo de Australia no sirve).
      const alive: typeof found = [];
      for (const f of found.filter((x) => !outOfScope(x.url)).slice(0, 8)) {
        // Enlace corto: se mira adónde lleva para nombrar la plataforma (y enlazarla directamente).
        if (SHORT.test(new URL(f.url).hostname.replace(/^www\./, ""))) {
          const to = await resolveShort(f.url);
          const label = labelFor(to);
          if (label) Object.assign(f, { url: to, label });
        }
        if (NO_PROBE.test(new URL(f.url).hostname) || (await isAlive(browser, f.url))) alive.push(f);
      }
      const links = [...known, ...alive.filter((f) => !known.some((k) => k.url === f.url))];
      out.push({ artistId: a.artistId, homepage, links });
      console.log(`${links.length ? "✓" : "·"} ${a.name} (${homepage}): ${links.map((l) => `${l.label}${l.city ? ` ${l.city}` : ""}`).join(", ") || "sin enlaces de registro"}`);
      await pause(1000);
    }
  } finally {
    await browser.close();
  }
  return out;
}
