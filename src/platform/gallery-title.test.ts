import { describe, expect, it } from "vitest";
import { datedGalleryTitle, galleryTitle, searchGalleryTitle } from "./gallery-title";

describe("gallery title helpers", () => {
  it("keeps feed folders semantic and date-based", () => {
    const date = new Date(2026, 4, 31, 8, 0, 0);
    expect(datedGalleryTitle(["twitter", "home"], date)).toBe("twitter-home-2026-05-31");
  });

  it("keeps search folders based on source taxonomy instead of parsed counts", () => {
    expect(searchGalleryTitle("danbooru", "bang_dream! takamatsu_tomori")).toBe("danbooru-search-bang_dream! takamatsu_tomori");
    expect(searchGalleryTitle("anime-pictures", "bang dream")).toBe("anime-pictures-search-bang dream");
    expect(searchGalleryTitle("anime-pictures", "", "posts")).toBe("anime-pictures-posts");
    expect(searchGalleryTitle("yande.re", "")).toBe("yande.re-posts");
  });

  it("sanitizes unsafe source titles while preserving readable words", () => {
    expect(galleryTitle(["artstation", "artist/name?"])).toBe("artstation-artist name");
  });
});
