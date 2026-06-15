import { describe, expect, it, vi } from "vitest";
import { nhentaiPublishedAt, nhentaiPublishedAtFromDocument } from "./matchers/nhentai";

vi.mock("$", () => ({
  GM: {
    xmlHttpRequest: () => undefined,
  },
  GM_getValue: () => null,
  GM_setValue: () => undefined,
}));

function parseDocument(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

describe("nhentai matcher metadata", () => {
  it("derives published timestamps from API upload dates", () => {
    expect(nhentaiPublishedAt({ upload_date: 1781411696 })).toBe("1781411696");
    expect(nhentaiPublishedAt({ upload_date: "" })).toBe("");
  });

  it("derives published timestamps from structured document dates", () => {
    const doc = parseDocument(`
      <html><head>
        <meta property="article:published_time" content="2026-06-14T08:00:00Z">
      </head><body></body></html>
    `);

    expect(nhentaiPublishedAtFromDocument(doc)).toBe("2026-06-14T08:00:00Z");
  });

  it("falls back to uploaded text dates", () => {
    const doc = parseDocument(`
      <html><body>
        <section>Uploaded: 2026-06-14 08:00:00</section>
      </body></html>
    `);

    expect(nhentaiPublishedAtFromDocument(doc)).toBe("2026-06-14 08:00:00");
  });
});
