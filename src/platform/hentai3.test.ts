import { describe, expect, it, vi } from "vitest";
import { hentai3AuthorUrlsFromDocument, hentai3PublishedAtFromDocument } from "./matchers/3hentai";

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

describe("3Hentai matcher metadata", () => {
  it("extracts author URLs from direct-text tag rows", () => {
    const doc = parseDocument(`
      <section id="main-info">
        <div class="tag-container field-name">
          Artist:
          <a href="/artist/soha-blan"><span class="filter-elem">soha blan</span></a>
          <a href="/artist/soha-blan"><span class="filter-elem">duplicate</span></a>
        </div>
        <div class="tag-container field-name">
          Character:
          <a href="/character/kusanagi-nene"><span class="filter-elem">kusanagi nene</span></a>
        </div>
      </section>
    `);

    expect(hentai3AuthorUrlsFromDocument(doc, "https://3hentai.net/d/123")).toEqual([
      "https://3hentai.net/artist/soha-blan",
    ]);
  });

  it("extracts published dates from direct-text tag rows", () => {
    const doc = parseDocument(`
      <section id="main-info">
        <div class="tag-container field-name">
          Published:
          <span class="filter-elem">2026-06-14</span>
        </div>
      </section>
    `);

    expect(hentai3PublishedAtFromDocument(doc)).toBe("2026-06-14");
  });
});
