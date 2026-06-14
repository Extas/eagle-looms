import { describe, expect, it, vi } from "vitest";
import { kemonoAuthorUrls, kemonoPublishedAt, kemonoSourceTags } from "./matchers/kemono";

vi.mock("$", () => ({
  GM: {
    xmlHttpRequest: () => undefined,
  },
  GM_getValue: () => null,
  GM_setValue: () => undefined,
}));

describe("Kemono matcher metadata", () => {
  it("derives author and post tags from API post metadata", () => {
    expect(kemonoSourceTags({
      service: "fanbox",
      user: "38401163",
      artist: { name: " soha blan " },
      tags: ["mygo", { name: "bang dream" }, { tag: "mygo" }, "", { value: "illustration" }],
    })).toEqual([
      "author:soha blan",
      "mygo",
      "bang dream",
      "illustration",
    ]);
  });

  it("falls back to stable service/user identity when author names are absent", () => {
    expect(kemonoSourceTags({
      service: "patreon",
      user: "12345",
      tags: [],
    })).toEqual(["author:patreon/12345"]);
  });

  it("derives traceable author URLs and published timestamps", () => {
    expect(kemonoAuthorUrls({
      service: "fanbox",
      user: "38401163",
    }, "https://kemono.su")).toEqual([
      "https://kemono.su/fanbox/user/38401163",
    ]);

    expect(kemonoPublishedAt({
      published: "",
      added: "2026-06-14T08:00:00",
      edited: "2026-06-15T08:00:00",
    })).toBe("2026-06-14T08:00:00");
  });
});
