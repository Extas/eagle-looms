import { describe, expect, it, vi } from "vitest";
import { twitterItemAuthorUrls, twitterItemPublishedAt, twitterItemSourceTags } from "../eagle/adapters/twitter";
import { twitterGalleryTitleFromURL, twitterStatusIdentityFromURL, twitterStatusItemFromDocument } from "./matchers/twitter";

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

  it("extracts only the requested post photos and source metadata from the rendered page", () => {
    document.body.innerHTML = `
      <article>
        <a href="/Tsurumi_vov">@Tsurumi_vov</a>
        <a href="/hashtag/mygo">#mygo</a>
        <a href="/Tsurumi_vov/status/2075580242895528190/photo/1">
          <img src="https://pbs.twimg.com/media/HM3xN_ubgAA6Hh5?format=jpg&amp;name=small" width="475" height="680">
        </a>
        <time datetime="2026-07-10T13:57:00.000Z"></time>
      </article>
      <article>
        <a href="/other/status/999/photo/1"><img src="https://pbs.twimg.com/media/other?format=jpg&amp;name=small"></a>
      </article>`;

    const item = twitterStatusItemFromDocument("https://x.com/Tsurumi_vov/status/2075580242895528190");

    expect(item?.itemContent.tweet_results.result.legacy?.entities.media).toEqual([
      expect.objectContaining({
        id_str: "2075580242895528190-1",
        expanded_url: "https://x.com/Tsurumi_vov/status/2075580242895528190/photo/1",
        media_url_https: "https://pbs.twimg.com/media/HM3xN_ubgAA6Hh5.jpg",
        type: "photo",
      }),
    ]);
    expect(twitterItemSourceTags(item!)).toEqual(["author:Tsurumi_vov", "mygo"]);
    expect(twitterItemAuthorUrls(item!)).toEqual(["https://x.com/Tsurumi_vov"]);
    expect(twitterItemPublishedAt(item!)).toBe("2026-07-10T13:57:00.000Z");
  });
});
