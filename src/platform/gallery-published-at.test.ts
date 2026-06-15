import { describe, expect, it } from "vitest";
import { extractGalleryPublishedAt } from "./gallery-published-at";

describe("gallery published date extraction", () => {
  it("extracts dates from table-style detail rows", () => {
    document.body.innerHTML = `
      <table class="details">
        <tr><td class="label">Artist</td><td>artist name</td></tr>
        <tr><td class="label">Upload Date:</td><td>2026-06-14 08:00:00</td></tr>
      </table>
    `;

    expect(extractGalleryPublishedAt(document, ".details tr", ".label", ".label + td")).toBe("2026-06-14 08:00:00");
  });

  it("extracts dates from list rows by removing the category label", () => {
    document.body.innerHTML = `
      <ul class="details">
        <li><span class="label">Published-Date</span> 2026-06-14</li>
      </ul>
    `;

    expect(extractGalleryPublishedAt(document, ".details > li", ".label")).toBe("2026-06-14");
  });

  it("supports Chinese date labels", () => {
    document.body.innerHTML = `
      <ul class="details">
        <li><span class="label">上傳日期：</span>2026-06-14</li>
      </ul>
    `;

    expect(extractGalleryPublishedAt(document, ".details > li", ".label")).toBe("2026-06-14");
  });

  it("returns empty when no date category exists", () => {
    document.body.innerHTML = `
      <ul class="details">
        <li><span class="label">Tags</span>school uniform</li>
      </ul>
    `;

    expect(extractGalleryPublishedAt(document, ".details > li", ".label")).toBe("");
  });
});
