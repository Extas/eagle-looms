import { describe, expect, it } from "vitest";
import { GalleryMeta } from "../../download/gallery-meta";
import { sourceTagsFromGalleryMeta } from "../tags";
import {
  pixivEagleArtworkMetadataBuckets,
  pixivEagleAuthorTag,
  pixivEagleAuthorUrl,
  pixivEagleSourceTags,
} from "./pixiv";

describe("Pixiv Eagle metadata adapter", () => {
  it("converts Pixiv author identity into Eagle source tags and URLs", () => {
    const work = {
      tags: ["blue archive", "mika"],
      userId: "42",
      userName: "soha blan",
    };

    expect(pixivEagleAuthorTag(work)).toBe("author:soha blan");
    expect(pixivEagleAuthorUrl(work)).toBe("https://www.pixiv.net/users/42");
    expect(pixivEagleSourceTags(work)).toEqual(["author:soha blan", "blue archive", "mika"]);
  });

  it("keeps per-artwork metadata buckets keyed by Pixiv artwork id", () => {
    const meta = new GalleryMeta("https://www.pixiv.net/users/42", "pixiv-user-42");
    meta.tags = pixivEagleArtworkMetadataBuckets({
      "100": {
        tags: ["bang dream", "mygo"],
        userId: "42",
        userName: "artist",
      },
    });

    expect(sourceTagsFromGalleryMeta(meta, "https://www.pixiv.net/artworks/100")).toEqual([
      "author:artist",
      "bang dream",
      "mygo",
    ]);
  });
});
