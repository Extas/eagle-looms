import { describe, expect, it } from "vitest";
import { sourceTagsFromGalleryMeta } from "../tags";
import { hentaizapGalleryMetaFromDocument, hentaizapPublishedAtFromDocument } from "./hentaizap";

function parseDocument(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

describe("HentaiZap Eagle metadata adapter", () => {
  it("builds gallery metadata from gallery info rows", () => {
    const doc = parseDocument(`
      <div class="gp_top_right"><h1> HentaiZap Title </h1></div>
      <div class="gp_top_right_info">
        <ul><span class="info_txt">Artist:</span><a class="gp_btn_tag" href="/artist/soha">soha blan</a></ul>
        <ul><span class="info_txt">Character:</span><a class="gp_btn_tag" href="/character/nene">kusanagi nene</a></ul>
        <ul><span class="info_txt">Tags:</span><a class="gp_btn_tag" href="/tag/school">school uniform</a></ul>
      </div>
    `);

    const meta = hentaizapGalleryMetaFromDocument(doc, "https://hentaizap.com/gallery/abc/");

    expect(meta.title).toBe("HentaiZap Title");
    expect(meta.authorUrls).toEqual(["https://hentaizap.com/artist/soha"]);
    expect(sourceTagsFromGalleryMeta(meta, "https://hentaizap.com/gallery/abc/")).toEqual([
      "author:soha blan",
      "character:kusanagi nene",
      "school uniform",
    ]);
  });

  it("derives published dates from gallery info rows", () => {
    const doc = parseDocument(`
      <div class="gp_top_right_info">
        <ul><span class="info_txt">Artist:</span><a class="gp_btn_tag">soha blan</a></ul>
        <ul><span class="info_txt">Published:</span>2026-06-14</ul>
      </div>
    `);

    expect(hentaizapPublishedAtFromDocument(doc)).toBe("2026-06-14");
  });
});
