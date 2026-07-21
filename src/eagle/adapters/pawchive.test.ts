import { describe, expect, it } from "vitest";
import { pawchivePageAuthorFromDocument } from "./pawchive";

function parseDocument(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

describe("Pawchive Eagle metadata adapter", () => {
  it("reads the original creator profile from an artist page", () => {
    const doc = parseDocument(`
      <h1 class="user-header__name">
        <a class="user-header__profile" href="https://www.pixiv.net/fanbox/creator/6106295">
          <span itemprop="name">yamomo</span>
        </a>
      </h1>
    `);

    expect(pawchivePageAuthorFromDocument(doc, "https://pawchive.pw/fanbox/user/6106295")).toEqual({
      name: "yamomo",
      urls: ["https://www.pixiv.net/fanbox/creator/6106295"],
    });
  });

  it("reads the archive creator profile from a post page", () => {
    const doc = parseDocument(`
      <a class="post__user-name" href="/fanbox/user/117509987"> KerberusTSF </a>
    `);

    expect(pawchivePageAuthorFromDocument(doc, "https://pawchive.pw/fanbox/user/117509987/post/10526856")).toEqual({
      name: "KerberusTSF",
      urls: ["https://pawchive.pw/fanbox/user/117509987"],
    });
  });
});
