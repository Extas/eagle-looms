import { describe, expect, it, vi } from "vitest";
import { manhuaguiPublishedAtFromDocument } from "./matchers/manhuagui";

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

describe("Manhuagui matcher metadata", () => {
  it("extracts publish dates from detail status text", () => {
    const doc = parseDocument(`
      <div class="detail-list">
        <span class="status">状态：[2026-06-14] [连载中]</span>
      </div>
    `);

    expect(manhuaguiPublishedAtFromDocument(doc)).toBe("2026-06-14");
  });

  it("returns empty when no detail status date exists", () => {
    const doc = parseDocument("<div class='detail-list'></div>");

    expect(manhuaguiPublishedAtFromDocument(doc)).toBe("");
  });
});
