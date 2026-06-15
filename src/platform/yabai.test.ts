import { describe, expect, it, vi } from "vitest";
import { yabaiPublishedAt } from "./matchers/yabai";

vi.mock("$", () => ({
  GM: {
    xmlHttpRequest: () => undefined,
  },
  GM_getValue: () => null,
  GM_setValue: () => undefined,
}));

describe("Yabai matcher metadata", () => {
  it("derives published timestamps from gallery date metadata", () => {
    expect(yabaiPublishedAt({
      date: {
        default: "2026-06-14",
        human: "Jun 14, 2026",
        diff: "1 day ago",
      },
    })).toBe("2026-06-14");
  });

  it("falls back to human date when default date is absent", () => {
    expect(yabaiPublishedAt({
      date: {
        default: "",
        human: "Jun 14, 2026",
        diff: "1 day ago",
      },
    })).toBe("Jun 14, 2026");
  });
});
