import { describe, expect, it, vi } from "vitest";
import { hentaizapPublishedAtFromDocument } from "./matchers/hentaizap";
import { imHentaiPublishedAtFromDocument } from "./matchers/im-hentai";

vi.mock("$", () => ({
  GM: {
    xmlHttpRequest: () => undefined,
  },
  GM_getValue: () => null,
  GM_setValue: () => undefined,
}));

function parseDocument(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

describe("gallery matcher published dates", () => {
  it("extracts HentaiZap gallery dates from detail rows", () => {
    const doc = parseDocument(`
      <div class="gp_top_right_info">
        <ul><span class="info_txt">Artist:</span><a class="gp_btn_tag">artist</a></ul>
        <ul><span class="info_txt">Published:</span>2026-06-14</ul>
      </div>
    `);

    expect(hentaizapPublishedAtFromDocument(doc)).toBe("2026-06-14");
  });

  it("extracts im-hentai gallery dates from detail rows", () => {
    const doc = parseDocument(`
      <ul class="galleries_info">
        <li><span class="tags_text">Tags:</span><a class="tag">school uniform</a></li>
        <li><span class="tags_text">Upload Date:</span>2026-06-14 08:00:00</li>
      </ul>
    `);

    expect(imHentaiPublishedAtFromDocument(doc)).toBe("2026-06-14 08:00:00");
  });
});
