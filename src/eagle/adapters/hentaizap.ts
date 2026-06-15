import { extractGalleryPublishedAt } from "./gallery-published-at";

export function hentaizapPublishedAtFromDocument(doc: Document): string {
  return extractGalleryPublishedAt(doc, ".gp_top_right_info > ul", "span.info_txt");
}
