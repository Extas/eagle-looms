import { extractGalleryPublishedAt } from "./gallery-published-at";

export function hentaiNexusPublishedAtFromDocument(doc: Document): string {
  return extractGalleryPublishedAt(doc, ".view-page-details tr", ".viewcolumn", ".viewcolumn + td");
}
