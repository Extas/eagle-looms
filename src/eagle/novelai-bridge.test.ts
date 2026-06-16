import { describe, expect, it } from "vitest";
import {
  buildNovelAiGeneratedItemInput,
  eagleItemImageCandidates,
  eagleItemLink,
  isNovelAiImageToolsUrl,
  novelAiGeneratedTags,
  normalizeMonitorLimit,
  parseEagleItemId,
} from "./novelai-bridge";

describe("NovelAI Eagle bridge", () => {
  it("detects only NovelAI image tools pages", () => {
    expect(isNovelAiImageToolsUrl("https://novelai.net/imagetools")).toBe(true);
    expect(isNovelAiImageToolsUrl("https://novelai.net/imagetools/")).toBe(true);
    expect(isNovelAiImageToolsUrl("https://novelai.net/image")).toBe(false);
    expect(isNovelAiImageToolsUrl("https://example.test/imagetools")).toBe(false);
  });

  it("parses Eagle item links and raw ids", () => {
    expect(parseEagleItemId("http://localhost:41595/item?id=MQFVMXHVIRSIQ")).toBe("MQFVMXHVIRSIQ");
    expect(parseEagleItemId("https://x.test/path?foo=1&id=ABC%20123#hash")).toBe("ABC 123");
    expect(parseEagleItemId("RAWID")).toBe("RAWID");
    expect(parseEagleItemId("")).toBe("");
  });

  it("builds canonical Eagle item links from the configured API base", () => {
    expect(eagleItemLink("http://localhost:41595/api/v2/", "ITEM1")).toBe("http://localhost:41595/item?id=ITEM1");
  });

  it("keeps only fetchable image candidates from Eagle item fields", () => {
    expect(eagleItemImageCandidates({
      id: "ITEM1",
      fileURL: "eagle://asset/ITEM1",
      thumbnailURL: "/thumbnail/ITEM1.png",
      url: "https://cdn.example.test/media?id=ITEM1",
      website: "https://example.test/posts/ITEM1",
    }, "http://localhost:41595")).toEqual([
      "https://cdn.example.test/media?id=ITEM1",
      "http://localhost:41595/thumbnail/ITEM1.png",
    ]);
  });

  it("clamps monitor limits to a small explicit range", () => {
    expect(normalizeMonitorLimit(undefined)).toBe(2);
    expect(normalizeMonitorLimit(0)).toBe(1);
    expect(normalizeMonitorLimit(999)).toBe(20);
    expect(normalizeMonitorLimit("3")).toBe(3);
  });

  it("builds generated result payloads for the source item's folders", () => {
    const input = buildNovelAiGeneratedItemInput({
      sourceItem: {
        id: "SRC1",
        name: "2026-06-14 User Media.jpg",
        url: "https://pbs.twimg.com/media/source.jpg",
        folders: ["folder-a", "folder-a", "folder-b"],
        tags: ["site:x.com", "copyright:bang dream", "character:anon tokyo", "source:published:2026-06-14"],
      },
      sourceItemLink: "http://localhost:41595/item?id=SRC1",
      pageUrl: "https://novelai.net/imagetools",
      generatedAt: new Date(2026, 5, 16, 3, 4, 5),
      resultIndex: 2,
      contentType: "image/png",
      base64: "abc",
    });

    expect(input.name).toBe("2026-06-14 User Media - NovelAI - 2026-06-16 030405 - 02.png");
    expect(input.folders).toEqual(["folder-a", "folder-b"]);
    expect(input.tags).toEqual(["tool:novelai", "copyright:bang dream", "character:anon tokyo"]);
    expect(input.website).toBe("https://novelai.net/imagetools");
    expect(input.base64).toBe("data:image/png;base64,abc");
    expect(JSON.parse(input.annotation!)).toEqual({
      schema: "eagle-looms/novelai-bridge/v1",
      sourceItemId: "SRC1",
      sourceItemName: "2026-06-14 User Media.jpg",
      sourceItemLink: "http://localhost:41595/item?id=SRC1",
      sourceUrl: "https://pbs.twimg.com/media/source.jpg",
      novelAiUrl: "https://novelai.net/imagetools",
      generatedAt: new Date(2026, 5, 16, 3, 4, 5).toISOString(),
    });
  });

  it("keeps NovelAI result tags semantic and searchable", () => {
    expect(novelAiGeneratedTags([
      "eagle-looms",
      "site:x.com",
      "gallery:twitter-user",
      "ext:jpg",
      "mime:image/jpeg",
      "tool:novelai",
      "copyright:bang dream",
      "character:anon tokyo",
      "author:knokzm",
      "blue eyes",
    ])).toEqual([
      "tool:novelai",
      "copyright:bang dream",
      "character:anon tokyo",
      "author:knokzm",
      "blue eyes",
    ]);
  });
});
