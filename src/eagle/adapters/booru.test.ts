import { describe, expect, it } from "vitest";
import { sourceTagsFromGalleryMeta } from "../tags";
import { booruEagleItemBaseName, booruGalleryMetaFromState, booruPublishedAtFromDocument, extractBooruAuthorUrls, extractBooruSourceTags, normalizeBooruSourceTags } from "./booru";

describe("booru source tags", () => {
  it("normalizes known booru categories and keeps other tags raw", () => {
    const element = document.createElement("article");
    element.setAttribute("data-tag-string-copyright", "project_sekai");
    element.setAttribute("data-tag-string-character", "kusanagi_nene");
    element.setAttribute("data-tag-string-artist", "soha_blan");

    expect(normalizeBooruSourceTags(element, [
      "project_sekai",
      "kusanagi_nene",
      "soha_blan",
      "purple_eyes",
      "food",
    ])).toEqual([
      "copyright:project_sekai",
      "character:kusanagi_nene",
      "author:soha_blan",
      "purple_eyes",
      "food",
    ]);
  });

  it("imports raw tags when category metadata is unavailable", () => {
    expect(normalizeBooruSourceTags(document.createElement("article"), ["blue_eyes", "looking_at_viewer"])).toEqual([
      "blue_eyes",
      "looking_at_viewer",
    ]);
  });

  it("extracts category tags from booru detail-page tag lists", () => {
    document.body.innerHTML = `
      <ul>
        <li class="tag-type-copyright"><a>project_sekai 403</a></li>
        <li class="tag-type-character"><a>kusanagi_nene 26</a></li>
        <li class="tag-type-artist"><a>soha_blan 11</a></li>
      </ul>
    `;

    expect(extractBooruSourceTags(document, [
      "project_sekai",
      "kusanagi_nene",
      "soha_blan",
      "purple_eyes",
    ])).toEqual([
      "copyright:project_sekai",
      "character:kusanagi_nene",
      "author:soha_blan",
      "purple_eyes",
    ]);
  });

  it("extracts category tags from descendant data attributes on detail pages", () => {
    document.body.innerHTML = `
      <article
        data-tag-string-copyright="bang_dream"
        data-tag-string-character="takamatzu_tomori"
        data-tag-string-artist="artist_name"
        data-tag-string-general="blue_eyes long_hair"
        data-tag-string-meta="highres"
      ></article>
    `;

    expect(extractBooruSourceTags(document, ["blue_eyes"])).toEqual([
      "copyright:bang_dream",
      "character:takamatzu_tomori",
      "author:artist_name",
      "blue_eyes",
      "long_hair",
      "highres",
    ]);
  });

  it("derives publish timestamps from booru detail pages", () => {
    document.body.innerHTML = `<article data-created-at="2026-06-14T08:00:00Z"></article>`;
    expect(booruPublishedAtFromDocument(document)).toBe("2026-06-14T08:00:00Z");

    document.body.innerHTML = `<time datetime="2026-06-15T09:00:00Z"></time>`;
    expect(booruPublishedAtFromDocument(document)).toBe("2026-06-15T09:00:00Z");
  });

  it("supports author-like booru data attributes", () => {
    const element = document.createElement("article");
    element.setAttribute("data-tag-string-author", "author_name");
    element.setAttribute("data-tag-string-creator", "creator_name");
    element.setAttribute("data-tag-string-translator", "translator_name");
    element.setAttribute("data-tag-string-letterer", "letterer_name");

    expect(normalizeBooruSourceTags(element, [])).toEqual([
      "author:author_name",
      "author:creator_name",
      "author:translator_name",
      "author:letterer_name",
    ]);
  });

  it("supports copyright-like booru data attributes and tag lists", () => {
    document.body.innerHTML = `
      <article
        data-tag-string-parody="project_sekai"
        data-tag-string-source-work="bang_dream"
        data-tag-string-franchise="vocaloid"
      ></article>
      <ul>
        <li class="tag-type-series"><a>blue_archive 120K</a></li>
        <li data-category="original-work"><a>girls_band_cry +23</a></li>
      </ul>
    `;

    expect(extractBooruSourceTags(document, [
      "project_sekai",
      "bang_dream",
      "vocaloid",
      "blue_archive",
      "girls_band_cry",
      "purple_eyes",
    ])).toEqual([
      "copyright:project_sekai",
      "copyright:bang_dream",
      "copyright:vocaloid",
      "copyright:blue_archive",
      "copyright:girls_band_cry",
      "purple_eyes",
    ]);
  });

  it("supports Danbooru numeric tag category classes and keeps general/meta tags raw", () => {
    document.body.innerHTML = `
      <ul>
        <li class="category-3"><a>project_sekai (403)</a></li>
        <li class="category-4"><a>kusanagi_nene 26</a></li>
        <li class="category-1"><a>soha_blan 11</a></li>
        <li class="category-0"><a>blue_eyes [120K]</a></li>
        <li class="category-5"><a>highres [80K]</a></li>
      </ul>
    `;

    expect(extractBooruSourceTags(document, [])).toEqual([
      "copyright:project_sekai",
      "character:kusanagi_nene",
      "author:soha_blan",
      "blue_eyes",
      "highres",
    ]);
  });

  it("supports numeric tag-type classes from booru tag lists", () => {
    document.body.innerHTML = `
      <ul>
        <li class="tag-type-3"><a>project_sekai</a></li>
        <li class="tag-type-4"><a>kusanagi_nene</a></li>
        <li class="tag-type-1"><a>soha_blan</a></li>
        <li class="tag-type-0"><a>blue_eyes</a></li>
        <li class="tag-type-5"><a>highres</a></li>
      </ul>
    `;

    expect(extractBooruSourceTags(document, [])).toEqual([
      "copyright:project_sekai",
      "character:kusanagi_nene",
      "author:soha_blan",
      "blue_eyes",
      "highres",
    ]);
  });

  it("extracts author tag links as traceable author URLs", () => {
    document.body.innerHTML = `
      <ul>
        <li class="tag-type-artist"><a href="/artists?search[name]=soha_blan">soha_blan 11</a></li>
        <li class="category-1"><a href="https://gelbooru.com/index.php?page=post&s=list&tags=artist_name">artist_name 4</a></li>
        <li class="tag-type-translator"><a href="/artists?search[name]=translation_circle">translation_circle</a></li>
        <li data-category="editor"><a href="/index.php?page=post&s=list&tags=source_editor">source_editor</a></li>
        <li class="tag-type-illustrator"><a href="/artists?search[name]=source_illustrator">source_illustrator</a></li>
        <li class="category-mangaka"><a href="/artists?search[name]=source_mangaka">source_mangaka</a></li>
        <li class="tag-type-artist"><a href="#">ignored_anchor</a></li>
      </ul>
    `;

    expect(extractBooruAuthorUrls(document, "https://danbooru.donmai.us/posts/1")).toEqual([
      "https://danbooru.donmai.us/artists?search[name]=soha_blan",
      "https://danbooru.donmai.us/artists?search[name]=source_illustrator",
      "https://danbooru.donmai.us/artists?search[name]=translation_circle",
      "https://danbooru.donmai.us/artists?search[name]=source_mangaka",
      "https://gelbooru.com/index.php?page=post&s=list&tags=artist_name",
      "https://danbooru.donmai.us/index.php?page=post&s=list&tags=source_editor",
    ]);
  });

  it("builds gallery metadata with per-post source tag buckets", () => {
    const meta = booruGalleryMetaFromState(
      "gelbooru",
      "https://gelbooru.com/index.php?page=post&s=list&tags=project_sekai",
      undefined,
      {
        "100": ["copyright:project_sekai", "character:kusanagi_nene", "author:soha_blan", "blue_eyes"],
        "101": ["wrong_post"],
      },
    );

    expect(meta.title).toBe("gelbooru-search-project_sekai");
    expect(sourceTagsFromGalleryMeta(meta, "https://gelbooru.com/index.php?page=post&s=view&id=100")).toEqual([
      "copyright:project_sekai",
      "character:kusanagi_nene",
      "author:soha_blan",
      "blue_eyes",
    ]);
  });

  it("uses a stable single-post booru gallery title", () => {
    const meta = booruGalleryMetaFromState(
      "Danbooru",
      "https://danbooru.donmai.us/posts/100",
      "100",
      { "100": ["copyright:project_sekai"] },
    );

    expect(meta.title).toBe("danbooru-posts");
    expect(sourceTagsFromGalleryMeta(meta, "https://danbooru.donmai.us/posts/100")).toEqual([
      "copyright:project_sekai",
    ]);
  });

  it("keeps single-post item identity readable without treating the asset as a gallery", () => {
    expect(booruEagleItemBaseName(
      "1265763.jpg",
      "https://yande.re/post/show/1265763",
      ["author:hamaken.", "cleavage", "wet"],
    )).toBe("hamaken. - yande.re-1265763.jpg");

    expect(booruEagleItemBaseName(
      "987654.png",
      "https://gelbooru.com/index.php?page=post&s=view&id=987654",
      ["author:a_very_long_artist", "author:soha_blan", "copyright:project_sekai", "copyright:vocaloid"],
    )).toBe("soha blan - vocaloid - gelbooru-987654.png");

    expect(booruEagleItemBaseName(
      "source-image.webp",
      "https://example.test/posts/1",
      ["author:artist_name"],
    )).toBe("source-image.webp");
  });
});
