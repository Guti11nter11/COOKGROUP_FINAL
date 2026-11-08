import { describe, expect, it } from "vitest";
import { instagramHandle } from "../src/social-lib";

describe("Instagram oficial desde MusicBrainz", () => {
  it("toma la cuenta vigente y descarta enlaces a publicaciones", () => {
    expect(
      instagramHandle([
        { type: "social network", url: { resource: "https://www.instagram.com/p/ABC/" } },
        { type: "social network", ended: true, url: { resource: "https://www.instagram.com/vieja/" } },
        { type: "social network", url: { resource: "https://www.instagram.com/u2/" } },
      ]),
    ).toBe("u2");
    expect(instagramHandle([{ url: { resource: "https://twitter.com/u2" } }])).toBeNull();
  });
});
