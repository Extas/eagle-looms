import { isEagleAuthorCategory } from "./source-tags";

export function extractGalleryAuthorUrls(
  root: ParentNode,
  rowSelector: string,
  categorySelector: string,
  linkSelector: string,
  baseUrl = window.location.href,
): string[] {
  const urls: string[] = [];
  root.querySelectorAll(rowSelector).forEach(row => {
    if (!isGalleryAuthorCategory(row.querySelector(categorySelector)?.textContent)) return;

    row.querySelectorAll<HTMLAnchorElement>(linkSelector).forEach(anchor => {
      const url = absoluteHttpUrl(anchor.getAttribute("href"), baseUrl);
      if (url) urls.push(url);
    });
  });
  return [...new Set(urls)];
}

export function isGalleryAuthorCategory(value: unknown): boolean {
  return isEagleAuthorCategory(value);
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
