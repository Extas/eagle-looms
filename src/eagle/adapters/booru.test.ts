import { describe, expect, it } from "vitest";
import { sourceTagsFromGalleryMeta } from "../tags";
import { booruEagleItemBaseName, booruGalleryMetaFromState, booruPublishedAtFromDocument, e621AuthorUrls, e621SourceTags, extractBooruAuthorUrls, extractBooruSourceTags, normalizeBooruSourceTags, normalizeCommaSeparatedBooruTagText, type E621Post } from "./booru";

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

  it("maps e621 API categories while retaining every other source tag", () => {
    const post = {
      id: 6561306,
      created_at: "2026-07-20T22:47:05.859-04:00",
      file: { width: 2720, height: 4096, ext: "png", url: "https://static1.e621.net/data/post.png" },
      preview: { url: "https://static1.e621.net/data/preview/post.jpg" },
      sample: { url: "https://static1.e621.net/data/sample/post.jpg" },
      tags: {
        general: ["braided_hair", "green_eyes"],
        species: ["canid", "wolf"],
        character: ["long_character_outfit", "character_name"],
        copyright: ["long_franchise_name", "short_work"],
        artist: ["kalathean", "second_artist"],
        meta: ["absurd_res", "hi_res"],
      },
    } satisfies E621Post;

    expect(e621SourceTags(post)).toEqual([
      "copyright:long_franchise_name",
      "copyright:short_work",
      "character:long_character_outfit",
      "character:character_name",
      "author:kalathean",
      "author:second_artist",
      "braided_hair",
      "green_eyes",
      "canid",
      "wolf",
      "absurd_res",
      "hi_res",
    ]);
    expect(e621AuthorUrls(post)).toEqual([
      "https://e621.net/posts?tags=kalathean",
      "https://e621.net/posts?tags=second_artist",
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

  it("maps Rule34.us list and detail tag formats without fragmented duplicates", () => {
    expect(normalizeCommaSeparatedBooruTagText(
      "monster hunter, my hero academia, 3d (artwork), blue eyes",
    )).toBe("monster_hunter my_hero_academia 3d_(artwork) blue_eyes");

    document.body.innerHTML = `
      <ul class="tag-list-left">
        <li class="copyright-tag"><a href="/index.php?r=posts/index&q=monster_hunter">monster hunter</a></li>
        <li class="character-tag"><a href="/index.php?r=posts/index&q=hero_name">hero name</a></li>
        <li class="artist-tag"><a href="/index.php?r=posts/index&q=artist_name">artist name</a></li>
        <li class="general-tag"><a href="/index.php?r=posts/index&q=blue_eyes">blue eyes</a></li>
        <li class="metadata-tag"><a href="/index.php?r=posts/index&q=highres">highres</a></li>
      </ul>
    `;

    expect(extractBooruSourceTags(document, [
      "monster_hunter",
      "hero_name",
      "artist_name",
      "blue_eyes",
    ])).toEqual([
      "copyright:monster hunter",
      "character:hero name",
      "author:artist name",
      "blue eyes",
      "highres",
    ]);
    expect(extractBooruAuthorUrls(document, "https://rule34.us/index.php?r=posts/view&id=13192921")).toEqual([
      "https://rule34.us/index.php?r=posts/index&q=artist_name",
    ]);
  });

  it("does not import Rule34.us statistics and moderation actions as source tags", () => {
    document.body.innerHTML = `
      <ul class="tag-list-left">
        <li class="general-tag"><a href="/index.php?r=posts/index&q=blue_eyes">blue eyes</a></li>
        <li class="metadata-tag">Added by: <a href="index.php?r=account/profile&id=2">Anonymous</a></li>
        <li class="general-tag"><div><a href="#" onclick="pflag('13192921')">Flag for Deletion</a></div></li>
        <li class="general-tag">Source: <a href="https://example.test/source/13192921">external source</a></li>
      </ul>
    `;

    expect(extractBooruSourceTags(document, [])).toEqual(["blue eyes"]);
  });

  it("ignores Gelbooru tag controls and reads its textual Posted timestamp", () => {
    document.body.innerHTML = `
      <ul class="tag-list" id="tag-list">
        <li class="tag-type-artist">
          <a href="index.php?page=wiki&s=list&search=banakotakemaru" title="Wiki">?</a>
          <a href="index.php?page=post&s=list&tags=banakotakemaru">banakotakemaru</a>
        </li>
        <li class="tag-type-copyright">
          <a href="index.php?page=wiki&s=list&search=original" title="Wiki">?</a>
          <a href="index.php?page=post&s=list&tags=original">original</a>
        </li>
        <li class="tag-type-general">
          <a href="javascript:;" title="Add to search">+</a>
          <a href="index.php?page=post&s=list&tags=black_hair">black hair</a>
        </li>
        <li>Posted: 2026-07-19 19:46:08<br>Uploader: danbooru</li>
      </ul>
    `;

    expect(extractBooruSourceTags(document, [])).toEqual([
      "copyright:original",
      "author:banakotakemaru",
      "black hair",
    ]);
    expect(extractBooruAuthorUrls(document, "https://gelbooru.com/index.php?page=post&s=view&id=14528850")).toEqual([
      "https://gelbooru.com/index.php?page=post&s=list&tags=banakotakemaru",
    ]);
    expect(booruPublishedAtFromDocument(document)).toBe("2026-07-19 19:46:08");
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

  it("ignores current Danbooru wiki controls in categorized tags and author URLs", () => {
    document.body.innerHTML = `
      <ul id="tag-list">
        <li class="flex tag-type-1">
          <a href="/artists/show_or_new?name=kanadenishizawa&amp;z=1">?</a>
          <a href="/posts?tags=kanadenishizawa&amp;z=1">kanadenishizawa</a>
        </li>
        <li class="flex tag-type-3">
          <a href="/wiki_pages/project_sekai?z=1">?</a>
          <a href="/posts?tags=project_sekai&amp;z=1">project sekai</a>
        </li>
        <li class="flex tag-type-4">
          <a href="/wiki_pages/shinonome_ena?z=1">?</a>
          <a href="/posts?tags=shinonome_ena&amp;z=1">shinonome ena</a>
        </li>
        <li class="flex tag-type-0">
          <a href="/wiki_pages/bare_legs?z=1">?</a>
          <a href="/posts?tags=bare_legs&amp;z=1">bare legs</a>
        </li>
      </ul>
    `;

    expect(extractBooruSourceTags(document, [])).toEqual([
      "copyright:project sekai",
      "character:shinonome ena",
      "author:kanadenishizawa",
      "bare legs",
    ]);
    expect(extractBooruAuthorUrls(document, "https://danbooru.donmai.us/posts/11832347")).toEqual([
      "https://danbooru.donmai.us/posts?tags=kanadenishizawa&z=1",
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

    expect(booruEagleItemBaseName(
      "13192921.jpg",
      "https://rule34.us/index.php?r=posts/view&id=13192921",
      ["author:artist_name", "copyright:monster_hunter"],
    )).toBe("artist name - monster hunter - rule34.us-13192921.jpg");

    expect(booruEagleItemBaseName(
      "6561306.png",
      "https://e621.net/posts/6561306?pool_id=3",
      ["author:kalathean", "copyright:long_franchise_name", "copyright:short_work"],
    )).toBe("kalathean - short work - e621-6561306.png");
  });
});
