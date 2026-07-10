import { describe, expect, it } from "vitest";
import { sourceTagsFromGalleryMeta } from "../tags";
import { mh160GalleryMetaFromDocument } from "./mh160";

function parseDocument(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

describe("MH160 Eagle metadata adapter", () => {
  it("maps Introduct detail rows into gallery metadata", () => {
    const doc = parseDocument(`
      <div class="Introduct">
        <div class="h1"> 漫画标题 </div>
        <p>漫画作者：<a href="/author/soha-blan/"> soha blan </a></p>
        <p>漫画分类：<a href="/list/comedy/"> comedy </a><a href="/list/school/"> school life </a></p>
        <p>连载状态：连载中</p>
      </div>
    `);

    const meta = mh160GalleryMetaFromDocument(doc, "https://m.mh160mh.com/kanmanhua/test/");

    expect(meta.title).toBe("漫画标题");
    expect(meta.authorUrls).toEqual(["https://m.mh160mh.com/author/soha-blan/"]);
    expect(meta.tags).toEqual({
      "漫画作者": ["soha blan"],
      "漫画分类": ["comedy", "school life"],
      "连载状态": ["连载中"],
    });
    expect(sourceTagsFromGalleryMeta(meta, "https://m.mh160mh.com/kanmanhua/test/1.html")).toEqual([
      "author:soha blan",
      "comedy",
      "school life",
      "连载中",
    ]);
  });

  it("keeps author-like Chinese roles in the author namespace", () => {
    const doc = parseDocument(`
      <div class="Introduct">
        <div class="h1"> 漫画标题 </div>
        <p>主笔：<a href="/author/main/"> main artist </a></p>
        <p>编剧：scenario writer</p>
      </div>
    `);

    const meta = mh160GalleryMetaFromDocument(doc, "https://m.mh160mh.com/kanmanhua/test/");

    expect(sourceTagsFromGalleryMeta(meta, "https://m.mh160mh.com/kanmanhua/test/1.html")).toEqual([
      "author:main artist",
      "author:scenario writer",
    ]);
    expect(meta.authorUrls).toEqual(["https://m.mh160mh.com/author/main/"]);
  });
});
