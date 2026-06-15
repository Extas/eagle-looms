import { describe, expect, it, vi } from "vitest";
import { kuaiKanPublishedAt } from "./matchers/kuaikanmanhua";

vi.mock("$", () => ({
  GM: {
    xmlHttpRequest: () => undefined,
  },
  GM_getValue: () => null,
  GM_setValue: () => undefined,
}));

describe("KuaiKan matcher metadata", () => {
  it("normalizes short chapter creation dates", () => {
    expect(kuaiKanPublishedAt({ created_at: "25-02-26" })).toBe("2025-02-26");
  });

  it("keeps full source dates as-is", () => {
    expect(kuaiKanPublishedAt({ created_at: "2026-06-14" })).toBe("2026-06-14");
  });
});
