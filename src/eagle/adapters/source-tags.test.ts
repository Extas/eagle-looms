import { describe, expect, it } from "vitest";
import { cleanSourceTag, eagleAuthorSourceTags, isEagleAuthorCategory } from "./source-tags";

describe("Eagle source tag adapters", () => {
  it("converts author identity through the shared source namespace rule", () => {
    expect(eagleAuthorSourceTags("  user\nname  ", ["mygo", "mygo", "bang dream"])).toEqual([
      "author:user name",
      "mygo",
      "bang dream",
    ]);
  });

  it("keeps raw source tags when author identity is missing", () => {
    expect(eagleAuthorSourceTags("", [" illustration "])).toEqual(["illustration"]);
    expect(cleanSourceTag(12345)).toBe("12345");
  });

  it("reuses the shared namespace aliases for author category checks", () => {
    expect(isEagleAuthorCategory("Artist(s):")).toBe(true);
    expect(isEagleAuthorCategory("letterers")).toBe(true);
    expect(isEagleAuthorCategory("社团")).toBe(true);
    expect(isEagleAuthorCategory("character")).toBe(false);
  });
});
