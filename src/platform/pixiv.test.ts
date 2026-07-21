import { describe, expect, it, vi } from "vitest";
import { sourceTagsFromGalleryMeta } from "../eagle/tags";
import { PixivMatcher } from "./matchers/pixiv";

vi.mock("$", () => ({
  GM: { xmlHttpRequest: () => undefined },
  GM_getValue: () => null,
  GM_setValue: () => undefined,
}));

describe("Pixiv matcher metadata", () => {
  it("keeps the current-artwork chapter for localized share URLs", async () => {
    window.history.pushState({}, "", "/en/artworks/147051638?utm_source=share#viewer");
    document.body.innerHTML = `<a data-gtm-value="111145760" href="/users/111145760">artist</a>`;
    const fetchSpy = vi.spyOn(window, "fetch");

    const matcher = new PixivMatcher();
    const chapters = await matcher.fetchChapters().next();

    expect(chapters.done).toBe(false);
    expect(chapters.value).toHaveLength(1);
    expect(chapters.value[0].title).toBeTruthy();
    const page = await matcher.fetchPagesSource(chapters.value[0]).next();
    expect(page.value?.value).toEqual([{ id: "111145760", pids: ["147051638"] }]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

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
