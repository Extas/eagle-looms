import { describe, expect, it } from "vitest";
import { twitterEagleAuthorUrls, twitterEagleSourceTags } from "./twitter";

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
});
