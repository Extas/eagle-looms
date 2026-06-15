import { describe, expect, it, vi } from "vitest";
import { sourceTagsFromGalleryMeta } from "../eagle/tags";
import { eahentaiGalleryMeta, eahentaiPublishedAt } from "./matchers/eahentai";

vi.mock("$", () => ({
  GM: {
    xmlHttpRequest: () => undefined,
  },
  GM_getValue: () => null,
  GM_setValue: () => undefined,
}));

describe("eahentai matcher metadata", () => {
  it("prefers image addDt over gallery addDt", () => {
    expect(eahentaiPublishedAt(
      { addDt: "2026-06-14 08:00:00" },
      { addDt: "2026-06-13 08:00:00" },
    )).toBe("2026-06-14 08:00:00");
  });

  it("falls back to gallery addDt", () => {
    expect(eahentaiPublishedAt(
      { addDt: "" },
      { addDt: "2026-06-13 08:00:00" },
    )).toBe("2026-06-13 08:00:00");
  });

  it("returns empty when no publish date is available", () => {
    expect(eahentaiPublishedAt({}, {})).toBe("");
  });

  it("cleans API metadata and maps it into unified source tags", () => {
    const meta = eahentaiGalleryMeta({
      title: " gallery title ",
      tags: " school uniform | | blue eyes ",
      author: " soha blan ",
      albumType: " Image Set | ",
      characters: " kusanagi nene | ",
    }, "https://eahentai.com/a/1");

    expect(meta.title).toBe("gallery title");
    expect(sourceTagsFromGalleryMeta(meta, "https://eahentai.com/a/1/0")).toEqual([
      "school uniform",
      "blue eyes",
      "author:soha blan",
      "Image Set",
      "character:kusanagi nene",
    ]);
  });
});
