import { GalleryMeta } from "../../download/gallery-meta";
import { extractGalleryAuthorUrls } from "./gallery-author-urls";
import { extractGalleryPublishedAt } from "./gallery-published-at";
import { cleanSourceTag } from "./source-tags";

export function akumaGalleryMetaFromDocument(doc: Document, href = window.location.href): GalleryMeta {
  const title = cleanAkumaValue(doc.querySelector("header.entry-header > h1")?.textContent) || cleanAkumaValue(doc.title);
  const meta = new GalleryMeta(href, title);
  meta.originTitle = cleanAkumaValue(doc.querySelector("header.entry-header > span")?.textContent) || undefined;
  meta.tags = Array.from(doc.querySelectorAll("ul.info-list > li.meta-data"))
    .reduce<Record<string, string[]>>((prev, curr) => {
      const cat = cleanAkumaValue(curr.querySelector("span.data")?.textContent).replace(":", "").toLowerCase().trim();
      if (cat) {
        prev[cat] = Array.from(curr.querySelectorAll("span.value")).map(v => cleanAkumaValue(v.textContent)).filter(Boolean);
      }
      return prev;
    }, {});
  meta.authorUrls = akumaAuthorUrlsFromDocument(doc, href);
  return meta;
}

export function akumaAuthorUrlsFromDocument(doc: Document, baseUrl = window.location.href): string[] {
  return extractGalleryAuthorUrls(doc, "ul.info-list > li.meta-data", "span.data", "a[href]", baseUrl);
}

export function akumaPublishedAtFromDocument(doc: Document): string {
  return extractGalleryPublishedAt(doc, "ul.info-list > li.meta-data", "span.data", "span.value");
}

function cleanAkumaValue(value: unknown): string {
  return cleanSourceTag(value);
}
