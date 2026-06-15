import { describe, expect, it } from "vitest";
import { hentaizapPublishedAtFromDocument } from "./hentaizap";

function parseDocument(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

describe("HentaiZap Eagle metadata adapter", () => {
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
