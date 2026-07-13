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

  it("keeps author URLs readable without exposing a machine identity envelope", () => {
    const annotation = eagleAnnotationForAsset({
      ...asset,
      authorUrls: [" https://www.pixiv.net/users/42 ", "https://www.pixiv.net/users/42", "https://x.com/artist"],
    });

    expect(annotation).toBe("https://www.pixiv.net/users/42\nhttps://x.com/artist");
  });

  it("ignores malformed and non-web author URLs", () => {
    expect(eagleAnnotationForAsset({
      ...asset,
      authorUrls: ["/artist/42", "javascript:alert(1)", "data:text/plain,artist", `https://example.test/${"x".repeat(2048)}`],
    })).toBeUndefined();
  });

  it("normalizes duplicate identity and caps author URL metadata", () => {
    const urls = Array.from({ length: 25 }, (_, index) => `https://example.test/author/${index}`);
    const annotation = eagleAnnotationForAsset({
      ...asset,
      authorUrls: ["https://EXAMPLE.test/author/0", ...urls, "https://other.test/ignored"],
    });

    expect(annotation!.split("\n")).toEqual([
      "https://EXAMPLE.test/author/0",
      ...urls.slice(1, 20),
    ]);
  });

  it("keeps the machine identity envelope only for multi-file subitems", () => {
    const input = {
      ...asset,
      itemKey: "frame-001.png",
      authorUrls: ["https://x.com/artist"],
    };

    expect(JSON.parse(eagleAnnotationForAsset(input)!)).toEqual({
      schema: "eagle-looms/item/v1",
      sourceUrl: asset.sourceUrl,
      originUrl: asset.originUrl,
      stableKey: stableKeyForAsset(input),
      itemKey: "frame-001.png",
      authorUrls: ["https://x.com/artist"],
    });
  });
});
