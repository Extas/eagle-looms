import { describe, expect, it } from "vitest";
import { kuaiKanPublishedAt } from "./kuaikanmanhua";

describe("KuaiKan Eagle metadata adapter", () => {
  it("normalizes short chapter creation dates", () => {
    expect(kuaiKanPublishedAt({ created_at: "25-02-26" })).toBe("2025-02-26");
  });

  it("keeps full source dates as-is", () => {
    expect(kuaiKanPublishedAt({ created_at: "2026-06-14" })).toBe("2026-06-14");
  });
});
