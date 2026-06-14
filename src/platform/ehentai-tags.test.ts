import { describe, expect, it } from "vitest";
import { extractEhentaiAuthorUrls } from "./ehentai-tags";

describe("E-Hentai source metadata", () => {
  it("extracts author tag links from artist-like gallery tag rows", () => {
    document.body.innerHTML = `
      <table id="taglist">
        <tr>
          <td>artist:</td>
          <td>
            <a href="/tag/artist:soha_blan">soha blan</a>
            <a href="/tag/artist:soha_blan">soha blan duplicate</a>
          </td>
        </tr>
        <tr>
          <td>group:</td>
          <td><a href="https://exhentai.org/tag/group:circle_name">circle name</a></td>
        </tr>
        <tr>
          <td>character:</td>
          <td><a href="/tag/character:kusanagi_nene">kusanagi nene</a></td>
        </tr>
      </table>
    `;

    expect(extractEhentaiAuthorUrls(document, "https://exhentai.org/g/1/token")).toEqual([
      "https://exhentai.org/tag/artist:soha_blan",
      "https://exhentai.org/tag/group:circle_name",
    ]);
  });
});
