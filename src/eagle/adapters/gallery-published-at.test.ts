import { describe, expect, it } from "vitest";
import { extractGalleryPublishedAt } from "./gallery-published-at";

describe("gallery published date extraction", () => {
  it("extracts date values from table rows", () => {
    document.body.innerHTML = `
      <table class="details">
        <tr><td class="label">Uploaded</td><td>2026-06-14 08:00:00</td></tr>
        <tr><td class="label">Artist</td><td>soha blan</td></tr>
      </table>
    `;

    expect(extractGalleryPublishedAt(document, ".details tr", ".label", ".label + td")).toBe("2026-06-14 08:00:00");
  });

  it("extracts inline date values after removing the category label", () => {
    document.body.innerHTML = `
      <ul class="details">
        <li><span class="label">Published:</span>2026-06-14</li>
      </ul>
    `;

    expect(extractGalleryPublishedAt(document, ".details > li", ".label")).toBe("2026-06-14");
  });

  it("normalizes Chinese date aliases", () => {
    document.body.innerHTML = `
      <ul class="details">
        <li><span class="label">上傳日期：</span>2026-06-14</li>
      </ul>
    `;

    expect(extractGalleryPublishedAt(document, ".details > li", ".label")).toBe("2026-06-14");
  });

  it("ignores non-date categories", () => {
    document.body.innerHTML = `
      <ul class="details">
        <li><span class="label">Artist:</span>soha blan</li>
      </ul>
    `;

    expect(extractGalleryPublishedAt(document, ".details > li", ".label")).toBe("");
  });
});
