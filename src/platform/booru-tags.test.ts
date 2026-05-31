import { describe, expect, it } from "vitest";
import { extractBooruSourceTags, normalizeBooruSourceTags } from "./booru-tags";

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
      ></article>
    `;

    expect(extractBooruSourceTags(document, ["blue_eyes"])).toEqual([
      "copyright:bang_dream",
      "character:takamatzu_tomori",
      "author:artist_name",
      "blue_eyes",
    ]);
  });

  it("supports Danbooru numeric tag category classes and keeps general/meta tags raw", () => {
    document.body.innerHTML = `
      <ul>
        <li class="category-3"><a>project_sekai 403</a></li>
        <li class="category-4"><a>kusanagi_nene 26</a></li>
        <li class="category-1"><a>soha_blan 11</a></li>
        <li class="category-0"><a>blue_eyes 120K</a></li>
        <li class="category-5"><a>highres 80K</a></li>
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
});
