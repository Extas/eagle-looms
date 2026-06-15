import { describe, expect, it } from "vitest";
import { rokuHentaiAuthorUrlsFromDocument, rokuHentaiPublishedAtFromDocument, rokuHentaiTagsFromDocument } from "./rokuhentai";

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

  it("extracts published dates from date-like data-tag categories", () => {
    const doc = parseDocument(`
      <div class="mdc-chip"><span class="site-tag-count" data-tag='published:"2026-06-14"'></span></div>
    `);

    expect(rokuHentaiPublishedAtFromDocument(doc)).toBe("2026-06-14");
  });
});
