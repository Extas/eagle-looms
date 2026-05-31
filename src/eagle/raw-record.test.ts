import { describe, expect, it } from "vitest";
import { decodeEagleRawRecordAnnotation, EAGLE_RAW_RECORD_SCHEMA, type EagleRawRecord } from "./raw-record";

describe("Legacy Eagle raw records", () => {
  it("decodes only the identity fields needed for backward-compatible duplicate checks", () => {
    const record: EagleRawRecord = {
      identity: {
        stableKey: "eagle-looms:v2:source|origin|",
        sourceUrl: "https://example.test/post/1",
        originUrl: "https://example.test/image.jpg",
      },
      assetItemId: "eagle-item-1",
    };

    expect(decodeEagleRawRecordAnnotation(JSON.stringify({ schema: EAGLE_RAW_RECORD_SCHEMA, record }))).toEqual(record);
    expect(decodeEagleRawRecordAnnotation(JSON.stringify({ schema: EAGLE_RAW_RECORD_SCHEMA, record: { identity: {} } }))).toBeUndefined();
    expect(decodeEagleRawRecordAnnotation("not json")).toBeUndefined();
  });
});
