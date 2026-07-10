import { describe, expect, it } from "vitest";
import { sourceTagsFromGalleryMeta } from "../tags";
import { rokuHentaiAuthorUrlsFromDocument, rokuHentaiGalleryMetaFromDocument, rokuHentaiPublishedAtFromDocument, rokuHentaiTagsFromDocument } from "./rokuhentai";

function parseDocument(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

describe("RokuHentai Eagle metadata adapter", () => {
  it("parses categorized data-tag metadata", () => {
    const doc = parseDocument(`
      <a href="/tag/artist/soha"><div class="mdc-chip"><span class="site-tag-count" data-tag='artist:"soha blan"'></span></div></a>
      <a href="/tag/character/nene"><div class="mdc-chip"><span class="site-tag-count" data-tag='character:"kusanagi nene"'></span></div></a>
    `);

    expect(rokuHentaiTagsFromDocument(doc)).toEqual([
      { category: "artist", value: "soha blan", href: "/tag/artist/soha" },
      { category: "character", value: "kusanagi nene", href: "/tag/character/nene" },
    ]);
  });

  it("extracts author URLs from author-like data-tag categories", () => {
    const doc = parseDocument(`
      <a href="/tag/artist/soha"><div class="mdc-chip"><span class="site-tag-count" data-tag='artist:"soha blan"'></span></div></a>
      <a href="/tag/artist/soha"><div class="mdc-chip"><span class="site-tag-count" data-tag='artist:"duplicate"'></span></div></a>
      <a href="/tag/character/nene"><div class="mdc-chip"><span class="site-tag-count" data-tag='character:"kusanagi nene"'></span></div></a>
    `);

    expect(rokuHentaiAuthorUrlsFromDocument(doc, "https://rokuhentai.com/gallery")).toEqual([
      "https://rokuhentai.com/tag/artist/soha",
    ]);
  });

  it("builds gallery metadata from categorized data-tag chips", () => {
    const doc = parseDocument(`
      <h1 class="site-manga-info__title-text"> Roku Gallery </h1>
      <a href="/tag/artist/soha"><div class="mdc-chip"><span class="site-tag-count" data-tag='artist:"soha blan"'></span></div></a>
      <a href="/tag/character/nene"><div class="mdc-chip"><span class="site-tag-count" data-tag='character:"kusanagi nene"'></span></div></a>
      <a href="/tag/tag/school"><div class="mdc-chip"><span class="site-tag-count" data-tag='tag:"school uniform"'></span></div></a>
    `);

    const meta = rokuHentaiGalleryMetaFromDocument(doc, "https://rokuhentai.com/gallery");

    expect(meta.title).toBe("Roku Gallery");
    expect(meta.originTitle).toBe("Roku Gallery");
    expect(meta.authorUrls).toEqual(["https://rokuhentai.com/tag/artist/soha"]);
    expect(sourceTagsFromGalleryMeta(meta, "https://rokuhentai.com/gallery")).toEqual([
      "author:soha blan",
      "character:kusanagi nene",
      "school uniform",
    ]);
  });

  it("extracts published dates from date-like data-tag categories", () => {
    const doc = parseDocument(`
      <div class="mdc-chip"><span class="site-tag-count" data-tag='published:"2026-06-14"'></span></div>
    `);

    expect(rokuHentaiPublishedAtFromDocument(doc)).toBe("2026-06-14");
  });
});
