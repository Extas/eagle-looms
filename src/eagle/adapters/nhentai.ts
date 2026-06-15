import { cleanSourceTag, isEagleAuthorCategory } from "./source-tags";

type NhentaiTag = {
  type?: unknown;
  url?: unknown;
};

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
