import { describe, expect, it, vi } from "vitest";
import { defaultConf } from "../config";
import { twitterItemAuthorUrls, twitterItemPublishedAt, twitterItemSourceTags } from "../eagle/adapters/twitter";
import { ADAPTER } from "./adapt";
import { parseTwitterApiJsonText, readTwitterApiJsonResponse, TWITTER_WORK_URLS, TwitterMatcher, twitterGalleryTitleFromURL, twitterPageKindFromURL, twitterStatusEndpointURL, twitterStatusIdentityFromURL, twitterStatusItemFromResponse, twitterStatusItemFromSyndication, twitterSyndicationURL } from "./matchers/twitter";

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

  it("activates the authenticated internal timeline as a home feed", () => {
    const href = "https://x.com/i/timeline";

    expect(TWITTER_WORK_URLS.some(pattern => pattern.test(href))).toBe(true);
    expect(twitterPageKindFromURL(href)).toBe("home");
    expect(twitterGalleryTitleFromURL(href, "", date)).toBe("twitter-home-2026-05-31");
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

  it("builds the public status fallback URL used by react-tweet", () => {
    const url = new URL(twitterSyndicationURL("2079441105414988119"));
    expect(url.origin).toBe("https://cdn.syndication.twimg.com");
    expect(url.pathname).toBe("/tweet-result");
    expect(url.searchParams.get("id")).toBe("2079441105414988119");
    expect(url.searchParams.get("token")).toBe("51gr8xxxfq8");
    expect(url.searchParams.get("features")).toContain("tfw_tweet_edit_backend:on");
    expect(() => twitterSyndicationURL("not-a-post")).toThrow("invalid post id");
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
      title: "2079441105414988119-1-smhuQln7hJ2hx7yk.mp4",
      href: "https://x.com/SadhnaNews24X7/status/2079441105414988119/video/1",
      originSrc: "https://video.twimg.com/video-high.mp4",
      mimeType: "video/mp4",
      publishedAt: "Tue Jul 21 13:39:00 +0000 2026",
    });
  });

  it("normalizes the live public fallback response and keeps its highest-bitrate MP4", async () => {
    const item = twitterStatusItemFromSyndication({
      __typename: "Tweet",
      id_str: "2079441105414988119",
      created_at: "2026-07-21T05:39:28Z",
      text: "news #cgnews",
      user: { screen_name: "SadhnaNews24X7" },
      entities: { hashtags: [{ text: "cgnews" }] },
      mediaDetails: [{
        expanded_url: "https://x.com/SadhnaNews24X7/status/2079441105414988119/video/1",
        media_url_https: "https://pbs.twimg.com/amplify_video_thumb/2079440969666351104/img/smhuQln7hJ2hx7yk.jpg",
        type: "video",
        sizes: {
          large: { w: 854, h: 480 }, medium: { w: 854, h: 480 },
          small: { w: 680, h: 382 }, thumb: { w: 150, h: 150 },
        },
        original_info: { width: 854, height: 480 },
        video_info: {
          variants: [
            { content_type: "application/x-mpegURL", url: "https://video.twimg.com/video.m3u8" },
            { bitrate: 832000, content_type: "video/mp4", url: "https://video.twimg.com/amplify_video/2079440969666351104/vid/avc1/640x360/zDBAymNMKoPHbfWr.mp4?tag=14" },
            { bitrate: 2176000, content_type: "video/mp4", url: "https://video.twimg.com/amplify_video/2079440969666351104/vid/avc1/854x480/ycPPAouapjmglkY0.mp4?tag=14" },
          ],
        },
      }],
    });

    expect(twitterItemSourceTags(item!)).toEqual(["author:SadhnaNews24X7", "cgnews"]);
    expect(twitterItemAuthorUrls(item!)).toEqual(["https://x.com/SadhnaNews24X7"]);
    expect(twitterItemPublishedAt(item!)).toBe("2026-07-21T05:39:28Z");

    ADAPTER.conf = defaultConf();
    const [node] = await new TwitterMatcher().parseImgNodes([item!] as any);
    expect(node).toMatchObject({
      title: "2079441105414988119-1-smhuQln7hJ2hx7yk.mp4",
      href: "https://x.com/SadhnaNews24X7/status/2079441105414988119/video/1",
      originSrc: "https://video.twimg.com/amplify_video/2079440969666351104/vid/avc1/854x480/ycPPAouapjmglkY0.mp4?tag=14",
      mimeType: "video/mp4",
      publishedAt: "2026-07-21T05:39:28Z",
    });
  });
});

describe("Twitter API response parsing", () => {
  it("reports empty response bodies with their HTTP status", async () => {
    await expect(readTwitterApiJsonResponse(new Response("", { status: 200 })))
      .rejects.toThrow("empty Twitter API response (HTTP 200)");
  });

  it("reports non-JSON bodies with a response preview", async () => {
    await expect(readTwitterApiJsonResponse(new Response("<html>login expired</html>", { status: 200 })))
      .rejects.toThrow(/invalid JSON in Twitter API response \(HTTP 200\).*body starts: <html>login expired<\/html>/);
  });

  it("prefers the GraphQL error message over the HTTP status", async () => {
    const body = JSON.stringify({ errors: [{ message: "Rate limit exceeded" }] });

    await expect(readTwitterApiJsonResponse(new Response(body, { status: 429 })))
      .rejects.toThrow("Rate limit exceeded");
  });

  it("reports an unsuccessful HTTP status when the JSON has no GraphQL error", async () => {
    await expect(readTwitterApiJsonResponse(new Response('{"data":null}', {
      status: 503,
      statusText: "Service Unavailable",
    }))).rejects.toThrow("HTTP 503 Service Unavailable");
  });

  it("uses the same empty-body guard for text responses", () => {
    expect(() => parseTwitterApiJsonText("", "Twitter public fallback response"))
      .toThrow("empty Twitter public fallback response");
  });
});
