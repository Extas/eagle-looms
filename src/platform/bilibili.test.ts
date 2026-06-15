import { describe, expect, it, vi } from "vitest";
import { bilibiliAuthorUrls, bilibiliPublishedAt, bilibiliSourceTags } from "./matchers/bilibili";

vi.mock("$", () => ({
  GM: {
    xmlHttpRequest: () => undefined,
  },
  GM_getValue: () => null,
  GM_setValue: () => undefined,
}));

describe("Bilibili matcher metadata", () => {
  const detail = {
    id_str: "123456",
    modules: [
      {
        module_type: "MODULE_TYPE_AUTHOR",
        module_author: {
          mid: 321,
          name: "  画师\nA  ",
          pub_time: "2026-06-14 12:34:56",
          pub_ts: 1781411696,
        },
      },
    ],
  };

  it("derives author source tags from opus author metadata", () => {
    expect(bilibiliSourceTags(detail)).toEqual(["author:画师 A"]);
    expect(bilibiliSourceTags({ modules: [] })).toEqual([]);
  });

  it("derives author profile urls from opus author metadata", () => {
    expect(bilibiliAuthorUrls(detail)).toEqual(["https://space.bilibili.com/321"]);
    expect(bilibiliAuthorUrls({ modules: [{ module_author: { mid: "not-a-number" } }] })).toEqual([]);
  });

  it("derives published timestamps from opus author metadata", () => {
    expect(bilibiliPublishedAt(detail)).toBe("2026-06-14 12:34:56");
    expect(bilibiliPublishedAt({
      modules: [{ module_author: { pub_ts: 1781411696 } }],
    })).toBe("1781411696");
  });
});
