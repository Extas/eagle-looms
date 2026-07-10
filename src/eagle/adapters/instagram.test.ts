import { describe, expect, it } from "vitest";
import { instagramAuthorUrls, instagramPublishedAt, instagramSourceTags } from "./instagram";

describe("Instagram Eagle metadata adapter", () => {
  it("derives author and caption hashtag source tags", () => {
    expect(instagramSourceTags("@knokzm", "New art #MyGO #バンドリ #MyGO")).toEqual([
      "author:knokzm",
      "MyGO",
      "バンドリ",
    ]);
  });

  it("derives author URLs and published timestamps", () => {
    expect(instagramAuthorUrls("knokzm")).toEqual([
      "https://www.instagram.com/knokzm/",
    ]);
    expect(instagramPublishedAt(1719792000)).toBe("1719792000");
    expect(instagramPublishedAt(0)).toBe("");
  });
});
