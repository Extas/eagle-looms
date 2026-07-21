import { describe, expect, it, vi } from "vitest";
import { KonachanMatcher } from "./matchers/konachan";
import { YandereMatcher } from "./matchers/yandere";

vi.mock("$", () => ({
  GM: { xmlHttpRequest: () => undefined },
  GM_getValue: () => null,
  GM_setValue: () => undefined,
}));

function parseDocument(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

function moebooruDetailDocument(): Document {
  return parseDocument(`
    <script>
      Post.register_tags({
        "soha_blan": "artist",
        "project_sekai": "copyright",
        "kusanagi_nene": "character",
        "blue_eyes": "general"
      });
      Post.register({
        "id": 100,
        "file_ext": "jpg",
        "file_url": "https://files.yande.re/image.jpg",
        "sample_url": "https://files.yande.re/sample.jpg",
        "preview_url": "https://files.yande.re/preview.jpg",
        "width": 1200,
        "height": 1600,
        "tags": "soha_blan project_sekai kusanagi_nene blue_eyes",
        "created_at": "2026-06-14T08:00:00Z"
      });
      Post.register({
        "id": 101,
        "file_ext": "png",
        "file_url": "https://files.yande.re/other.png",
        "sample_url": "https://files.yande.re/other-sample.png",
        "preview_url": "https://files.yande.re/other-preview.png",
        "tags": "wrong_post"
      });
    </script>
  `);
}

function currentMoebooruDetailDocument(): Document {
  return parseDocument(`
    <script>
      Post.register_resp({
        "posts": [{
          "id": 1266139,
          "file_ext": "jpg",
          "file_url": "https://files.yande.re/image/1266139.jpg",
          "sample_url": "https://files.yande.re/sample/1266139.jpg",
          "preview_url": "https://assets.yande.re/data/preview/1266139.jpg",
          "width": 1200,
          "height": 1660,
          "tags": "animal_ears genshin_impact lumine pottsness",
          "created_at": 1784602548
        }],
        "tags": {
          "animal_ears": "general",
          "genshin_impact": "copyright",
          "lumine": "character",
          "pottsness": "artist"
        }
      });
      Post.register({
        "id": 1266000,
        "file_ext": "jpg",
        "file_url": "https://files.yande.re/image/related.jpg",
        "sample_url": "https://files.yande.re/sample/related.jpg",
        "preview_url": "https://files.yande.re/preview/related.jpg",
        "tags": "related_post"
      });
    </script>
  `);
}

describe("Moebooru matcher metadata", () => {
  it("supports yande.re post detail pages with categorized source tags", async () => {
    window.history.pushState({}, "", "/post/show/100");

    const matcher = new YandereMatcher();
    const nodes = await matcher.parseImgNodes(moebooruDetailDocument());

    expect(nodes).toHaveLength(1);
    expect(nodes[0].title).toBe("100.jpg");
    expect(nodes[0].publishedAt).toBe("2026-06-14T08:00:00Z");
    expect(nodes[0].rect).toEqual({ w: 1200, h: 1600 });
    expect([...nodes[0].tags]).toEqual([
      "ext:jpg",
      "author:soha_blan",
      "copyright:project_sekai",
      "character:kusanagi_nene",
      "blue_eyes",
    ]);
    expect(matcher.galleryMeta().title).toBe("yande.re-posts");
  });

  it("supports konachan post detail pages through the same Post.register parser", async () => {
    window.history.pushState({}, "", "/post/show/100");

    const nodes = await new KonachanMatcher().parseImgNodes(moebooruDetailDocument());

    expect(nodes).toHaveLength(1);
    expect(nodes[0].title).toBe("100.jpg");
    expect([...nodes[0].tags]).toContain("copyright:project_sekai");
  });

  it("supports current Post.register_resp detail payloads", async () => {
    window.history.pushState({}, "", "/post/show/1266139");

    const matcher = new YandereMatcher();
    const nodes = await matcher.parseImgNodes(currentMoebooruDetailDocument());

    expect(nodes).toHaveLength(1);
    expect(nodes[0].title).toBe("1266139.jpg");
    expect(nodes[0].publishedAt).toBe("1784602548");
    expect(nodes[0].rect).toEqual({ w: 1200, h: 1660 });
    expect([...nodes[0].tags]).toEqual([
      "ext:jpg",
      "animal_ears",
      "copyright:genshin_impact",
      "character:lumine",
      "author:pottsness",
    ]);
    expect(nodes[0].authorUrls).toEqual([
      new URL("/post?tags=pottsness", window.location.href).href,
    ]);
    expect(matcher.galleryMeta().title).toBe("yande.re-posts");
  });
});
