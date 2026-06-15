import { describe, expect, it } from "vitest";
import { animePicturesApiSourceTag, animePicturesCategory, animePicturesSourceTag } from "./anime-pictures";

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
});
