import { describe, expect, it, vi } from "vitest";
import { hentaiNexusPublishedAtFromDocument } from "./matchers/hentainexus";

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

describe("HentaiNexus matcher metadata", () => {
  it("derives published timestamps from detail table dates", () => {
    const doc = parseDocument(`
      <table class="view-page-details">
        <tr><td class="viewcolumn">Artist</td><td>soha blan</td></tr>
        <tr><td class="viewcolumn">Upload Date:</td><td>2026-06-14 08:00:00</td></tr>
      </table>
    `);

    expect(hentaiNexusPublishedAtFromDocument(doc)).toBe("2026-06-14 08:00:00");
  });

  it("supports decorated date category labels", () => {
    const doc = parseDocument(`
      <table class="view-page-details">
        <tr><td class="viewcolumn">Published-Date</td><td>2026-06-14</td></tr>
      </table>
    `);

    expect(hentaiNexusPublishedAtFromDocument(doc)).toBe("2026-06-14");
  });

  it("returns empty when no date row is available", () => {
    const doc = parseDocument(`
      <table class="view-page-details">
        <tr><td class="viewcolumn">Tags</td><td>school uniform</td></tr>
      </table>
    `);

    expect(hentaiNexusPublishedAtFromDocument(doc)).toBe("");
  });
});
