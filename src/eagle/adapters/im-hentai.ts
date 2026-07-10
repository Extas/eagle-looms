import { GalleryMeta } from "../../download/gallery-meta";
import { extractGalleryAuthorUrls } from "./gallery-author-urls";
import { extractGalleryPublishedAt } from "./gallery-published-at";
import { cleanSourceTag } from "./source-tags";

export function imHentaiGalleryMetaFromDocument(doc: Document, href = window.location.href): GalleryMeta {
  const title = cleanImHentaiValue(doc.querySelector(".right_details > h1")?.textContent) || "UNTITLE";
  const originTitle = cleanImHentaiValue(doc.querySelector(".right_details > p.subtitle")?.textContent);
  const meta = new GalleryMeta(href, title);
  meta.originTitle = originTitle || undefined;
  meta.tags = {};
  const list = Array.from(doc.querySelectorAll<HTMLElement>(".galleries_info > li"));
  for (const li of list) {
    const cat = cleanImHentaiValue(li.querySelector(".tags_text")?.textContent).replace(":", "");
    if (!cat) continue;
    const tags = Array.from(li.querySelectorAll("a.tag")).map(a => cleanImHentaiValue(a.firstChild?.textContent)).filter(Boolean);
    meta.tags[cat] = tags;
  }
  meta.authorUrls = imHentaiAuthorUrlsFromDocument(doc, href);
  return meta;
}

export function imHentaiAuthorUrlsFromDocument(doc: Document, baseUrl = window.location.href): string[] {
  return extractGalleryAuthorUrls(doc, ".galleries_info > li", ".tags_text", "a.tag[href]", baseUrl);
}

export function imHentaiPublishedAtFromDocument(doc: Document): string {
  return extractGalleryPublishedAt(doc, ".galleries_info > li", ".tags_text");
}

function cleanImHentaiValue(value: unknown): string {
  return cleanSourceTag(value);
}
