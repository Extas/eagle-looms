import { describe, expect, it, vi } from "vitest";
import { comic18AuthorUrlsFromDocument, comic18PublishedAtFromDocument } from "./matchers/18comic";

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

describe("18comic matcher metadata", () => {
  it("extracts author URLs from data-type tag rows", () => {
    const doc = parseDocument(`
      <div class="tag-block">
        <span data-type="author">
          <a href="/search/photos?search_query=soha">soha blan</a>
          <a href="/search/photos?search_query=soha">duplicate</a>
        </span>
        <span data-type="character">
          <a href="/search/photos?search_query=nene">kusanagi nene</a>
        </span>
      </div>
    `);

    expect(comic18AuthorUrlsFromDocument(doc, "https://18comic.vip/album/123")).toEqual([
      "https://18comic.vip/search/photos?search_query=soha",
    ]);
  });

  it("extracts published dates from date-like data-type rows", () => {
    const doc = parseDocument(`
      <div class="tag-block">
        <span data-type="uploaded date">2026-06-14</span>
      </div>
    `);

    expect(comic18PublishedAtFromDocument(doc)).toBe("2026-06-14");
  });
});
