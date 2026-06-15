import { extractGalleryPublishedAt } from "./gallery-published-at";

export function imHentaiPublishedAtFromDocument(doc: Document): string {
  return extractGalleryPublishedAt(doc, ".galleries_info > li", ".tags_text");
}
