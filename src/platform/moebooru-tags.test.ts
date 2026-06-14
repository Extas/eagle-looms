import { describe, expect, it } from "vitest";
import { moebooruAuthorUrlsFromTags, normalizeMoebooruSourceTags, parseMoebooruTagTypes } from "./moebooru-tags";

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
    expect(normalizeMoebooruSourceTags("creator_name group_name original_work character_name", {
      creator_name: "creator",
      group_name: "group",
      original_work: "original work",
      character_name: "character",
    })).toEqual([
      "author:creator_name",
      "author:group_name",
      "copyright:original_work",
      "character:character_name",
    ]);
  });

  it("derives traceable author tag URLs from categorized artist tags", () => {
    expect(moebooruAuthorUrlsFromTags(
      "artist_name source_work circle_name artist_name character_name",
      {
        artist_name: "artist",
        source_work: "copyright",
        circle_name: "circle",
        character_name: "character",
      },
      "https://yande.re/post?page=2&tags=project_sekai",
    )).toEqual([
      "https://yande.re/post?tags=artist_name",
      "https://yande.re/post?tags=circle_name",
    ]);
  });
});
