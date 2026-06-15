import { describe, expect, it } from "vitest";
import { sourceTagsFromGalleryMeta } from "../tags";
import { nhentaiAuthorUrlsFromDocument, nhentaiAuthorUrlsFromTags, nhentaiGalleryMetaFromApi, nhentaiGalleryMetaFromDocument, nhentaiPublishedAt, nhentaiPublishedAtFromDocument } from "./nhentai";

describe("nhentai source metadata", () => {
  it("derives published timestamps from API upload dates", () => {
    expect(nhentaiPublishedAt({ upload_date: 1781411696 })).toBe("1781411696");
    expect(nhentaiPublishedAt({ upload_date: "" })).toBe("");
  });

  it("derives published timestamps from structured document dates", () => {
    const doc = new DOMParser().parseFromString(`
      <html><head>
        <meta property="article:published_time" content="2026-06-14T08:00:00Z">
      </head><body></body></html>
    `, "text/html");

    expect(nhentaiPublishedAtFromDocument(doc)).toBe("2026-06-14T08:00:00Z");
  });

  it("falls back to uploaded text dates", () => {
    const doc = new DOMParser().parseFromString(`
      <html><body>
        <section>Uploaded: 2026-06-14 08:00:00</section>
      </body></html>
    `, "text/html");

    expect(nhentaiPublishedAtFromDocument(doc)).toBe("2026-06-14 08:00:00");
  });

  it("extracts author URLs from API tag payloads", () => {
    expect(nhentaiAuthorUrlsFromTags([
      { type: "artist", url: "/artist/soha-blan/" },
      { type: "group", url: "https://nhentai.net/group/circle-name/" },
      { type: "creator", url: "/creator/source-creator/" },
      { type: "writer", url: "/writer/scenario-name/" },
      { type: "editor", url: "/editor/source-editor/" },
      { type: "Illustrator(s)", url: "/illustrator/source-illustrator/" },
      { type: "letterer_name", url: "/letterer/not-a-category/" },
      { type: "tag", url: "/tag/school-uniform/" },
      { type: "artist", url: "/artist/soha-blan/" },
    ], "https://nhentai.net/g/123/")).toEqual([
      "https://nhentai.net/artist/soha-blan/",
      "https://nhentai.net/group/circle-name/",
      "https://nhentai.net/creator/source-creator/",
      "https://nhentai.net/writer/scenario-name/",
      "https://nhentai.net/editor/source-editor/",
      "https://nhentai.net/illustrator/source-illustrator/",
    ]);
  });

  it("builds gallery metadata from nhentai API payloads", () => {
    const meta = nhentaiGalleryMetaFromApi({
      title: {
        english: "English Title",
        japanese: "Japanese Title",
      },
      tags: [
        { type: "parody", name: "project sekai", url: "/parody/project-sekai/" },
        { type: "character", name: "kusanagi nene", url: "/character/kusanagi-nene/" },
        { type: "artist", name: "soha blan", url: "/artist/soha-blan/" },
        { type: "tag", name: "school uniform", url: "/tag/school-uniform/" },
      ],
    }, "https://nhentai.net/g/123/");

    expect(meta.title).toBe("English Title");
    expect(meta.originTitle).toBe("Japanese Title");
    expect(meta.authorUrls).toEqual(["https://nhentai.net/artist/soha-blan/"]);
    expect(sourceTagsFromGalleryMeta(meta, "https://nhentai.net/g/123/1/")).toEqual([
      "copyright:project sekai",
      "character:kusanagi nene",
      "author:soha blan",
      "school uniform",
    ]);
  });

  it("extracts author URLs from nhentai.xxx gallery tag rows", () => {
    document.body.innerHTML = `
      <div class="info">
        <ul>
          <li class="tags">
            <span class="text">Artists:</span>
            <a class="tag_btn" href="/artist/soha-blan/"><span class="tag_name">soha blan</span></a>
          </li>
          <li class="tags">
            <span class="text">Groups:</span>
            <a class="tag_btn" href="https://nhentai.xxx/group/circle-name/"><span class="tag_name">circle name</span></a>
          </li>
          <li class="tags">
            <span class="text">Creators:</span>
            <a class="tag_btn" href="/creator/source-creator/"><span class="tag_name">source creator</span></a>
          </li>
          <li class="tags">
            <span class="text">Letterers:</span>
            <a class="tag_btn" href="/letterer/lettering-name/"><span class="tag_name">lettering name</span></a>
          </li>
          <li class="tags">
            <span class="text">Artist(s):</span>
            <a class="tag_btn" href="/artist/decorated-artist/"><span class="tag_name">decorated artist</span></a>
          </li>
          <li class="tags">
            <span class="text">Tags:</span>
            <a class="tag_btn" href="/tag/school-uniform/"><span class="tag_name">school uniform</span></a>
          </li>
        </ul>
      </div>
    `;

    expect(nhentaiAuthorUrlsFromDocument(document, "https://nhentai.xxx/g/123/")).toEqual([
      "https://nhentai.xxx/artist/soha-blan/",
      "https://nhentai.xxx/group/circle-name/",
      "https://nhentai.xxx/creator/source-creator/",
      "https://nhentai.xxx/letterer/lettering-name/",
      "https://nhentai.xxx/artist/decorated-artist/",
    ]);
  });

  it("builds gallery metadata from nhentai.xxx document rows", () => {
    const doc = new DOMParser().parseFromString(`
      <div class="info">
        <h1> Main Title </h1>
        <h2> Original Title </h2>
        <ul>
          <li class="tags">
            <span class="text">Artists:</span>
            <a class="tag_btn" href="/artist/soha-blan/"><span class="tag_name">soha blan</span></a>
          </li>
          <li class="tags">
            <span class="text">Characters:</span>
            <a class="tag_btn" href="/character/kusanagi-nene/"><span class="tag_name">kusanagi nene</span></a>
          </li>
          <li class="tags">
            <span class="text">Parodies:</span>
            <a class="tag_btn" href="/parody/project-sekai/"><span class="tag_name">project sekai</span></a>
          </li>
          <li class="tags">
            <span class="text">Tags:</span>
            <a class="tag_btn" href="/tag/school-uniform/"><span class="tag_name">school uniform</span></a>
          </li>
        </ul>
      </div>
    `, "text/html");

    const meta = nhentaiGalleryMetaFromDocument(doc, "https://nhentai.xxx/g/123/");

    expect(meta.title).toBe("Main Title");
    expect(meta.originTitle).toBe("Original Title");
    expect(meta.authorUrls).toEqual(["https://nhentai.xxx/artist/soha-blan/"]);
    expect(sourceTagsFromGalleryMeta(meta, "https://nhentai.xxx/g/123/1")).toEqual([
      "author:soha blan",
      "character:kusanagi nene",
      "copyright:project sekai",
      "school uniform",
    ]);
  });
});
