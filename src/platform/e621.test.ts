import { afterEach, describe, expect, it, vi } from "vitest";
import type { E621Post } from "../eagle/adapters/booru";
import { E621Matcher } from "./matchers/danbooru";

vi.mock("$", () => ({
  GM: { xmlHttpRequest: () => undefined },
  GM_getValue: () => null,
  GM_setValue: () => undefined,
}));

const originalLocation = Object.getOwnPropertyDescriptor(window, "location")!;

afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(window, "location", originalLocation);
});

describe("e621 matcher metadata", () => {
  it("enriches one list page with a single categorized API request", async () => {
    setLocation("https://e621.net/posts?tags=rating%3Asafe+wolf");
    const posts = [e621Post(6561306, "png"), e621Post(6561299, "jpg")];
    const fetchMock = vi.spyOn(window, "fetch").mockResolvedValue(jsonResponse({ posts }));
    const doc = parseDocument(`
      <div class="posts-container">
        ${e621Card(6561306, "png")}
        ${e621Card(6561299, "jpg")}
      </div>
    `);

    const matcher = new E621Matcher();
    const nodes = await matcher.parseImgNodes(doc);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestUrl = new URL(String(fetchMock.mock.calls[0][0]));
    expect(requestUrl.pathname).toBe("/posts.json");
    expect(requestUrl.searchParams.get("tags")).toBe("id:6561306,6561299");
    expect(requestUrl.searchParams.get("limit")).toBe("2");
    expect(nodes.map(node => node.title)).toEqual(["6561306.png", "6561299.jpg"]);
    expect(nodes[0].publishedAt).toBe("2026-07-20T22:47:05.859-04:00");
    expect(nodes[0].rect).toEqual({ w: 2720, h: 4096 });
    expect([...nodes[0].tags]).toEqual([
      "ext:jpg",
      "copyright:short_work",
      "character:wolf_witch",
      "author:kalathean",
      "braided_hair",
      "green_eyes",
      "canid",
      "wolf",
      "absurd_res",
      "hi_res",
    ]);
    expect(nodes[0].authorUrls).toEqual(["https://e621.net/posts?tags=kalathean"]);
    expect(matcher.tags["6561306"]).toEqual([...nodes[0].tags].slice(1));
    expect(matcher.cachedOriginMeta(nodes[0].href)).toMatchObject({
      url: "https://static1.e621.net/data/sample/6561306.jpg",
      title: "6561306.jpg",
      publishedAt: "2026-07-20T22:47:05.859-04:00",
    });
  });

  it("supports a single post route through the official post endpoint", async () => {
    setLocation("https://e621.net/posts/6561306?pool_id=3");
    const fetchMock = vi.spyOn(window, "fetch").mockResolvedValue(jsonResponse({ post: e621Post(6561306, "png") }));
    const matcher = new E621Matcher();

    const nodes = await matcher.parseImgNodes(parseDocument("<main></main>"));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://e621.net/posts/6561306.json");
    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({
      href: "https://e621.net/posts/6561306",
      title: "6561306.png",
      publishedAt: "2026-07-20T22:47:05.859-04:00",
    });
    expect(matcher.galleryMeta().title).toBe("e621-posts");
    expect(matcher.galleryMeta().tags?.["6561306"]).toContain("author:kalathean");
  });

  it("keeps card collection usable when e621 metadata enrichment fails", async () => {
    setLocation("https://e621.net/posts?tags=wolf");
    vi.spyOn(window, "fetch").mockResolvedValue(new Response("unavailable", { status: 503 }));
    const matcher = new E621Matcher();

    const nodes = await matcher.parseImgNodes(parseDocument(`<div class="posts-container">${e621Card(6561306, "png")}</div>`));

    expect(nodes).toHaveLength(1);
    expect(nodes[0].title).toBe("6561306.png");
    expect(nodes[0].publishedAt).toBe("2026-07-20T22:47:05.859-04:00");
    expect([...nodes[0].tags]).toEqual(expect.arrayContaining(["braided_hair", "wolf"]));
  });
});

function setLocation(url: string): void {
  Object.defineProperty(window, "location", { configurable: true, value: new URL(url) });
}

function parseDocument(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function e621Card(id: number, extension: string): string {
  return `
    <article
      data-id="${id}"
      data-tags="braided_hair green_eyes canid wolf absurd_res hi_res"
      data-file-ext="${extension}"
      data-width="2720"
      data-height="4096"
      data-created-at="&quot;2026-07-20T22:47:05.859-04:00&quot;"
      data-preview-url="https://static1.e621.net/data/preview/${id}.jpg"
      data-sample-url="https://static1.e621.net/data/sample/${id}.jpg"
      data-file-url="https://static1.e621.net/data/${id}.${extension}"
    ></article>
  `;
}

function e621Post(id: number, extension: string): E621Post {
  return {
    id,
    created_at: "2026-07-20T22:47:05.859-04:00",
    file: {
      width: 2720,
      height: 4096,
      ext: extension,
      url: `https://static1.e621.net/data/${id}.${extension}`,
    },
    preview: { url: `https://static1.e621.net/data/preview/${id}.jpg` },
    sample: { url: `https://static1.e621.net/data/sample/${id}.jpg` },
    tags: {
      general: ["braided_hair", "green_eyes"],
      species: ["canid", "wolf"],
      character: ["wolf_witch"],
      copyright: ["short_work"],
      artist: ["kalathean"],
      meta: ["absurd_res", "hi_res"],
    },
  };
}
