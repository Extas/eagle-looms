import { describe, expect, it, vi } from "vitest";
import { mangaCopyPublishedAtFromDocument } from "./matchers/mangacopy";

vi.mock("$", () => ({
  GM: {
    xmlHttpRequest: () => undefined,
  },
  GM_getValue: () => null,
  GM_setValue: () => undefined,
}));

describe("MangaCopy matcher metadata", () => {
  it("derives published timestamps from comic detail dates", () => {
    const doc = new DOMParser().parseFromString(`
      <div class="comicParticulars-title-right">
        <ul>
          <li><span class="comicParticulars-right-txt">not a date</span></li>
          <li><span class="comicParticulars-right-txt"> 2026-06-14 </span></li>
        </ul>
      </div>
    `, "text/html");

    expect(mangaCopyPublishedAtFromDocument(doc)).toBe("2026-06-14");
  });

  it("returns empty when the detail date is missing", () => {
    const doc = new DOMParser().parseFromString("<div></div>", "text/html");

    expect(mangaCopyPublishedAtFromDocument(doc)).toBe("");
  });
});
