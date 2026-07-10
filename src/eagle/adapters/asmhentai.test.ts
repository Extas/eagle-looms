import { describe, expect, it } from "vitest";
import { sourceTagsFromGalleryMeta } from "../tags";
import { asmHentaiAuthorUrlsFromDocument, asmHentaiGalleryMetaFromDocument, asmHentaiPublishedAtFromDocument } from "./asmhentai";

function parseDocument(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

describe("AsmHentai Eagle metadata adapter", () => {
  it("extracts author URLs from author-like detail tags", () => {
    const doc = parseDocument(`
      <section class="right">
        <div class="info">
          <ul>
            <li class="tags">
              <h3>Artist:</h3>
              <div class="tag_list">
                <a href="https://asmhentai.com/artist/soha-blan/"><span>soha blan</span></a>
              </div>
            </li>
            <li class="tags">
              <h3>Tags:</h3>
              <div class="tag_list">
                <a href="/tag/school-uniform/"><span>school uniform</span></a>
              </div>
            </li>
          </ul>
        </div>
      </section>
    `);

    expect(asmHentaiAuthorUrlsFromDocument(doc)).toEqual([
      "https://asmhentai.com/artist/soha-blan/",
    ]);
  });

  it("extracts published dates from detail tags", () => {
    const doc = parseDocument(`
      <section class="right">
        <div class="info">
          <ul>
            <li class="tags"><h3>Published:</h3>2026-06-14</li>
          </ul>
        </div>
      </section>
    `);

    expect(asmHentaiPublishedAtFromDocument(doc)).toBe("2026-06-14");
  });

  it("maps detail tags into gallery metadata", () => {
    const doc = parseDocument(`
      <section class="right">
        <div class="info">
          <h1> Gallery Title </h1>
          <h2> Original Title </h2>
          <ul>
            <li class="tags">
              <h3>Artist:</h3>
              <div class="tag_list">
                <a href="/artist/soha-blan/"><span>soha blan</span></a>
              </div>
            </li>
            <li class="tags">
              <h3>Tags:</h3>
              <div class="tag_list">
                <a href="/tag/school-uniform/"><span>school uniform</span></a>
              </div>
            </li>
          </ul>
        </div>
      </section>
    `);

    const meta = asmHentaiGalleryMetaFromDocument(doc, "https://asmhentai.com/g/123/");

    expect(meta.title).toBe("Gallery Title");
    expect(meta.originTitle).toBe("Original Title");
    expect(meta.authorUrls).toEqual(["https://asmhentai.com/artist/soha-blan/"]);
    expect(meta.tags).toEqual({
      artist: ["soha blan"],
      tags: ["school uniform"],
    });
    expect(sourceTagsFromGalleryMeta(meta, "https://asmhentai.com/g/123/")).toEqual([
      "author:soha blan",
      "school uniform",
    ]);
  });
});
