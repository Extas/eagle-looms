import { GalleryMeta } from "../../download/gallery-meta";
import { isGalleryAuthorCategory } from "./gallery-author-urls";
import { cleanGalleryDateValue, isGalleryDateCategory } from "./gallery-published-at";
import { cleanSourceTag } from "./source-tags";

export type RokuHentaiTag = {
  category: string;
  value: string;
  href: string;
};

export function rokuHentaiTagsFromDocument(doc: Document): RokuHentaiTag[] {
  return Array.from(doc.querySelectorAll<HTMLElement>("div.mdc-chip .site-tag-count[data-tag]"))
    .map(element => rokuHentaiTagFromElement(element))
    .filter((tag): tag is RokuHentaiTag => Boolean(tag));
}

export function rokuHentaiGalleryMetaFromDocument(doc: Document, href = window.location.href): GalleryMeta {
  const title = cleanRokuHentaiValue(doc.querySelector(".site-manga-info__title-text")?.textContent) || "UNTITLE";
  const meta = new GalleryMeta(href, title);
  meta.originTitle = title;
  const tags: Record<string, string[]> = {};
  rokuHentaiTagsFromDocument(doc).forEach((tag) => {
    if (tags[tag.category] === undefined) tags[tag.category] = [];
    tags[tag.category].push(tag.value);
  });
  meta.tags = tags;
  meta.authorUrls = rokuHentaiAuthorUrlsFromDocument(doc, href);
  return meta;
}

export function rokuHentaiAuthorUrlsFromDocument(doc: Document, baseUrl = window.location.href): string[] {
  const urls = rokuHentaiTagsFromDocument(doc)
    .filter(tag => isGalleryAuthorCategory(tag.category))
    .map(tag => absoluteHttpUrl(tag.href, baseUrl))
    .filter(Boolean);
  return [...new Set(urls)];
}

export function rokuHentaiPublishedAtFromDocument(doc: Document): string {
  for (const tag of rokuHentaiTagsFromDocument(doc)) {
    if (!isGalleryDateCategory(tag.category)) continue;
    const value = cleanGalleryDateValue(tag.value);
    if (value) return value;
  }
  return "";
}

function rokuHentaiTagFromElement(element: HTMLElement): RokuHentaiTag | undefined {
  const parsed = parseRokuHentaiDataTag(element.getAttribute("data-tag"));
  if (!parsed) return undefined;
  return {
    ...parsed,
    href: element.closest<HTMLAnchorElement>("a[href]")?.getAttribute("href") || "",
  };
}

function parseRokuHentaiDataTag(value: unknown): Pick<RokuHentaiTag, "category" | "value"> | undefined {
  const raw = String(value ?? "").trim();
  const match = raw.match(/^([^:]+):"?(.+?)"?$/);
  if (!match) return undefined;
  const category = cleanRokuHentaiValue(match[1]);
  const tagValue = cleanRokuHentaiValue(match[2]).replace(/^"|"$/g, "");
  return category && tagValue ? { category, value: tagValue } : undefined;
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

function cleanRokuHentaiValue(value: unknown): string {
  return cleanSourceTag(value);
}
