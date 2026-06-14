import { describe, expect, it } from "vitest";
import { nhentaiAuthorUrlsFromDocument, nhentaiAuthorUrlsFromTags } from "./nhentai-tags";

describe("nhentai source metadata", () => {
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
});
