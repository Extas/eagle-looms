import { describe, expect, it } from "vitest";
import { sourceTagsFromGalleryMeta } from "../tags";
import { hanime1AuthorUrlsFromDocument, hanime1GalleryMetaFromDocument, hanime1PublishedAtFromDocument } from "./hanime1";

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

  it("maps comic metadata rows into gallery metadata", () => {
    const doc = parseDocument(`
      <section class="comics-panel-margin">
        <h3 class="title"> Gallery Title </h3>
        <h4 class="title"> Original Title </h4>
        <div class="comics-metadata-margin-top">
          <h5>作者：<a href="/search?artist=soha">soha blan</a></h5>
          <h5>角色：<a href="/search?character=nene">kusanagi nene</a></h5>
          <h5>標籤：<a href="/search?tag=school">school uniform</a></h5>
        </div>
      </section>
    `);

    const meta = hanime1GalleryMetaFromDocument(doc, "https://hanime1.me/comic/123");

    expect(meta.title).toBe("GalleryTitle");
    expect(meta.originTitle).toBe("OriginalTitle");
    expect(meta.authorUrls).toEqual(["https://hanime1.me/search?artist=soha"]);
    expect(meta.tags).toEqual({
      "作者": ["soha blan"],
      "角色": ["kusanagi nene"],
      "標籤": ["school uniform"],
    });
    expect(sourceTagsFromGalleryMeta(meta, "https://hanime1.me/comic/123")).toEqual([
      "author:soha blan",
      "character:kusanagi nene",
      "school uniform",
    ]);
  });
});
