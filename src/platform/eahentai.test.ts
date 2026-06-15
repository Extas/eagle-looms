import { describe, expect, it, vi } from "vitest";
import { eahentaiPublishedAt } from "./matchers/eahentai";

vi.mock("$", () => ({
  GM: {
    xmlHttpRequest: () => undefined,
  },
  GM_getValue: () => null,
  GM_setValue: () => undefined,
}));

describe("eahentai matcher metadata", () => {
  it("prefers image addDt over gallery addDt", () => {
    expect(eahentaiPublishedAt(
      { addDt: "2026-06-14 08:00:00" },
      { addDt: "2026-06-13 08:00:00" },
    )).toBe("2026-06-14 08:00:00");
  });

  it("falls back to gallery addDt", () => {
    expect(eahentaiPublishedAt(
      { addDt: "" },
      { addDt: "2026-06-13 08:00:00" },
    )).toBe("2026-06-13 08:00:00");
  });

  it("returns empty when no publish date is available", () => {
    expect(eahentaiPublishedAt({}, {})).toBe("");
  });
});
