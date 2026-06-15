import { describe, expect, it } from "vitest";
import { extractEhentaiAuthorUrls } from "./ehentai";

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
          <td>circles:</td>
          <td><a href="/tag/circles:studio_name">studio name</a></td>
        </tr>
        <tr>
          <td>translator:</td>
          <td><a href="/tag/translator:translation_circle">translation circle</a></td>
        </tr>
        <tr>
          <td>mangaka:</td>
          <td><a href="/tag/mangaka:comic_author">comic author</a></td>
        </tr>
        <tr>
          <td>Artist(s):</td>
          <td><a href="/tag/artist:decorated_artist">decorated artist</a></td>
        </tr>
        <tr>
          <td>Letterer(s):</td>
          <td><a href="/tag/letterer:lettering_name">lettering name</a></td>
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
      "https://exhentai.org/tag/circles:studio_name",
      "https://exhentai.org/tag/translator:translation_circle",
      "https://exhentai.org/tag/mangaka:comic_author",
      "https://exhentai.org/tag/artist:decorated_artist",
      "https://exhentai.org/tag/letterer:lettering_name",
    ]);
  });
});
