import { describe, expect, it } from "vitest";
import { sourceTagsFromGalleryMeta } from "../tags";
import { comic18AuthorUrlsFromDocument, comic18GalleryMetaFromDocument, comic18PublishedAtFromDocument } from "./comic18";

function parseDocument(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

describe("18comic Eagle metadata adapter", () => {
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

  it("builds gallery metadata from title, tags, and author URLs", () => {
    const doc = parseDocument(`
      <div class="panel-heading"><h2>  My Gallery  </h2></div>
      <div class="tag-block">
        <span data-type="author"><a href="/search/photos?search_query=soha">soha blan</a></span>
        <span data-type="character"><a href="/search/photos?search_query=nene">kusanagi nene</a></span>
        <span data-type="tag"><a href="/search/photos?search_query=school">school uniform</a></span>
      </div>
    `);

    const meta = comic18GalleryMetaFromDocument(doc, "https://18comic.vip/album/123");

    expect(meta.title).toBe("My Gallery");
    expect(meta.originTitle).toBe("My Gallery");
    expect(meta.authorUrls).toEqual(["https://18comic.vip/search/photos?search_query=soha"]);
    expect(sourceTagsFromGalleryMeta(meta, "https://18comic.vip/album/123")).toEqual([
      "author:soha blan",
      "character:kusanagi nene",
      "school uniform",
    ]);
  });

  it("extracts published dates from date-like tag rows", () => {
    const doc = parseDocument(`
      <div class="tag-block">
        <span data-type="uploaded date">2026-06-14</span>
      </div>
    `);

    expect(comic18PublishedAtFromDocument(doc)).toBe("2026-06-14");
  });
});
