import { describe, expect, it } from "vitest";
import { extractGalleryAuthorUrls } from "./gallery-author-urls";

describe("gallery author URL extraction", () => {
  it("extracts only author-like category links from gallery tag rows", () => {
    document.body.innerHTML = `
      <ul class="galleries_info">
        <li>
          <span class="tags_text">Artist:</span>
          <a class="tag" href="/artist/soha-blan/">soha blan</a>
          <a class="tag" href="/artist/soha-blan/">duplicate</a>
        </li>
        <li>
          <span class="tags_text">Group:</span>
          <a class="tag" href="https://imhentai.xxx/group/circle-name/">circle name</a>
        </li>
        <li>
          <span class="tags_text">Translator:</span>
          <a class="tag" href="/translator/translation-circle/">translation circle</a>
        </li>
        <li>
          <span class="tags_text">Tags:</span>
          <a class="tag" href="/tag/school-uniform/">school uniform</a>
        </li>
      </ul>
    `;

    expect(extractGalleryAuthorUrls(document, ".galleries_info > li", ".tags_text", "a.tag[href]", "https://imhentai.xxx/gallery/1/")).toEqual([
      "https://imhentai.xxx/artist/soha-blan/",
      "https://imhentai.xxx/group/circle-name/",
      "https://imhentai.xxx/translator/translation-circle/",
    ]);
  });

  it("supports table-style detail rows", () => {
    document.body.innerHTML = `
      <table class="view-page-details">
        <tr>
          <td class="viewcolumn">Authors</td>
          <td><a href="/author/a/">Author A</a></td>
        </tr>
        <tr>
          <td class="viewcolumn">Editors</td>
          <td><a href="/editor/e/">Editor E</a></td>
        </tr>
        <tr>
          <td class="viewcolumn">Characters</td>
          <td><a href="/character/c/">Character C</a></td>
        </tr>
      </table>
    `;

    expect(extractGalleryAuthorUrls(document, ".view-page-details tr", ".viewcolumn", ".viewcolumn + td a[href]", "https://hentainexus.com/view/1")).toEqual([
      "https://hentainexus.com/author/a/",
      "https://hentainexus.com/editor/e/",
    ]);
  });
});
