import { describe, expect, it } from "vitest";
import { eagleAnnotationForAsset } from "./annotation";
import { stableKeyForAsset } from "./duplicates";

const asset = {
  sourceUrl: "https://anime-pictures.net/posts/917184",
  originUrl: "https://images.anime-pictures.net/pictures/917184.jpg",
};

describe("Eagle annotation", () => {
  it("keeps normal single-image items annotation-free by default", () => {
    expect(eagleAnnotationForAsset(asset)).toBeUndefined();
  });

  it("stores stable identity for multi-file subitems", () => {
    const input = { ...asset, itemKey: "frame-001.png" };
    expect(JSON.parse(eagleAnnotationForAsset(input)!)).toEqual({
      schema: "eagle-looms/item/v1",
      sourceUrl: asset.sourceUrl,
      originUrl: asset.originUrl,
      stableKey: stableKeyForAsset(input),
      itemKey: "frame-001.png",
    });
  });

  it("keeps author URLs with the same stable identity envelope", () => {
    const annotation = eagleAnnotationForAsset({
      ...asset,
      authorUrls: [" https://www.pixiv.net/users/42 ", "https://www.pixiv.net/users/42", "https://x.com/artist"],
    });

    expect(JSON.parse(annotation!)).toEqual({
      schema: "eagle-looms/item/v1",
      sourceUrl: asset.sourceUrl,
      originUrl: asset.originUrl,
      stableKey: stableKeyForAsset(asset),
      authorUrls: ["https://www.pixiv.net/users/42", "https://x.com/artist"],
    });
  });
});
