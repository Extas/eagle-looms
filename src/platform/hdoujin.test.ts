import { describe, expect, it, vi } from "vitest";
import { hdoujinPublishedAt } from "./matchers/hdoujin";

vi.mock("$", () => ({
  GM: {
    xmlHttpRequest: () => undefined,
  },
  GM_getValue: () => null,
  GM_setValue: () => undefined,
}));

describe("HDoujin matcher metadata", () => {
  it("derives published timestamps from gallery creation time", () => {
    expect(hdoujinPublishedAt({ created_at: 1718323200 })).toBe("1718323200");
    expect(hdoujinPublishedAt({ publishedAt: 1718409600 })).toBe("1718409600");
  });
});
