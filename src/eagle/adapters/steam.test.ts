import { describe, expect, it } from "vitest";
import { sourceTagsFromGalleryMeta } from "../tags";
import { steamAuthorUrlFromUrl, steamGalleryMetaFromUrl, steamGalleryTitleFromUrl, steamProfileIdentityFromUrl } from "./steam";

describe("Steam Eagle metadata adapter", () => {
  it("uses app ids for gallery titles without producing steam-null", () => {
    expect(steamGalleryTitleFromUrl("https://steamcommunity.com/id/artist/screenshots/?appid=123")).toBe("steam-123");
    expect(steamGalleryTitleFromUrl("https://steamcommunity.com/id/artist/screenshots/", "Screenshots")).toBe("steam-Screenshots");
  });

  it("derives author metadata from custom and numeric profile URLs", () => {
    expect(steamProfileIdentityFromUrl("https://steamcommunity.com/id/artist/screenshots/?appid=123")).toBe("artist");
    expect(steamAuthorUrlFromUrl("https://steamcommunity.com/profiles/76561198000000000/screenshots/?appid=123")).toBe(
      "https://steamcommunity.com/profiles/76561198000000000",
    );
  });

  it("maps profile identity into gallery source metadata", () => {
    const meta = steamGalleryMetaFromUrl("https://steamcommunity.com/id/artist/screenshots/?appid=123", "Screenshots");

    expect(meta.title).toBe("steam-123");
    expect(meta.authorUrls).toEqual(["https://steamcommunity.com/id/artist"]);
    expect(sourceTagsFromGalleryMeta(meta, "https://steamcommunity.com/sharedfiles/filedetails/?id=100")).toEqual([
      "author:artist",
    ]);
  });
});
