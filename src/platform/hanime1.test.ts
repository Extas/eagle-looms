import { describe, expect, it, vi } from "vitest";
import { hanime1AuthorUrlsFromDocument, hanime1PublishedAtFromDocument } from "./matchers/hanime1";

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

describe("Hanime1 matcher metadata", () => {
  it("extracts author URLs from author-like metadata rows", () => {
    const doc = parseDocument(`
      <section class="comics-panel-margin">
        <div class="comics-metadata-margin-top">
          <h5>作者：<a href="/search?artist=soha">soha blan</a></h5>
          <h5>角色：<a href="/search?character=nene">kusanagi nene</a></h5>
        </div>
      </section>
    `);

    expect(hanime1AuthorUrlsFromDocument(doc, "https://hanime1.me/comic/123")).toEqual([
      "https://hanime1.me/search?artist=soha",
    ]);
  });

  it("extracts published dates from date-like metadata rows", () => {
    const doc = parseDocument(`
      <section class="comics-panel-margin">
        <div class="comics-metadata-margin-top">
          <h5>上傳日期：2026-06-14</h5>
        </div>
      </section>
    `);

    expect(hanime1PublishedAtFromDocument(doc)).toBe("2026-06-14");
  });
});
