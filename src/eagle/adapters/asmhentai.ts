import { extractGalleryAuthorUrls } from "./gallery-author-urls";
import { extractGalleryPublishedAt } from "./gallery-published-at";

export function asmHentaiAuthorUrlsFromDocument(doc: Document): string[] {
  return extractGalleryAuthorUrls(doc, ".right > .info > ul > .tags", "h3", ".tag_list > a[href]");
}

export function asmHentaiPublishedAtFromDocument(doc: Document): string {
  return extractGalleryPublishedAt(doc, ".right > .info > ul > .tags", "h3");
}
