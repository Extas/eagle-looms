import { GalleryMeta } from "../../download/gallery-meta";
import { extractGalleryAuthorUrls } from "./gallery-author-urls";
import { extractGalleryPublishedAt } from "./gallery-published-at";
import { cleanSourceTag } from "./source-tags";

export function hentaizapGalleryMetaFromDocument(doc: Document, href = window.location.href): GalleryMeta {
  const title = cleanHentaiZapValue(doc.querySelector(".gp_top_right > h1")?.textContent) || cleanHentaiZapValue(doc.title);
  const meta = new GalleryMeta(href, title);
  Array.from(doc.querySelectorAll<HTMLElement>(".gp_top_right_info > ul")).forEach(ul => {
    const category = cleanHentaiZapValue(ul.querySelector("span.info_txt")?.textContent).replace(":", "").toLowerCase();
    if (!category) return;
    const tags = Array.from(ul.querySelectorAll<HTMLElement>("a.gp_btn_tag")).map(e => cleanHentaiZapValue(e.firstChild?.textContent)).filter(Boolean);
    meta.tags[category] = tags;
  });
  meta.authorUrls = hentaizapAuthorUrlsFromDocument(doc, href);
  return meta;
}

export function hentaizapAuthorUrlsFromDocument(doc: Document, baseUrl = window.location.href): string[] {
  return extractGalleryAuthorUrls(doc, ".gp_top_right_info > ul", "span.info_txt", "a.gp_btn_tag[href]", baseUrl);
}

export function hentaizapPublishedAtFromDocument(doc: Document): string {
  return extractGalleryPublishedAt(doc, ".gp_top_right_info > ul", "span.info_txt");
}

function cleanHentaiZapValue(value: unknown): string {
  return cleanSourceTag(value);
}
