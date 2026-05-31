import { describe, expect, it } from "vitest";
import { normalizePixivWorkTags } from "./pixiv-tags";

describe("Pixiv source tags", () => {
  it("normalizes profile/illusts string tags", () => {
    expect(normalizePixivWorkTags(["bang dream", " MyGO!!!!! ", "bang dream", "multi\nline"])).toEqual([
      "bang dream",
      "MyGO!!!!!",
      "multi line",
    ]);
  });

  it("normalizes illust detail tag objects", () => {
    expect(normalizePixivWorkTags({
      tags: [
        { tag: "project sekai" },
        { tag: "kusanagi nene" },
        { tag: "" },
      ],
    })).toEqual(["project sekai", "kusanagi nene"]);
  });
});
