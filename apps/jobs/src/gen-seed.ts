import { readFileSync, writeFileSync } from "node:fs";
import { buildSeedSql, type ResolvedArtist } from "./seed-sql";

const artists: ResolvedArtist[] = JSON.parse(readFileSync("data/artists.resolved.json", "utf8"));
writeFileSync("apps/worker/seed/artists.sql", buildSeedSql(artists));
console.log(`apps/worker/seed/artists.sql: ${artists.filter((a) => a.tmAttractionId).length} artistas`);
