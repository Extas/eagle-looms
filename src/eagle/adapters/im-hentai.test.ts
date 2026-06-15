import { describe, expect, it } from "vitest";
import { imHentaiPublishedAtFromDocument } from "./im-hentai";

function parseDocument(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

describe("im-hentai Eagle metadata adapter", () => {
  it("derives published dates from gallery info list rows", () => {
    const doc = parseDocument(`
      <ul class="galleries_info">
        <li><span class="tags_text">Artist:</span><a class="tag">soha blan</a></li>
        <li><span class="tags_text">Upload Date:</span>2026-06-14 08:00:00</li>
      </ul>
    `);

    expect(imHentaiPublishedAtFromDocument(doc)).toBe("2026-06-14 08:00:00");
  });
});
