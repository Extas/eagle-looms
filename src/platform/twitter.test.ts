import { describe, expect, it, vi } from "vitest";
import { twitterAuthorUrls, twitterGalleryTitleFromURL, twitterPublishedAt, twitterSourceTags } from "./matchers/twitter";

vi.mock("$", () => ({
  GM: {
    xmlHttpRequest: () => undefined,
  },
  GM_getValue: () => null,
  GM_setValue: () => undefined,
}));

describe("Twitter matcher metadata", () => {
  const date = new Date(2026, 4, 31, 8, 0, 0);

  it("uses stable date-based gallery names instead of parsed item counts", () => {
    expect(twitterGalleryTitleFromURL("https://x.com/home", "", date)).toBe("twitter-home-2026-05-31");
    expect(twitterGalleryTitleFromURL("https://twitter.com/home", "", date)).toBe("twitter-home-2026-05-31");
  });

  it("keeps user and list timelines readable", () => {
    expect(twitterGalleryTitleFromURL("https://x.com/MapoMagpie/media", "", date)).toBe("twitter-user-MapoMagpie-2026-05-31");
    expect(twitterGalleryTitleFromURL("https://x.com/i/lists/12345", "", date)).toBe("twitter-list-12345-2026-05-31");
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

    expect(twitterSourceTags(item)).toEqual(["author:artist", "mygo"]);
    expect(twitterAuthorUrls(item)).toEqual(["https://x.com/artist"]);
    expect(twitterPublishedAt(item)).toBe("Thu Oct 11 20:19:24 +0000 2018");
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
    expanded_url: `https://x.com/artist/status/2/photo/1`,
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
