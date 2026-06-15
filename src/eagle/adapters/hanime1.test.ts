import { describe, expect, it } from "vitest";
import { hanime1AuthorUrlsFromDocument, hanime1PublishedAtFromDocument } from "./hanime1";

function parseDocument(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

describe("Hanime1 Eagle metadata adapter", () => {
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
