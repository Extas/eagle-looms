import { isGalleryAuthorCategory } from "./gallery-author-urls";
import { cleanGalleryDateValue, isGalleryDateCategory } from "./gallery-published-at";

export function hentai3AuthorUrlsFromDocument(doc: Document, baseUrl = window.location.href): string[] {
  const urls: string[] = [];
  hentai3TagRows(doc).forEach(row => {
    if (!isGalleryAuthorCategory(hentai3Category(row))) return;
    row.querySelectorAll<HTMLAnchorElement>("a[href]").forEach(anchor => {
      const url = absoluteHttpUrl(anchor.getAttribute("href"), baseUrl);
      if (url) urls.push(url);
    });
  });
  return [...new Set(urls)];
}

export function hentai3PublishedAtFromDocument(doc: Document): string {
  for (const row of hentai3TagRows(doc)) {
    if (!isGalleryDateCategory(hentai3Category(row))) continue;
    const value = cleanGalleryDateValue(hentai3RowValues(row).join(" "));
    if (value) return value;
  }
  return "";
}

function hentai3TagRows(doc: Document): HTMLDivElement[] {
  return Array.from(doc.querySelectorAll<HTMLDivElement>(".tag-container.field-name"));
}

function hentai3Category(row: HTMLElement): string {
  return Array.from(row.childNodes)
    .find(node => node.nodeType === 3 && node.textContent?.trim())
    ?.textContent || "";
}

function hentai3RowValues(row: HTMLElement): string[] {
  return Array.from(row.childNodes)
    .slice(1)
    .map(node => node.textContent?.trim() || "")
    .filter(Boolean);
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
