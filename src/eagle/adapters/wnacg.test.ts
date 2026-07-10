import { describe, expect, it } from "vitest";
import { sourceTagsFromGalleryMeta } from "../tags";
import { wnacgGalleryMetaFromDocument } from "./wnacg";

function parseDocument(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

describe("WNACG Eagle metadata adapter", () => {
  it("cleans gallery tags while keeping descriptions out of visible source tags", () => {
    const doc = parseDocument(`
      <div id="bodywrap">
        <h2> gallery title </h2>
      </div>
      <div class="asTB">
        <a class="tagshow"> school uniform </a>
        <a class="tagshow">school uniform</a>
        <a class="tagshow"> blue eyes
        </a>
        <div class="asTBcell uwconn">
          <p>
            first description line
            <br>
            second description line
          </p>
        </div>
      </div>
    `);

    const meta = wnacgGalleryMetaFromDocument(doc, "https://www.wnacg.com/photos-index-page-1-aid-1.html");

    expect(meta.title).toBe("gallery title");
    expect(meta.tags).toEqual({
      tags: ["school uniform", "blue eyes"],
      description: ["first description line", "second description line"],
    });
    expect(sourceTagsFromGalleryMeta(meta, "https://www.wnacg.com/photos-index-page-1-aid-1.html")).toEqual([
      "school uniform",
      "blue eyes",
    ]);
  });
});
