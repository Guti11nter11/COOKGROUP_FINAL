import { Readable } from "node:stream";
import { gzipSync } from "node:zlib";
import { it, expect } from "vitest";
import { parseFeedStream } from "../src/tm-feed";

const doc = { countryCode: "ES", events: [{ eventId: "a", eventName: "Uno" }, { eventId: "b", eventName: "Dos" }] };

it("lee los eventos de un feed comprimido en streaming", async () => {
  const out: unknown[] = [];
  for await (const e of parseFeedStream(Readable.from([gzipSync(JSON.stringify(doc))]), true)) out.push(e);
  expect(out).toEqual(doc.events);
});

it("y sin comprimir, troceado en varios fragmentos", async () => {
  const text = JSON.stringify(doc);
  const out: unknown[] = [];
  for await (const e of parseFeedStream(Readable.from([text.slice(0, 7), text.slice(7, 30), text.slice(30)]), false)) out.push(e);
  expect(out.map((e) => (e as { eventId: string }).eventId)).toEqual(["a", "b"]);
});
