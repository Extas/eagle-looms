import { describe, expect, it } from "vitest";
import { hitomiPublishedAt } from "./hitomi";

describe("Hitomi Eagle metadata adapter", () => {
  it("derives published timestamps from galleryinfo date fields", () => {
    expect(hitomiPublishedAt({
      date: "2026-06-14 08:00:00",
      created_at: "2026-06-15 08:00:00",
    })).toBe("2026-06-14 08:00:00");
  });

  it("falls back to common galleryinfo timestamp fields", () => {
    expect(hitomiPublishedAt({
      uploaded_at: "2026-06-14T08:00:00Z",
    })).toBe("2026-06-14T08:00:00Z");
  });
});
