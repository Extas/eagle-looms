import { describe, expect, it } from "vitest";
import { yabaiPublishedAt } from "./yabai";

describe("Yabai Eagle metadata adapter", () => {
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
