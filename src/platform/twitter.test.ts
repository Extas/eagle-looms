import { describe, expect, it, vi } from "vitest";
import { twitterGalleryTitleFromURL } from "./matchers/twitter";

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
});
