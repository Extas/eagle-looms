import { describe, expect, it } from "vitest";
import { sourceTagsFromGalleryMeta } from "../tags";
import { imHentaiGalleryMetaFromDocument, imHentaiPublishedAtFromDocument } from "./im-hentai";

function parseDocument(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

describe("im-hentai Eagle metadata adapter", () => {
  it("builds gallery metadata from detail headings and info rows", () => {
    const doc = parseDocument(`
      <div class="right_details">
        <h1> Main Title </h1>
        <p class="subtitle"> Original Title </p>
      </div>
      <ul class="galleries_info">
        <li><span class="tags_text">Artist:</span><a class="tag" href="/artist/soha">soha blan</a></li>
        <li><span class="tags_text">Character:</span><a class="tag" href="/character/nene">kusanagi nene</a></li>
        <li><span class="tags_text">Tags:</span><a class="tag" href="/tag/school">school uniform</a></li>
      </ul>
    `);

    const meta = imHentaiGalleryMetaFromDocument(doc, "https://imhentai.xxx/gallery/123/");

    expect(meta.title).toBe("Main Title");
    expect(meta.originTitle).toBe("Original Title");
    expect(meta.authorUrls).toEqual(["https://imhentai.xxx/artist/soha"]);
    expect(sourceTagsFromGalleryMeta(meta, "https://imhentai.xxx/gallery/123/")).toEqual([
      "author:soha blan",
      "character:kusanagi nene",
      "school uniform",
    ]);
  });

  it("derives published dates from gallery info list rows", () => {
    const doc = parseDocument(`
      <ul class="galleries_info">
        <li><span class="tags_text">Artist:</span><a class="tag">soha blan</a></li>
        <li><span class="tags_text">Upload Date:</span>2026-06-14 08:00:00</li>
      </ul>
    `);

    expect(imHentaiPublishedAtFromDocument(doc)).toBe("2026-06-14 08:00:00");
  });
});
