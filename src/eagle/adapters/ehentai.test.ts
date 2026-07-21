import { describe, expect, it } from "vitest";
import { sourceTagsFromGalleryMeta } from "../tags";
import { ehentaiGalleryMetaFromDocument, ehentaiPublishedAtFromDocument, extractEhentaiAuthorUrls } from "./ehentai";

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

  it("builds gallery metadata from E-Hentai detail and tag tables", () => {
    const doc = new DOMParser().parseFromString(`
      <section id="gd2">
        <h1>English Title</h1>
        <h1>Japanese Title</h1>
      </section>
      <div id="gdc"><div>Doujinshi</div></div>
      <div id="gdn"><a>source uploader</a></div>
      <section id="gdd">
        <table>
          <tr><td class="gdt1">Posted:</td><td class="gdt2">2026-07-18 03:51</td></tr>
          <tr><td class="gdt1">Parent:</td><td class="gdt2"><a href="https://exhentai.org/g/1/token">parent gallery</a></td></tr>
          <tr><td class="gdt1">Language:</td><td class="gdt2">English</td></tr>
        </table>
      </section>
      <table id="taglist">
        <tr><td>parody:</td><td><a>project sekai</a></td></tr>
        <tr><td>character:</td><td><a>kusanagi nene</a></td></tr>
        <tr><td>artist:</td><td><a href="/tag/artist:soha_blan">soha blan</a></td></tr>
        <tr><td>female:</td><td><a>school uniform</a></td></tr>
      </table>
    `, "text/html");

    const meta = ehentaiGalleryMetaFromDocument(doc, "https://exhentai.org/g/1/token");

    expect(meta.title).toBe("English Title");
    expect(meta.originTitle).toBe("Japanese Title");
    expect(ehentaiPublishedAtFromDocument(doc)).toBe("2026-07-18 03:51");
    expect(meta.authorUrls).toEqual(["https://exhentai.org/tag/artist:soha_blan"]);
    expect(meta.tags).toMatchObject({
      category: ["Doujinshi"],
      uploader: ["source uploader"],
      parent: ["https://exhentai.org/g/1/token"],
      parody: ["project sekai"],
      character: ["kusanagi nene"],
      artist: ["soha blan"],
      female: ["school uniform"],
    });
    expect(meta.tags.language).toBeUndefined();
    expect(sourceTagsFromGalleryMeta(meta, "https://exhentai.org/s/key/1-1")).toEqual([
      "Doujinshi",
      "source uploader",
      "copyright:project sekai",
      "character:kusanagi nene",
      "author:soha blan",
      "school uniform",
    ]);
  });
});
