import { describe, expect, it } from "vitest";
import { twitterEagleAuthorUrls, twitterEagleItemBaseName, twitterEagleSourceTags, twitterItemAuthorUrls, twitterItemPublishedAt, twitterItemSourceTags, twitterMediaInDisplayOrder, twitterSafePageHelperBottom } from "./twitter";

describe("Twitter Eagle metadata adapter", () => {
  it("normalizes authors through the shared Eagle namespace rule", () => {
    expect(twitterEagleSourceTags({ screenName: " @artist_name ", hashtags: ["mygo", "#bangdream", "mygo"] })).toEqual([
      "author:artist_name",
      "mygo",
      "bangdream",
    ]);
    expect(twitterEagleAuthorUrls(" @artist_name ")).toEqual(["https://x.com/artist_name"]);
  });

  it("keeps hashtag-only metadata when author identity is missing", () => {
    expect(twitterEagleSourceTags({ hashtags: [" mygo\nfanart "] })).toEqual(["mygo fanart"]);
    expect(twitterEagleAuthorUrls("")).toEqual([]);
  });

  it("uses the media-bearing tweet as the source metadata owner", () => {
    const item = twitterItem({
      outerUser: "reposter",
      outerLegacy: {
        id_str: "1",
        created_at: "Wed Oct 10 20:19:24 +0000 2018",
        entities: { hashtags: [{ text: "outer" }] },
      },
      retweetedUser: "artist",
      retweetedLegacy: {
        id_str: "2",
        created_at: "Thu Oct 11 20:19:24 +0000 2018",
        entities: {
          hashtags: [{ text: "mygo" }],
          media: [twitterMedia("media1")],
        },
      },
    });

    expect(twitterItemSourceTags(item)).toEqual(["author:artist", "mygo"]);
    expect(twitterItemAuthorUrls(item)).toEqual(["https://x.com/artist"]);
    expect(twitterItemPublishedAt(item)).toBe("Thu Oct 11 20:19:24 +0000 2018");
  });

  it("uses the source author instead of the generic User Media name prefix", () => {
    expect(twitterEagleItemBaseName(
      "User Media",
      "2075580226034434048-HM3xN_ubgAA6Hh5.jpg",
      "https://x.com/Tsurumi_vov/status/2075580242895528190/photo/1",
      ["author:Tsurumi_vov", "fanart"],
    )).toBe("Tsurumi_vov - 2075580226034434048-HM3xN_ubgAA6Hh5.jpg");
  });

  it("recovers a missing GraphQL author from the media source URL", () => {
    const item = twitterItem({
      outerUser: "",
      outerLegacy: {
        id_str: "2075739332229710294",
        entities: {
          hashtags: [{ text: "ヨスガノソラ" }],
          media: [{
            ...twitterMedia("2075739304324935680"),
            expanded_url: "https://x.com/ajsjm140648/status/2075739332229710294/photo/1",
          }],
        },
      },
    });

    expect(twitterItemSourceTags(item)).toEqual(["author:ajsjm140648", "ヨスガノソラ"]);
    expect(twitterItemAuthorUrls(item)).toEqual(["https://x.com/ajsjm140648"]);
  });

  it("keeps upstream naming for other sites and uses the Twitter URL as the final author fallback", () => {
    expect(twitterEagleItemBaseName("Gallery", "image.jpg", "https://example.test/post/1", ["author:artist"]))
      .toBe("Gallery - image.jpg");
    expect(twitterEagleItemBaseName("User Media", "image.jpg", "https://x.com/user/status/1/photo/1", []))
      .toBe("user - image.jpg");
  });

  it("reverses display order without changing each media source position", () => {
    expect(twitterMediaInDisplayOrder(["first", "second", "third"], true)).toEqual([
      { media: "third", sourceIndex: 2 },
      { media: "second", sourceIndex: 1 },
      { media: "first", sourceIndex: 0 },
    ]);
    expect(twitterMediaInDisplayOrder(["first", "second"], false)).toEqual([
      { media: "first", sourceIndex: 0 },
      { media: "second", sourceIndex: 1 },
    ]);
  });

  it("raises a bottom-right entry above the native X Chat launcher", () => {
    expect(twitterSafePageHelperBottom("https://x.com/artist/status/1", true, "20px")).toBe("84px");
    expect(twitterSafePageHelperBottom("https://twitter.com/artist", true, "0px")).toBe("84px");
    expect(twitterSafePageHelperBottom("https://x.com/artist", true, "100px")).toBeUndefined();
    expect(twitterSafePageHelperBottom("https://x.com/artist", false, "20px")).toBeUndefined();
    expect(twitterSafePageHelperBottom("https://example.test/artist", true, "20px")).toBeUndefined();
  });
});

function twitterItem(input: {
  outerUser: string,
  outerLegacy: Record<string, unknown>,
  retweetedUser?: string,
  retweetedLegacy?: Record<string, unknown>,
}): any {
  const retweeted = input.retweetedLegacy
    ? {
      core: twitterCore(input.retweetedUser || "retweeted"),
      legacy: input.retweetedLegacy,
    }
    : undefined;
  return {
    itemContent: {
      tweet_results: {
        result: {
          core: twitterCore(input.outerUser),
          legacy: {
            ...input.outerLegacy,
            ...(retweeted ? { retweeted_status_result: { result: retweeted } } : {}),
          },
        },
      },
    },
  };
}

function twitterCore(screenName: string): Record<string, unknown> {
  return {
    user_results: {
      result: {
        legacy: { screen_name: screenName },
      },
    },
  };
}

function twitterMedia(id: string): Record<string, unknown> {
  return {
    id_str: id,
    expanded_url: "https://x.com/artist/status/2/photo/1",
    media_url_https: `https://pbs.twimg.com/media/${id}.jpg`,
    type: "photo",
    sizes: {
      large: { w: 1000, h: 1000 },
      medium: { w: 800, h: 800 },
      small: { w: 400, h: 400 },
      thumb: { w: 150, h: 150 },
    },
  };
}
