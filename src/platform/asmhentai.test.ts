import { describe, expect, it, vi } from "vitest";
import { asmHentaiAuthorUrlsFromDocument, asmHentaiPublishedAtFromDocument } from "./matchers/asmhentai";

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

describe("AsmHentai matcher metadata", () => {
  it("extracts author URLs from author-like detail tags", () => {
    const doc = parseDocument(`
      <section class="right">
        <div class="info">
          <ul>
            <li class="tags">
              <h3>Artist:</h3>
              <div class="tag_list">
                <a href="https://asmhentai.com/artist/soha-blan/"><span>soha blan</span></a>
              </div>
            </li>
            <li class="tags">
              <h3>Tags:</h3>
              <div class="tag_list">
                <a href="/tag/school-uniform/"><span>school uniform</span></a>
              </div>
            </li>
          </ul>
        </div>
      </section>
    `);

    expect(asmHentaiAuthorUrlsFromDocument(doc)).toEqual([
      "https://asmhentai.com/artist/soha-blan/",
    ]);
  });

  it("extracts published dates from detail tags", () => {
    const doc = parseDocument(`
      <section class="right">
        <div class="info">
          <ul>
            <li class="tags"><h3>Published:</h3>2026-06-14</li>
          </ul>
        </div>
      </section>
    `);

    expect(asmHentaiPublishedAtFromDocument(doc)).toBe("2026-06-14");
  });
});
