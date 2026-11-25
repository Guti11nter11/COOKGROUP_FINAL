import { describe, expect, it } from "vitest";
import { articleLinks, parseFeed } from "../src/articles-lib";

const rss = `<?xml version="1.0"?><rss><channel>
<item><title>Chase Atlantic announce 2027 European tour</title><link>https://discover.ticketmaster.co.uk/music/chase-atlantic-tour-2027-1/</link><pubDate>Wed, 25 Nov 2026 10:00:00 +0000</pubDate><description><![CDATA[Presale sign up now open]]></description></item>
<item><title>Best Christmas markets</title><link>https://discover.ticketmaster.co.uk/things-to-do/xmas-2/</link><pubDate>Wed, 25 Nov 2026 09:00:00 +0000</pubDate><description>Markets</description></item>
</channel></rss>`;

describe("artículos de los blogs de Ticketmaster", () => {
  it("lee el feed: título, enlace, fecha y resumen", () => {
    expect(parseFeed(rss)).toEqual([
      { title: "Chase Atlantic announce 2027 European tour", link: "https://discover.ticketmaster.co.uk/music/chase-atlantic-tour-2027-1/", pubDate: "Wed, 25 Nov 2026 10:00:00 +0000", description: "Presale sign up now open" },
      { title: "Best Christmas markets", link: "https://discover.ticketmaster.co.uk/things-to-do/xmas-2/", pubDate: "Wed, 25 Nov 2026 09:00:00 +0000", description: "Markets" },
    ]);
  });
  it("del artículo saca los registros de preventa (no las fichas de venta ni las redes)", () => {
    const html = `<p>Sign up for the presale <a href="https://drop.cobrand.com/d/ChaseAtlantic/dontlookdown">here</a>.
      O2 customers get <a href="https://priority.o2.co.uk/">Priority</a>. <a href="https://www.ticketmaster.co.uk/chase-atlantic-tickets/artist/1">Tickets</a>
      <a href="https://www.instagram.com/chaseatlantic">IG</a> <a href="https://signup.livenation.com/chaseatlantic?utm_source=x">LN</a></p>`;
    expect(articleLinks(html)).toEqual([
      { url: "https://drop.cobrand.com/d/ChaseAtlantic/dontlookdown", label: "Cobrand (registro)" },
      { url: "https://signup.livenation.com/chaseatlantic", label: "Live Nation (registro)" },
    ]);
  });
});
