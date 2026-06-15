import { describe, expect, it, vi } from "vitest";
import { sourceTagsFromGalleryMeta } from "../eagle/tags";
import { PixivMatcher } from "./matchers/pixiv";

vi.mock("$", () => ({
  GM: { xmlHttpRequest: () => undefined },
  GM_getValue: () => null,
  GM_setValue: () => undefined,
}));

describe("Pixiv matcher metadata", () => {
  it("keeps author identity in per-artwork gallery metadata buckets", () => {
    window.history.pushState({}, "", "/users/42");
    const matcher = new PixivMatcher();
    matcher.works = {
      "100": {
        id: "100",
        title: "test",
        alt: "",
        illustType: 0,
        description: "",
        tags: ["blue archive", "mika"],
        userId: "42",
        userName: "soha blan",
        pageCount: 1,
      },
      "101": {
        id: "101",
        title: "other",
        alt: "",
        illustType: 0,
        description: "",
        tags: ["wrong post"],
        userId: "43",
        userName: "other artist",
        pageCount: 1,
      },
    };

    const meta = matcher.galleryMeta();

    expect(meta.tags["100"]).toEqual(["author:soha blan", "blue archive", "mika"]);
    expect(sourceTagsFromGalleryMeta(meta, "https://www.pixiv.net/artworks/100")).toEqual([
      "author:soha blan",
      "blue archive",
      "mika",
    ]);
  });
});
