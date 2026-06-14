import { describe, expect, it } from "vitest";
import { extractBooruAuthorUrls, extractBooruSourceTags, normalizeBooruSourceTags } from "./booru-tags";

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
        <li class="tag-type-artist"><a href="#">ignored_anchor</a></li>
      </ul>
    `;

    expect(extractBooruAuthorUrls(document, "https://danbooru.donmai.us/posts/1")).toEqual([
      "https://danbooru.donmai.us/artists?search[name]=soha_blan",
      "https://danbooru.donmai.us/artists?search[name]=translation_circle",
      "https://gelbooru.com/index.php?page=post&s=list&tags=artist_name",
      "https://danbooru.donmai.us/index.php?page=post&s=list&tags=source_editor",
    ]);
  });
});
