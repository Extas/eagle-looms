import { GalleryMeta } from "../../download/gallery-meta";
import { extractGalleryAuthorUrls } from "./gallery-author-urls";
import { extractGalleryPublishedAt } from "./gallery-published-at";
import { cleanSourceTag } from "./source-tags";

export function asmHentaiGalleryMetaFromDocument(doc: Document, href = window.location.href): GalleryMeta {
  const title = cleanAsmHentaiValue(doc.querySelector(".right > .info > h1")?.textContent) || cleanAsmHentaiValue(doc.title);
  const meta = new GalleryMeta(href, title);
  meta.originTitle = cleanAsmHentaiValue(doc.querySelector(".right > .info > h2")?.textContent) || undefined;
  Array.from(doc.querySelectorAll<HTMLElement>(".right > .info > ul > .tags")).forEach(elem => {
    const cate = cleanAsmHentaiValue(elem.querySelector("h3")?.textContent).replace(":", "").toLowerCase();
    if (cate) {
      const tags = Array.from(elem.querySelectorAll<HTMLSpanElement>(".tag_list > a > span"))
        .map(span => cleanAsmHentaiValue(span.firstChild?.textContent))
        .filter(Boolean);
      if (tags.length > 0) {
        meta.tags[cate] = tags;
      }
    }
  });
  meta.authorUrls = asmHentaiAuthorUrlsFromDocument(doc, href);
  return meta;
}

export function asmHentaiAuthorUrlsFromDocument(doc: Document, baseUrl = window.location.href): string[] {
  return extractGalleryAuthorUrls(doc, ".right > .info > ul > .tags", "h3", ".tag_list > a[href]", baseUrl);
}

export function asmHentaiPublishedAtFromDocument(doc: Document): string {
  return extractGalleryPublishedAt(doc, ".right > .info > ul > .tags", "h3");
}

function cleanAsmHentaiValue(value: unknown): string {
  return cleanSourceTag(value);
}
