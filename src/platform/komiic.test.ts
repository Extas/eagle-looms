import { describe, expect, it, vi } from "vitest";
import { komiicPublishedAt } from "./matchers/komiic";

vi.mock("$", () => ({
  GM: {
    xmlHttpRequest: () => undefined,
  },
  GM_getValue: () => null,
  GM_setValue: () => undefined,
}));

describe("Komiic matcher metadata", () => {
  it("derives published timestamps from chapter metadata", () => {
    expect(komiicPublishedAt({
      dateCreated: "2021-10-28T00:56:05Z",
      dateUpdated: "2023-04-09T01:43:22Z",
    })).toBe("2021-10-28T00:56:05Z");

    expect(komiicPublishedAt({
      dateCreated: "",
      dateUpdated: "2023-04-09T01:43:22Z",
    })).toBe("2023-04-09T01:43:22Z");
  });
});
