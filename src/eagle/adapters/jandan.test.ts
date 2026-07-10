import { describe, expect, it } from "vitest";
import { jandanPublishedAt, jandanSourceTags } from "./jandan";

describe("Jandan Eagle metadata adapter", () => {
  it("derives author source tags from comment metadata", () => {
    expect(jandanSourceTags({ author: "  user\nname  " })).toEqual([
      "author:user name",
    ]);
    expect(jandanSourceTags({ author: "" })).toEqual([]);
  });

  it("derives published timestamps from comment dates", () => {
    expect(jandanPublishedAt({
      date_gmt: "2026-06-14 08:00:00",
      date: "2026-06-14 16:00:00",
    })).toBe("2026-06-14 08:00:00");

    expect(jandanPublishedAt({
      date_gmt: "",
      date: "2026-06-14 16:00:00",
    })).toBe("2026-06-14 16:00:00");
  });
});
