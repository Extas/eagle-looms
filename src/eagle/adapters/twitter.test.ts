import { describe, expect, it } from "vitest";
import { twitterEagleAuthorUrls, twitterEagleSourceTags, twitterItemAuthorUrls, twitterItemPublishedAt, twitterItemSourceTags } from "./twitter";

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
