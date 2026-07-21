import { describe, expect, it, vi } from "vitest";
import { defaultConf } from "../config";
import { twitterItemAuthorUrls, twitterItemPublishedAt, twitterItemSourceTags } from "../eagle/adapters/twitter";
import { ADAPTER } from "./adapt";
import { TwitterMatcher, twitterGalleryTitleFromURL, twitterStatusEndpointURL, twitterStatusIdentityFromURL, twitterStatusItemFromResponse } from "./matchers/twitter";

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

  it("keeps user and list timelines readable without author folders", () => {
    expect(twitterGalleryTitleFromURL("https://x.com/MapoMagpie/media", "", date)).toBe("twitter-user-2026-05-31");
    expect(twitterGalleryTitleFromURL("https://x.com/i/lists/12345", "", date)).toBe("twitter-list-12345-2026-05-31");
  });

  it("models a single status page as one post instead of a user timeline", () => {
    expect(twitterStatusIdentityFromURL("https://x.com/Tsurumi_vov/status/2075580242895528190")).toEqual({
      screenName: "Tsurumi_vov",
      statusId: "2075580242895528190",
    });
    expect(twitterGalleryTitleFromURL("https://x.com/Tsurumi_vov/status/2075580242895528190", "", date))
      .toBe("twitter-post-2026-05-31");
  });

  it("uses the focused status endpoint rather than an author timeline endpoint", () => {
    const url = new URL(twitterStatusEndpointURL("2075580242895528190"));
    expect(url.pathname).toMatch(/\/TweetResultByRestId$/);
    expect(JSON.parse(url.searchParams.get("variables") || "{}")).toMatchObject({
      tweetId: "2075580242895528190",
      includePromotedContent: false,
    });
  });

  it("normalizes the focused post response with photo and video variants", async () => {
    const item = twitterStatusItemFromResponse({
      data: {
        tweetResult: {
          result: {
            rest_id: "2079441105414988119",
            core: { user_results: { result: { legacy: { screen_name: "SadhnaNews24X7" } } } },
            legacy: {
              id_str: "2079441105414988119",
              created_at: "Tue Jul 21 13:39:00 +0000 2026",
              full_text: "news #cgnews",
              possibly_sensitive: false,
              possibly_sensitive_editable: false,
              entities: { media: [], hashtags: [{ text: "cgnews" }] },
              extended_entities: {
                media: [{
                  id_str: "2079440969666351104",
                  expanded_url: "https://x.com/SadhnaNews24X7/status/2079441105414988119/video/1",
                  media_url_https: "https://pbs.twimg.com/amplify_video_thumb/2079440969666351104/img/smhuQln7hJ2hx7yk.jpg",
                  type: "video",
                  sizes: {
                    large: { w: 1280, h: 720 }, medium: { w: 1200, h: 675 },
                    small: { w: 680, h: 383 }, thumb: { w: 150, h: 150 },
                  },
                  original_info: { width: 1280, height: 720 },
                  video_info: {
                    variants: [
                      { bitrate: 832000, content_type: "video/mp4", url: "https://video.twimg.com/video-low.mp4" },
                      { bitrate: 2176000, content_type: "video/mp4", url: "https://video.twimg.com/video-high.mp4" },
                    ],
                  },
                }],
              },
            },
          },
        },
      },
    });

    expect(item?.itemContent.tweet_results.result.legacy?.entities.media).toEqual([
      expect.objectContaining({
        id_str: "2079440969666351104",
        type: "video",
        video_info: { variants: expect.arrayContaining([expect.objectContaining({ bitrate: 2176000 })]) },
      }),
    ]);
    expect(twitterItemSourceTags(item!)).toEqual(["author:SadhnaNews24X7", "cgnews"]);
    expect(twitterItemAuthorUrls(item!)).toEqual(["https://x.com/SadhnaNews24X7"]);
    expect(twitterItemPublishedAt(item!)).toBe("Tue Jul 21 13:39:00 +0000 2026");

    ADAPTER.conf = defaultConf();
    const [node] = await new TwitterMatcher().parseImgNodes([item!] as any);
    expect(node).toMatchObject({
      title: "2079440969666351104-smhuQln7hJ2hx7yk.mp4",
      href: "https://x.com/SadhnaNews24X7/status/2079441105414988119/video/1",
      originSrc: "https://video.twimg.com/video-high.mp4",
      mimeType: "video/mp4",
      publishedAt: "Tue Jul 21 13:39:00 +0000 2026",
    });
  });
});
