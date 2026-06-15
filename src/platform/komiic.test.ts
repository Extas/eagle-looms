import { describe, expect, it, vi } from "vitest";
import { sourceTagsFromGalleryMeta } from "../eagle/tags";
import { komiicGalleryMeta, komiicPublishedAt } from "./matchers/komiic";

vi.mock("$", () => ({
  GM: {
    xmlHttpRequest: () => undefined,
  },
  GM_getValue: () => null,
  GM_setValue: () => undefined,
}));

describe("Komiic matcher metadata", () => {
  it("derives published timestamps from chapter metadata", () => {
    expect(komiicPublishedAt({
      dateCreated: "2021-10-28T00:56:05Z",
      dateUpdated: "2023-04-09T01:43:22Z",
    })).toBe("2021-10-28T00:56:05Z");

    expect(komiicPublishedAt({
      dateCreated: "",
      dateUpdated: "2023-04-09T01:43:22Z",
    })).toBe("2023-04-09T01:43:22Z");
  });

  it("maps comic authors and categories into unified source tags", () => {
    const meta = komiicGalleryMeta({
      title: "新妹魔王的契約者·嵐",
      authors: [
        { id: "73", name: "上棲綴人" },
        { id: "74", name: " 大熊猫介 " },
      ],
      categories: [
        { id: "1", name: "愛情" },
        { id: "2", name: "奇幻" },
      ],
    }, "https://komiic.com/comic/123");

    expect(sourceTagsFromGalleryMeta(meta, "https://komiic.com/comic/123/chapter/1/page/1")).toEqual([
      "author:上棲綴人",
      "author:大熊猫介",
      "愛情",
      "奇幻",
    ]);
  });
});
