import { describe, expect, it } from "vitest";
import { doubanAuthorUrls, doubanPublishedAt, doubanSourceTags } from "./douban";

describe("Douban Eagle metadata adapter", () => {
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
