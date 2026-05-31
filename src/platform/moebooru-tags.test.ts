import { describe, expect, it } from "vitest";
import { normalizeMoebooruSourceTags, parseMoebooruTagTypes } from "./moebooru-tags";

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
});
