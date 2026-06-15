import { describe, expect, it } from "vitest";
import { sourceTagsFromGalleryMeta } from "../tags";
import { mangaCopyGalleryMetaFromDocument, mangaCopyPublishedAtFromDocument } from "./mangacopy";

describe("MangaCopy Eagle metadata adapter", () => {
  it("derives published timestamps from comic detail dates", () => {
    const doc = new DOMParser().parseFromString(`
      <div class="comicParticulars-title-right">
        <ul>
          <li><span class="comicParticulars-right-txt">not a date</span></li>
          <li><span class="comicParticulars-right-txt"> 2026-06-14 </span></li>
        </ul>
      </div>
    `, "text/html");

    expect(mangaCopyPublishedAtFromDocument(doc)).toBe("2026-06-14");
  });

  it("returns empty when the detail date is missing", () => {
    const doc = new DOMParser().parseFromString("<div></div>", "text/html");

    expect(mangaCopyPublishedAtFromDocument(doc)).toBe("");
  });

  it("maps comic detail rows into gallery metadata without title counters", () => {
    const doc = new DOMParser().parseFromString(`
      <div class="comicParticulars-title-right">
        <ul>
          <li><h6> 作品标题 </h6></li>
          <li>
            作者：
            <a href="/author/soha-blan"><span class="comicParticulars-right-txt"> soha blan </span></a>
          </li>
          <li>
            题材：
            <a href="/theme/comedy"><span class="comicParticulars-right-txt"> comedy </span></a>
            <a href="/theme/school"><span class="comicParticulars-right-txt"> school life </span></a>
          </li>
          <li>
            状态：
            <span class="comicParticulars-right-txt"> 连载中 </span>
          </li>
          <li>
            更新日期：
            <span class="comicParticulars-right-txt"> 2026-06-14 </span>
          </li>
        </ul>
      </div>
    `, "text/html");

    const meta = mangaCopyGalleryMetaFromDocument(doc, "https://www.mangacopy.com/comic/test");

    expect(meta.title).toBe("作品标题");
    expect(meta.authorUrls).toEqual(["https://www.mangacopy.com/author/soha-blan"]);
    expect(meta.tags).toEqual({
      "作者": ["soha blan"],
      "题材": ["comedy", "school life"],
      "状态": ["连载中"],
      "更新日期": ["2026-06-14"],
    });
    expect(sourceTagsFromGalleryMeta(meta, "https://www.mangacopy.com/comic/test/chapter/1")).toEqual([
      "author:soha blan",
      "comedy",
      "school life",
      "连载中",
    ]);
  });
});
