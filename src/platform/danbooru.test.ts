import { describe, expect, it, vi } from "vitest";
import { GelBooruMatcher } from "./matchers/danbooru";

vi.mock("$", () => ({
  GM: { xmlHttpRequest: () => undefined },
  GM_getValue: () => null,
  GM_setValue: () => undefined,
}));

function parseDocument(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

describe("Gelbooru matcher metadata", () => {
  it("reads list-page metadata from thumbnail article wrappers", async () => {
    const doc = parseDocument(`
      <div class="thumbnail-container">
        <article
          class="thumbnail-preview"
          id="p123"
          data-id="123"
          data-created-at="2026-06-14T08:00:00Z"
          data-width="1000"
          data-height="1500"
          data-tag-string-copyright="project_sekai"
          data-tag-string-character="kusanagi_nene"
          data-tag-string-artist="soha_blan"
          data-tag-string-general="blue_eyes long_hair"
        >
          <a href="index.php?page=post&amp;s=view&amp;id=123">
            <img src="https://gelbooru.com/thumbnails/12/34/thumbnail.jpg" alt="project_sekai kusanagi_nene soha_blan blue_eyes long_hair">
          </a>
        </article>
      </div>
    `);

    const nodes = await new GelBooruMatcher().parseImgNodes(doc);

    expect(nodes).toHaveLength(1);
    expect(nodes[0].title).toBe("123.jpg");
    expect(nodes[0].publishedAt).toBe("2026-06-14T08:00:00Z");
    expect(nodes[0].rect).toEqual({ w: 1000, h: 1500 });
    expect([...nodes[0].tags]).toEqual([
      "ext:jpg",
      "copyright:project_sekai",
      "character:kusanagi_nene",
      "author:soha_blan",
      "blue_eyes",
      "long_hair",
    ]);
  });

  it("prefers canonical tags from current Gelbooru cards without card-only metadata", async () => {
    const doc = parseDocument(`
      <div class="thumbnail-container">
        <article class="thumbnail-preview">
          <a id="p14528850" href="https://gelbooru.com/index.php?page=post&amp;s=view&amp;id=14528850&amp;tags=landscape">
            <img
              src="https://img4.gelbooru.com/thumbnails/23/d3/thumbnail_23d3fae7e4a05ae3ffc03607a728cbcf.jpg"
              title="2boys black_hair landscape score:32 rating:sensitive"
              alt="Rule 34 | 2boys, black hair, landscape"
            >
          </a>
        </article>
      </div>
    `);

    const nodes = await new GelBooruMatcher().parseImgNodes(doc);

    expect(nodes).toHaveLength(1);
    expect(nodes[0].title).toBe("14528850.jpg");
    expect([...nodes[0].tags]).toEqual([
      "ext:jpg",
      "2boys",
      "black_hair",
      "landscape",
    ]);
  });

  it("normalizes Gelbooru's readable alt text when canonical card tags are absent", async () => {
    const doc = parseDocument(`
      <div class="thumbnail-container">
        <article class="thumbnail-preview">
          <a id="p14528850" href="https://gelbooru.com/index.php?page=post&amp;s=view&amp;id=14528850">
            <img
              src="https://img4.gelbooru.com/thumbnails/23/d3/thumbnail_23d3fae7e4a05ae3ffc03607a728cbcf.jpg"
              alt="Rule 34 | 2boys, black hair, landscape"
            >
          </a>
        </article>
      </div>
    `);

    const nodes = await new GelBooruMatcher().parseImgNodes(doc);

    expect([...nodes[0].tags]).toEqual([
      "ext:jpg",
      "2boys",
      "black_hair",
      "landscape",
    ]);
  });
});
