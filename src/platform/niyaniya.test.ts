import { describe, expect, it, vi } from "vitest";
import { niyaniyaPublishedAt } from "./matchers/niyaniya";

vi.mock("$", () => ({
  GM: {
    xmlHttpRequest: () => undefined,
  },
  GM_getValue: () => null,
  GM_setValue: () => undefined,
}));

describe("Niyaniya matcher metadata", () => {
  it("derives published timestamps from gallery creation time", () => {
    expect(niyaniyaPublishedAt({ created_at: 1718323200 })).toBe("1718323200");
  });
});
