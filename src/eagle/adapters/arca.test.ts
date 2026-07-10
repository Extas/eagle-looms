import { describe, expect, it } from "vitest";
import { sourceTagsFromGalleryMeta } from "../tags";
import { arcaChannelFromUrl, arcaGalleryMetaFromDocument, arcaPublishedAtFromDocument } from "./arca";

function parseDocument(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

describe("Arcalive Eagle metadata adapter", () => {
  it("derives channel metadata from article URLs", () => {
    expect(arcaChannelFromUrl("https://arca.live/b/art/123")).toBe("art");
  });

  it("maps article metadata into gallery source tags", () => {
    const doc = parseDocument(`
      <meta property="og:title" content=" Article title ">
      <meta name="author" content="meta author">
      <div class="article-head">
        <span class="user-info"><a href="/u/source-author"> source author </a></span>
      </div>
      <time datetime="2026-06-14T08:00:00Z">2026-06-14</time>
      <div class="article-content"><img src="https://ac-p2.namu.la/image.jpg"></div>
    `);

    const meta = arcaGalleryMetaFromDocument(doc, "https://arca.live/b/art/123");

    expect(meta.title).toBe("Article title");
    expect(meta.authorUrls).toEqual(["https://arca.live/u/source-author"]);
    expect(sourceTagsFromGalleryMeta(meta, "https://arca.live/b/art/123")).toEqual([
      "art",
      "author:source author",
    ]);
    expect(arcaPublishedAtFromDocument(doc)).toBe("2026-06-14T08:00:00Z");
  });
});
