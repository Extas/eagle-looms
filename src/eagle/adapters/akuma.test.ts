import { describe, expect, it } from "vitest";
import { akumaAuthorUrlsFromDocument, akumaPublishedAtFromDocument } from "./akuma";

function parseDocument(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

describe("Akuma Eagle metadata adapter", () => {
  it("extracts author URLs and published dates from info rows", () => {
    const doc = parseDocument(`
      <ul class="info-list">
        <li class="meta-data">
          <span class="data">Artist:</span>
          <span class="value"><a href="/artist/soha-blan">soha blan</a></span>
        </li>
        <li class="meta-data">
          <span class="data">Tags:</span>
          <span class="value"><a href="/tag/school-uniform">school uniform</a></span>
        </li>
        <li class="meta-data">
          <span class="data">Published:</span>
          <span class="value">2026-06-14</span>
        </li>
      </ul>
    `);

    expect(akumaAuthorUrlsFromDocument(doc, "https://akuma.moe/g/abc")).toEqual([
      "https://akuma.moe/artist/soha-blan",
    ]);
    expect(akumaPublishedAtFromDocument(doc)).toBe("2026-06-14");
  });
});
