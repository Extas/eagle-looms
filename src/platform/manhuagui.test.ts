import { describe, expect, it, vi } from "vitest";
import { sourceTagsFromGalleryMeta } from "../eagle/tags";
import { manhuaguiGalleryMetaFromDocument, manhuaguiPublishedAtFromDocument } from "./matchers/manhuagui";

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

describe("Manhuagui matcher metadata", () => {
  it("extracts publish dates from detail status text", () => {
    const doc = parseDocument(`
      <div class="detail-list">
        <span class="status">状态：[2026-06-14] [连载中]</span>
      </div>
    `);

    expect(manhuaguiPublishedAtFromDocument(doc)).toBe("2026-06-14");
  });

  it("returns empty when no detail status date exists", () => {
    const doc = parseDocument("<div class='detail-list'></div>");

    expect(manhuaguiPublishedAtFromDocument(doc)).toBe("");
  });

  it("maps detail rows into gallery metadata without title counters", () => {
    const doc = parseDocument(`
      <div class="book-title"><h1> 漫画标题 </h1></div>
      <ul class="detail-list">
        <li>漫画作者：<a href="/author/soha-blan/"> soha blan </a></li>
        <li>漫画分类：<a href="/list/comedy/"> comedy </a><a href="/list/school/"> school life </a></li>
        <li>漫画状态：<span class="status">状态：[2026-06-14] [连载中]</span></li>
      </ul>
    `);

    const meta = manhuaguiGalleryMetaFromDocument(doc, "https://www.manhuagui.com/comic/1/");

    expect(meta.title).toBe("漫画标题");
    expect(meta.authorUrls).toEqual(["https://www.manhuagui.com/author/soha-blan/"]);
    expect(meta.tags).toEqual({
      "漫画作者": ["soha blan"],
      "漫画分类": ["comedy", "school life"],
      "漫画状态": ["连载中"],
    });
    expect(sourceTagsFromGalleryMeta(meta, "https://www.manhuagui.com/comic/1/2.html#p=1")).toEqual([
      "author:soha blan",
      "comedy",
      "school life",
      "连载中",
    ]);
  });
});
