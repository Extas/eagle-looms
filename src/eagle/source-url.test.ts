import { describe, expect, it } from "vitest";
import { canonicalEagleSourceUrl } from "./source-url";

describe("Eagle source URL identity", () => {
  it("maps Anime Pictures navigation variants to one post identity", () => {
    expect(canonicalEagleSourceUrl(
      "/posts/908175?by_tag=201352&lang=en#comments",
      "https://anime-pictures.net/posts?page=0&search_tag=bang+dream",
    )).toBe("https://anime-pictures.net/posts/908175");

    expect(canonicalEagleSourceUrl(
      "https://www.anime-pictures.net/pictures/view_post/908175?lang=ru",
      "https://anime-pictures.net/posts",
    )).toBe("https://anime-pictures.net/posts/908175");
  });

  it("keeps identity-bearing query parameters on other sites", () => {
    expect(canonicalEagleSourceUrl(
      "index.php?page=post&s=view&id=100#comments",
      "https://gelbooru.com/index.php?page=post&s=list&tags=project_sekai",
    )).toBe("https://gelbooru.com/index.php?page=post&s=view&id=100");
  });

  it("maps Twitter domains and tracking parameters to one X media identity", () => {
    expect(canonicalEagleSourceUrl(
      "https://mobile.twitter.com/Artist/status/123/photo/2?s=20&t=tracking#image",
      "https://x.com/home",
    )).toBe("https://x.com/Artist/status/123/photo/2");
    expect(canonicalEagleSourceUrl(
      "https://www.x.com/Artist/status/123/video/1?ref_src=twsrc",
      "https://x.com/Artist/media",
    )).toBe("https://x.com/Artist/status/123/video/1");
  });

  it("does not turn unsupported protocols into web identities", () => {
    expect(canonicalEagleSourceUrl("javascript:alert(1)", "https://example.test/posts#top")).toBe("https://example.test/posts");
  });
});
