import { GalleryMeta } from "../../download/gallery-meta";
import { isGalleryAuthorCategory } from "./gallery-author-urls";
import { cleanGalleryDateValue, isGalleryDateCategory } from "./gallery-published-at";
import { cleanSourceTag } from "./source-tags";

export function comic18GalleryMetaFromDocument(doc: Document, href = window.location.href): GalleryMeta {
  const title = cleanComic18Value(doc.querySelector(".panel-heading h2")?.textContent) || cleanComic18Value(doc.title) || "UNTITLE";
  const meta = new GalleryMeta(href, title);
  meta.originTitle = title;
  const tags: Record<string, string[]> = {};
  comic18TagRows(doc).forEach((row) => {
    const cat = cleanComic18Value(row.getAttribute("data-type"));
    if (cat) {
      const values = Array.from(row.querySelectorAll("a")).map(a => cleanComic18Value(a.textContent)).filter(Boolean);
      if (values.length > 0) {
        tags[cat] = values;
      }
    }
  });
  meta.tags = tags;
  meta.authorUrls = comic18AuthorUrlsFromDocument(doc, href);
  return meta;
}

export function comic18AuthorUrlsFromDocument(doc: Document, baseUrl = window.location.href): string[] {
  const urls: string[] = [];
  comic18TagRows(doc).forEach(row => {
    if (!isGalleryAuthorCategory(row.getAttribute("data-type"))) return;
    row.querySelectorAll<HTMLAnchorElement>("a[href]").forEach(anchor => {
      const url = absoluteHttpUrl(anchor.getAttribute("href"), baseUrl);
      if (url) urls.push(url);
    });
  });
  return [...new Set(urls)];
}

export function comic18PublishedAtFromDocument(doc: Document): string {
  for (const row of comic18TagRows(doc)) {
    if (!isGalleryDateCategory(row.getAttribute("data-type"))) continue;
    const value = cleanGalleryDateValue(row.textContent);
    if (value) return value;
  }
  return "";
}

function comic18TagRows(doc: Document): HTMLElement[] {
  return Array.from(doc.querySelectorAll<HTMLElement>("div.tag-block > span[data-type]"));
}

function absoluteHttpUrl(value: unknown, baseUrl: string): string {
  const raw = String(value ?? "").trim();
  if (!raw || raw.startsWith("#") || /^javascript:/i.test(raw)) return "";
  try {
    const url = new URL(raw, baseUrl);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function cleanComic18Value(value: unknown): string {
  return cleanSourceTag(value);
}
