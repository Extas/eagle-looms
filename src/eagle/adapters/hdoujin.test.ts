import { describe, expect, it } from "vitest";
import { sourceTagsFromGalleryMeta } from "../tags";
import { hdoujinGalleryMeta, hdoujinPublishedAt } from "./hdoujin";

describe("HDoujin Eagle metadata adapter", () => {
  it("derives published timestamps from gallery creation time", () => {
    expect(hdoujinPublishedAt({ created_at: 1718323200 })).toBe("1718323200");
    expect(hdoujinPublishedAt({ publishedAt: 1718409600 })).toBe("1718409600");
  });

  it("maps API tag namespaces into unified source tags", () => {
    const meta = hdoujinGalleryMeta({
      title: "gallery title",
      subtitle: "origin title",
      tags: [
        { namespace: 1, name: "soha blan", count: 11 },
        { namespace: 2, name: "circle name", count: 3 },
        { namespace: 3, name: "project sekai", count: 403 },
        { namespace: 9, name: "school uniform", count: 12 },
        { namespace: 11, name: "english", count: 8 },
      ],
    }, "https://hdoujin.org/g/1/key");

    expect(meta.originTitle).toBe("origin title");
    expect(sourceTagsFromGalleryMeta(meta, "https://hdoujin.org/g/1/key/read/1")).toEqual([
      "author:soha blan",
      "author:circle name",
      "copyright:project sekai",
      "school uniform",
      "english",
    ]);
  });
});
