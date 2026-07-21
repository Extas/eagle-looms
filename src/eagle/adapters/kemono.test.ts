import { describe, expect, it } from "vitest";
import { kemonoAuthorUrls, kemonoPublishedAt, kemonoSourceTags } from "./kemono";

describe("Kemono Eagle metadata adapter", () => {
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

  it("uses the visible page author and parses Pawchive PostgreSQL-array tags", () => {
    expect(kemonoSourceTags({
      service: "fanbox",
      user: "6106295",
      tags: "{ZenlessZoneZero,绝区零,\"tag, with comma\",\"quoted tag\"}",
    }, "yamomo")).toEqual([
      "author:yamomo",
      "ZenlessZoneZero",
      "绝区零",
      "tag, with comma",
      "quoted tag",
    ]);
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
