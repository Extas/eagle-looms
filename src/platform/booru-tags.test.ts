import { describe, expect, it } from "vitest";
import { normalizeBooruSourceTags } from "./booru-tags";

describe("booru source tags", () => {
  it("normalizes known booru categories and keeps other tags raw", () => {
    const element = document.createElement("article");
    element.setAttribute("data-tag-string-copyright", "project_sekai");
    element.setAttribute("data-tag-string-character", "kusanagi_nene");
    element.setAttribute("data-tag-string-artist", "soha_blan");

    expect(normalizeBooruSourceTags(element, [
      "project_sekai",
      "kusanagi_nene",
      "soha_blan",
      "purple_eyes",
      "food",
    ])).toEqual([
      "copyright:project_sekai",
      "character:kusanagi_nene",
      "author:soha_blan",
      "purple_eyes",
      "food",
    ]);
  });

  it("imports raw tags when category metadata is unavailable", () => {
    expect(normalizeBooruSourceTags(document.createElement("article"), ["blue_eyes", "looking_at_viewer"])).toEqual([
      "blue_eyes",
      "looking_at_viewer",
    ]);
  });
});
