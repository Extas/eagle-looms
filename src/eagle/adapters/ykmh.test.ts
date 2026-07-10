import { describe, expect, it } from "vitest";
import { sourceTagsFromGalleryMeta } from "../tags";
import { ykmhGalleryMetaFromDocument } from "./ykmh";

function parseDocument(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

describe("YKMH Eagle metadata adapter", () => {
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
