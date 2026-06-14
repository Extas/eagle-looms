import { describe, expect, it, vi } from "vitest";
import { instagramAuthorUrls, instagramPublishedAt, instagramSourceTags } from "./matchers/instagram";

vi.mock("$", () => ({
  GM: {
    xmlHttpRequest: () => undefined,
  },
  GM_getValue: () => null,
  GM_setValue: () => undefined,
}));

describe("Instagram matcher metadata", () => {
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
