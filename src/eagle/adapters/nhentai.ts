type NhentaiTag = {
  type?: unknown;
  url?: unknown;
};

import { isEagleAuthorCategory } from "./source-tags";

export function nhentaiAuthorUrlsFromTags(tags: NhentaiTag[] | undefined, baseUrl = window.location.href): string[] {
  const urls = (tags || [])
    .filter(tag => isEagleAuthorCategory(tag.type))
    .map(tag => absoluteHttpUrl(tag.url, baseUrl))
    .filter(Boolean);
  return [...new Set(urls)];
}

export function nhentaiAuthorUrlsFromDocument(document: Document, baseUrl = window.location.href): string[] {
  const urls: string[] = [];
  document.querySelectorAll(".info > ul > li.tags").forEach((row) => {
    if (!isEagleAuthorCategory(row.querySelector("span.text")?.textContent)) return;

    row.querySelectorAll<HTMLAnchorElement>("a.tag_btn[href]").forEach((anchor) => {
      const url = absoluteHttpUrl(anchor.getAttribute("href"), baseUrl);
      if (url) urls.push(url);
    });
  });
  return [...new Set(urls)];
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
