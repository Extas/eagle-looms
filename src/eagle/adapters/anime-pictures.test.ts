import { describe, expect, it } from "vitest";
import { animePicturesApiSourceTag, animePicturesCategory, animePicturesGalleryMetaFromUrl, animePicturesSourceTag } from "./anime-pictures";

describe("anime-pictures Eagle metadata adapter", () => {
  it("maps decorated source categories to Eagle namespaces", () => {
    expect(animePicturesCategory("game_copyright:")).toBe("copyright");
    expect(animePicturesCategory("Character(s):")).toBe("character");
    expect(animePicturesCategory("Artist(s):")).toBe("author");
    expect(animePicturesCategory("reference")).toBe("raw");
  });

  it("formats source tags through the shared namespace rules", () => {
    expect(animePicturesSourceTag("copyright", "project sekai")).toBe("copyright:project sekai");
    expect(animePicturesSourceTag("character", "kusanagi nene")).toBe("character:kusanagi nene");
    expect(animePicturesSourceTag("author", "soha blan")).toBe("author:soha blan");
    expect(animePicturesSourceTag("raw", "purple eyes")).toBe("purple eyes");
  });

  it("formats API tag categories consistently with detail-page categories", () => {
    expect(animePicturesApiSourceTag("Writer(s)", "scenario name")).toBe("author:scenario name");
    expect(animePicturesApiSourceTag("series", "bang dream")).toBe("copyright:bang dream");
    expect(animePicturesApiSourceTag("reference", "purple eyes")).toBe("purple eyes");
  });

  it("builds search gallery metadata from anime-pictures URLs", () => {
    const meta = animePicturesGalleryMetaFromUrl("https://anime-pictures.net/posts?page=0&search_tag=bang+dream%21+it%27s+mygo%21%21%21%21%21&lang=en");

    expect(meta.title).toBe("anime-pictures-search-bang dream! it's mygo!!!!!");
    expect(meta.tags).toEqual({
      search_tag: ["bang dream! it's mygo!!!!!"],
      page: ["bang dream! it's mygo!!!!!"],
      site: ["anime-pictures.net"],
    });
  });

  it("uses stable gallery labels for anime-pictures stars and single posts", () => {
    expect(animePicturesGalleryMetaFromUrl("https://anime-pictures.net/stars?page=0&lang=en").title).toBe("anime-pictures-stars");
    expect(animePicturesGalleryMetaFromUrl("https://anime-pictures.net/posts/919002?lang=en").title).toBe("anime-pictures-posts");
  });
});
