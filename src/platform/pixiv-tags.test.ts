import { describe, expect, it } from "vitest";
import { normalizePixivWorkTags, pixivAuthorLabel, pixivAuthorUrl } from "./pixiv-tags";

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

  it("keeps Pixiv source tags and source-provided translated tags", () => {
    expect(normalizePixivWorkTags({
      tags: [
        { tag: "hatsune_miku", translation: { en: "Hatsune Miku" } },
        { tag: "school uniform", translations: { english: "school uniform" } },
        { tag_en: "blue archive" },
        { tagTranslation: { en: "long hair" } },
      ],
    })).toEqual([
      "hatsune_miku",
      "Hatsune Miku",
      "school uniform",
      "blue archive",
      "long hair",
    ]);
  });

  it("prefers readable Pixiv author names while keeping user id author URLs", () => {
    const work = {
      userId: "81925632",
      userName: " soha\nblan ",
      userAccount: "soha_blan",
    };

    expect(pixivAuthorLabel(work)).toBe("soha blan");
    expect(pixivAuthorUrl(work)).toBe("https://www.pixiv.net/users/81925632");
  });

  it("falls back to Pixiv user id when no readable author name is present", () => {
    expect(pixivAuthorLabel({}, "81925632")).toBe("81925632");
    expect(pixivAuthorUrl({}, "81925632")).toBe("https://www.pixiv.net/users/81925632");
  });
});
