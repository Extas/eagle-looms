import { describe, expect, it, vi } from "vitest";
import { sourceTagsFromGalleryMeta } from "../eagle/tags";
import { ykmhGalleryMetaFromDocument } from "./matchers/ykmh";

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

describe("YKMH matcher metadata", () => {
  it("maps comic_deCon detail rows into gallery metadata", () => {
    const doc = parseDocument(`
      <div class="comic_deCon">
        <h1> 漫画标题 </h1>
        <p>作者：<a href="/author/soha-blan/"> soha blan </a></p>
        <p>分类：<a href="/list/comedy/"> comedy </a><a href="/list/school/"> school life </a></p>
        <p>状态：连载中</p>
      </div>
    `);

    const meta = ykmhGalleryMetaFromDocument(doc, "https://www.ykmh.net/manhua/test/");

    expect(meta.title).toBe("漫画标题");
    expect(meta.authorUrls).toEqual(["https://www.ykmh.net/author/soha-blan/"]);
    expect(meta.tags).toEqual({
      "作者": ["soha blan"],
      "分类": ["comedy", "school life"],
      "状态": ["连载中"],
    });
    expect(sourceTagsFromGalleryMeta(meta, "https://www.ykmh.net/manhua/test/1.html")).toEqual([
      "author:soha blan",
      "comedy",
      "school life",
      "连载中",
    ]);
  });
});
