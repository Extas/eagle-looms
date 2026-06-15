import { isGalleryAuthorCategory } from "./gallery-author-urls";
import { cleanGalleryDateValue, isGalleryDateCategory } from "./gallery-published-at";

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
