import { describe, expect, it, vi } from "vitest";
import { doubanAuthorUrls, doubanPublishedAt, doubanSourceTags } from "./matchers/douban";

vi.mock("$", () => ({
  GM: {
    xmlHttpRequest: () => undefined,
  },
  GM_getValue: () => null,
  GM_setValue: () => undefined,
}));

describe("Douban matcher metadata", () => {
  it("derives author source tags from album owner metadata", () => {
    expect(doubanSourceTags({ owner_name: "  Artist\nName  " })).toEqual([
      "author:Artist Name",
    ]);
    expect(doubanSourceTags({ owner_name: "" })).toEqual([]);
  });

  it("derives author URLs from the profile photos URL", () => {
    expect(doubanAuthorUrls({
      owner_url: "https://www.douban.com/people/example/photos?start=18",
    })).toEqual([
      "https://www.douban.com/people/example",
    ]);
  });

  it("derives published timestamps from album dates", () => {
    expect(doubanPublishedAt({ date: "2026-06-14" })).toBe("2026-06-14");
  });
});
