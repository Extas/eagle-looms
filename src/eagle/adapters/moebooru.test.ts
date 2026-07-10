import { describe, expect, it } from "vitest";
import { sourceTagsFromGalleryMeta } from "../tags";
import { moebooruAuthorUrlsFromTags, moebooruGalleryMetaFromState, normalizeMoebooruSourceTags, parseMoebooruPostInfos, parseMoebooruTagTypes } from "./moebooru";

describe("moebooru source tags", () => {
  it("normalizes Post.register_tags categories and keeps unknown tags raw", () => {
    document.body.innerHTML = `
      <script>
        Post.register_tags({"soha_blan":"artist","project_sekai":"copyright","kusanagi_nene":"character","blue_eyes":"general"});
      </script>
    `;
    const tagTypes = parseMoebooruTagTypes(document);

    expect(normalizeMoebooruSourceTags("soha_blan project_sekai kusanagi_nene blue_eyes", tagTypes)).toEqual([
      "author:soha_blan",
      "copyright:project_sekai",
      "character:kusanagi_nene",
      "blue_eyes",
    ]);
  });

  it("parses multiline and repeated Post.register_tags maps", () => {
    document.body.innerHTML = `
      <script>
        Post.register_tags({
          "soha_blan": "Artist",
          "project_sekai": "source_work"
        });
        Post.register_tags({
          "kusanagi_nene": " character "
        });
      </script>
    `;
    const tagTypes = parseMoebooruTagTypes(document);

    expect(normalizeMoebooruSourceTags("soha_blan project_sekai kusanagi_nene", tagTypes)).toEqual([
      "author:soha_blan",
      "copyright:project_sekai",
      "character:kusanagi_nene",
    ]);
  });

  it("supports numeric tag category values from API-style payloads", () => {
    expect(normalizeMoebooruSourceTags("artist_name source_work character_name", {
      artist_name: 1,
      source_work: 3,
      character_name: 4,
    })).toEqual([
      "author:artist_name",
      "copyright:source_work",
      "character:character_name",
    ]);
  });

  it("supports common named tag category aliases", () => {
    expect(normalizeMoebooruSourceTags("creator_name group_name original_work character_name illustrator_name franchise_name", {
      creator_name: "creator",
      group_name: "group",
      original_work: "original work",
      character_name: "characters",
      illustrator_name: "illustrators",
      franchise_name: "franchises",
    })).toEqual([
      "author:creator_name",
      "author:group_name",
      "copyright:original_work",
      "character:character_name",
      "author:illustrator_name",
      "copyright:franchise_name",
    ]);
  });

  it("aligns expanded moebooru category aliases with source namespaces", () => {
    expect(normalizeMoebooruSourceTags("translator_name editor_name work_title_name parody_name char_name", {
      translator_name: "translator",
      editor_name: "editors",
      work_title_name: "work-title",
      parody_name: "parody",
      char_name: "char",
    })).toEqual([
      "author:translator_name",
      "author:editor_name",
      "copyright:work_title_name",
      "copyright:parody_name",
      "character:char_name",
    ]);
  });

  it("derives traceable author tag URLs from categorized artist tags", () => {
    expect(moebooruAuthorUrlsFromTags(
      "artist_name source_work circle_name illustrator_name artist_name character_name",
      {
        artist_name: "artist",
        source_work: "copyright",
        circle_name: "circle",
        illustrator_name: "illustrator",
        character_name: "character",
      },
      "https://yande.re/post?page=2&tags=project_sekai",
    )).toEqual([
      "https://yande.re/post?tags=artist_name",
      "https://yande.re/post?tags=circle_name",
      "https://yande.re/post?tags=illustrator_name",
    ]);
  });

  it("parses multiline and repeated Post.register post payloads", () => {
    document.body.innerHTML = `
      <script>
        Post.register({
          "id": 100,
          "file_url": "https://files.yande.re/image.jpg",
          "sample_url": "https://files.yande.re/sample.jpg",
          "preview_url": "https://files.yande.re/preview.jpg",
          "tags": "artist_name project_sekai"
        });
        Post.register({
          "id": 101,
          "file_url": "https://files.yande.re/other.png",
          "sample_url": "https://files.yande.re/other-sample.png",
          "preview_url": "https://files.yande.re/other-preview.png"
        });
      </script>
    `;

    expect(parseMoebooruPostInfos(document).map(info => info.id)).toEqual([100, 101]);
  });

  it("builds gallery metadata with normalized per-post tag buckets", () => {
    const meta = moebooruGalleryMetaFromState(
      "yande.re",
      "https://yande.re/post?tags=project_sekai",
      {
        "100": {
          id: 100,
          file_url: "https://files.yande.re/image.jpg",
          sample_url: "https://files.yande.re/sample.jpg",
          preview_url: "https://files.yande.re/preview.jpg",
          tags: "artist_name project_sekai kusanagi_nene blue_eyes",
        },
      },
      {
        artist_name: "artist",
        project_sekai: "copyright",
        kusanagi_nene: "character",
      },
    );

    expect(meta.title).toBe("yande.re-search-project_sekai");
    expect(sourceTagsFromGalleryMeta(meta, "https://yande.re/post/show/100")).toEqual([
      "author:artist_name",
      "copyright:project_sekai",
      "character:kusanagi_nene",
      "blue_eyes",
    ]);
  });

  it("uses a stable single-post moebooru gallery title", () => {
    const meta = moebooruGalleryMetaFromState(
      "konachan",
      "https://konachan.com/post/show/100",
      {
        "100": {
          id: 100,
          file_url: "https://konachan.com/file.jpg",
          sample_url: "https://konachan.com/sample.jpg",
          preview_url: "https://konachan.com/preview.jpg",
          tags: "project_sekai",
        },
      },
      { project_sekai: "copyright" },
    );

    expect(meta.title).toBe("konachan-post-100");
    expect(sourceTagsFromGalleryMeta(meta, "https://konachan.com/post/show/100")).toEqual([
      "copyright:project_sekai",
    ]);
  });
});
