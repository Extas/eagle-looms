import { GalleryMeta } from "../../download/gallery-meta";
import { cleanSourceTag } from "./source-tags";

export function arcaGalleryMetaFromDocument(doc: Document, href: string): GalleryMeta {
  const meta = new GalleryMeta(href, arcaTitleFromDocument(doc));
  const channel = arcaChannelFromUrl(href);
  if (channel) meta.tags.channel = [channel];
  const author = arcaAuthorFromDocument(doc);
  if (author) meta.tags.author = [author];
  meta.authorUrls = arcaAuthorUrlsFromDocument(doc, href);
  return meta;
}

export function arcaTitleFromDocument(doc: Document): string {
  for (const selector of [
    ".article-title",
    ".article-head .title",
    ".title-row .title",
    "meta[property='og:title']",
    "meta[name='twitter:title']",
  ]) {
    const element = doc.querySelector(selector);
    const value = cleanArcaValue(element instanceof HTMLMetaElement ? element.content : element?.textContent);
    if (value) return value;
  }
  return cleanArcaValue(doc.title) || "arca";
}

export function arcaChannelFromUrl(href: string): string {
  try {
    const url = new URL(href, "https://arca.live");
    const match = url.pathname.match(/^\/b\/([^/]+)/i);
    return cleanArcaValue(match ? decodeURIComponent(match[1]) : "");
  } catch {
    return "";
  }
}

export function arcaPublishedAtFromDocument(doc: Document): string {
  for (const selector of [
    "time[datetime]",
    "[datetime]",
    "meta[property='article:published_time']",
    "meta[name='date']",
    "meta[itemprop='datePublished']",
  ]) {
    const element = doc.querySelector(selector);
    const value = cleanArcaValue(element instanceof HTMLMetaElement
      ? element.content
      : element?.getAttribute("datetime") || element?.textContent);
    if (value) return value;
  }
  return "";
}

function arcaAuthorFromDocument(doc: Document): string {
  for (const selector of [
    ".article-head .user-info a",
    ".article-info .user-info a",
    ".user-info .nickname",
    ".member-info a[href*='/u/']",
    "meta[name='author']",
  ]) {
    const element = doc.querySelector(selector);
    const value = cleanArcaValue(element instanceof HTMLMetaElement ? element.content : element?.textContent);
    if (value) return value;
  }
  return "";
}

function arcaAuthorUrlsFromDocument(doc: Document, href: string): string[] {
  const urls = Array.from(doc.querySelectorAll<HTMLAnchorElement>(".article-head .user-info a[href], .article-info .user-info a[href], .member-info a[href*='/u/']"))
    .map(anchor => {
      const raw = anchor.getAttribute("href") || "";
      if (!raw || raw.startsWith("#") || /^javascript:/i.test(raw)) return "";
      try {
        const url = new URL(raw, href);
        return ["http:", "https:"].includes(url.protocol) ? url.href : "";
      } catch {
        return "";
      }
    })
    .filter(Boolean);
  return [...new Set(urls)];
}

function cleanArcaValue(value: unknown): string {
  return cleanSourceTag(value);
}
