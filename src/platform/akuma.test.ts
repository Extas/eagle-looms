import { describe, expect, it, vi } from "vitest";
import { akumaAuthorUrlsFromDocument, akumaPublishedAtFromDocument } from "./matchers/akuma";

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

describe("Akuma matcher metadata", () => {
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
