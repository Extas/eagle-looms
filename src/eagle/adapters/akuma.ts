import { extractGalleryAuthorUrls } from "./gallery-author-urls";
import { extractGalleryPublishedAt } from "./gallery-published-at";

export function akumaAuthorUrlsFromDocument(doc: Document, baseUrl = window.location.href): string[] {
  return extractGalleryAuthorUrls(doc, "ul.info-list > li.meta-data", "span.data", "a[href]", baseUrl);
}

export function akumaPublishedAtFromDocument(doc: Document): string {
  return extractGalleryPublishedAt(doc, "ul.info-list > li.meta-data", "span.data", "span.value");
}
