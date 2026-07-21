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

  it("keeps only identity-bearing query parameters on query-based booru sites", () => {
    expect(canonicalEagleSourceUrl(
      "index.php?tags=project_sekai&id=100&s=view&page=post&pid=42#comments",
      "https://gelbooru.com/index.php?page=post&s=list&tags=project_sekai",
    )).toBe("https://gelbooru.com/index.php?page=post&s=view&id=100");

    expect(canonicalEagleSourceUrl(
      "https://rule34.us/index.php?ref=gallery&id=200&r=posts%2Fview",
      "https://rule34.us/index.php?r=posts/index",
    )).toBe("https://rule34.us/index.php?r=posts/view&id=200");
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

  it.each([
    ["https://danbooru.donmai.us/posts/101?q=artist#comments", "https://danbooru.donmai.us/posts/101"],
    ["https://e621.net/posts/102?pool_id=3", "https://e621.net/posts/102"],
    ["http://yande.re/post/show/103?tags=artist", "https://yande.re/post/show/103"],
    ["https://www.konachan.com/post/show/104#comments", "https://konachan.com/post/show/104"],
    ["https://rule34.xxx/index.php?id=105&s=view&page=post&tags=test", "https://rule34.xxx/index.php?page=post&s=view&id=105"],
    ["https://www.pixiv.net/en/artworks/106?utm_source=share#viewer", "https://www.pixiv.net/artworks/106"],
    ["https://exhentai.org/s/key/107-8?nl=retry-token", "https://exhentai.org/s/key/107-8"],
    ["https://e-hentai.org/s/key/108-9?nl=retry-token", "https://e-hentai.org/s/key/108-9"],
  ])("maps a supported detail route to its stable entity URL", (input, expected) => {
    expect(canonicalEagleSourceUrl(input, "https://example.test/list")).toBe(expected);
  });
});
