import { describe, expect, it } from "vitest";
import { artStationAuthorTag, artStationAuthorUrl, normalizeArtStationTags } from "./artstation-tags";

describe("ArtStation source tags", () => {
  it("normalizes and deduplicates project tags", () => {
    expect(normalizeArtStationTags([" concept art ", "concept art", "multi\nline", ""])).toEqual([
      "concept art",
      "multi line",
    ]);
  });

  it("extracts common object-shaped project tag values", () => {
    expect(normalizeArtStationTags([
      { name: "concept art" },
      { tag: "character design" },
      { title: "illustration" },
      { slug: "mygo" },
      { count: 42 },
    ])).toEqual([
      "concept art",
      "character design",
      "illustration",
      "mygo",
    ]);
  });

  it("prefers username for author tags and falls back to full name", () => {
    expect(artStationAuthorTag({ username: " artist\nname ", full_name: "Full Name" })).toBe("author:artist name");
    expect(artStationAuthorTag({ full_name: "Full Name" })).toBe("author:Full Name");
  });

  it("uses ArtStation permalink for author URLs and falls back to username profile URL", () => {
    expect(artStationAuthorUrl({ permalink: "https://www.artstation.com/artist" })).toBe("https://www.artstation.com/artist");
    expect(artStationAuthorUrl({ username: "artist" })).toBe("https://www.artstation.com/artist");
  });
});
