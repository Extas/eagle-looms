import { describe, expect, it, vi } from "vitest";
import { GalleryMeta } from "../download/gallery-meta";
import { sourceTagsFromGalleryMeta } from "../eagle/tags";
import { niyaniyaPublishedAt, niyaniyaTagsFromDetail } from "./matchers/niyaniya";

vi.mock("$", () => ({
  GM: {
    xmlHttpRequest: () => undefined,
  },
  GM_getValue: () => null,
  GM_setValue: () => undefined,
}));

describe("Niyaniya matcher metadata", () => {
  it("derives published timestamps from gallery creation time", () => {
    expect(niyaniyaPublishedAt({ created_at: 1718323200 })).toBe("1718323200");
  });

  it("maps API tag namespaces into unified source tags", () => {
    const meta = new GalleryMeta("https://niyaniya.moe/g/1/key", "gallery");
    meta.tags = niyaniyaTagsFromDetail({
      tags: [
        { namespace: 1, name: "soha blan", count: 11 },
        { namespace: 2, name: "circle name", count: 3 },
        { namespace: 3, name: "project sekai", count: 403 },
        { namespace: 9, name: "school uniform", count: 12 },
      ],
    });

    expect(sourceTagsFromGalleryMeta(meta, "https://niyaniya.moe/reader/1/key/1")).toEqual([
      "author:soha blan",
      "author:circle name",
      "copyright:project sekai",
      "school uniform",
    ]);
  });
});
