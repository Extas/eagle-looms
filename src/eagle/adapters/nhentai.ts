import { GalleryMeta } from "../../download/gallery-meta";
import { cleanSourceTag, isEagleAuthorCategory } from "./source-tags";

type NhentaiTag = {
  type?: unknown;
  name?: unknown;
  url?: unknown;
};

type NhentaiGalleryInfo = {
  title?: {
    english?: unknown;
    japanese?: unknown;
    pretty?: unknown;
  };
  tags?: NhentaiTag[];
};

export function nhentaiGalleryMetaFromApi(info: NhentaiGalleryInfo, href = window.location.href, fallbackTitle = document.title): GalleryMeta {
  const title = cleanNhentaiValue(info.title?.english) || cleanNhentaiValue(info.title?.pretty) || cleanNhentaiValue(fallbackTitle) || "UNTITLE";
  const meta = new GalleryMeta(href, title);
  meta.originTitle = cleanNhentaiValue(info.title?.japanese) || undefined;
  meta.authorUrls = nhentaiAuthorUrlsFromTags(info.tags, href);
  meta.tags = nhentaiTagsFromApi(info.tags);
  return meta;
}

export function nhentaiGalleryMetaFromDocument(doc: Document, href = window.location.href): GalleryMeta {
  const title = cleanNhentaiValue(doc.querySelector(".info h1")?.textContent) || cleanNhentaiValue(doc.title) || "UNTITLE";
  const originTitle = cleanNhentaiValue(doc.querySelector(".info h2")?.textContent);
  const meta = new GalleryMeta(href, title);
  meta.originTitle = originTitle || undefined;
  meta.tags = nhentaiTagsFromDocument(doc);
  meta.authorUrls = nhentaiAuthorUrlsFromDocument(doc, href);
  return meta;
}

export function nhentaiPublishedAt(info: { upload_date?: unknown }): string {
  return cleanNhentaiValue(info.upload_date);
}

export function nhentaiPublishedAtFromDocument(doc: Document): string {
  const structured = doc.querySelector<HTMLTimeElement>("time[datetime]")?.getAttribute("datetime")
    || doc.querySelector<HTMLMetaElement>("meta[property='article:published_time'], meta[name='date'], meta[name='pubdate']")?.getAttribute("content");
  if (structured) return cleanNhentaiValue(structured);

  const text = doc.body?.textContent || "";
  const match = text.match(/\b(?:uploaded|posted|published)\s*:?\s*(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?)/i);
  return cleanNhentaiValue(match?.[1]);
}

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

function nhentaiTagsFromApi(tags: NhentaiTag[] | undefined): Record<string, string[]> {
  const buckets: Record<string, string[]> = {};
  for (const tag of tags || []) {
    const category = cleanNhentaiValue(tag.type);
    const name = cleanNhentaiValue(tag.name);
    if (!category || !name) continue;
    if (!buckets[category]) buckets[category] = [];
    buckets[category].push(name);
  }
  return buckets;
}

function nhentaiTagsFromDocument(doc: Document): Record<string, string[]> {
  const buckets: Record<string, string[]> = {};
  Array.from(doc.querySelectorAll(".info > ul > li.tags")).forEach(row => {
    const category = cleanNhentaiValue(row.querySelector("span.text")?.textContent).replace(":", "") || "misc";
    const tags = Array.from(row.querySelectorAll("a.tag_btn > .tag_name"))
      .map(tag => cleanNhentaiValue(tag.textContent))
      .filter(Boolean);
    if (tags.length) buckets[category] = tags;
  });
  return buckets;
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

function cleanNhentaiValue(value: unknown): string {
  return cleanSourceTag(value);
}
