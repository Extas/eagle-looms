import { GalleryMeta } from "../../download/gallery-meta";
import { isGalleryAuthorCategory } from "./gallery-author-urls";
import { cleanGalleryDateValue, isGalleryDateCategory } from "./gallery-published-at";
import { cleanSourceTag } from "./source-tags";

export function hanime1GalleryMetaFromDocument(doc: Document, href = window.location.href): GalleryMeta {
  const title = cleanHanime1Title(doc.querySelector(".comics-panel-margin h3.title")?.textContent);
  const originTitle = cleanHanime1Title(doc.querySelector(".comics-panel-margin h4.title")?.textContent);
  const meta = new GalleryMeta(href, title || cleanHanime1Value(doc.title));
  meta.originTitle = originTitle || undefined;
  hanime1MetadataRows(doc).forEach(ele => {
    const cat = cleanHanime1Value(ele.firstChild?.textContent || "misc").replace(/[:：]+$/g, "");
    const tags = Array.from(ele.querySelectorAll("a")).map(t => cleanHanime1Value(t.textContent)).filter(Boolean);
    meta.tags[cat] = tags;
  });
  meta.authorUrls = hanime1AuthorUrlsFromDocument(doc, href);
  return meta;
}

export function hanime1AuthorUrlsFromDocument(doc: Document, baseUrl = window.location.href): string[] {
  const urls: string[] = [];
  hanime1MetadataRows(doc).forEach(row => {
    if (!isGalleryAuthorCategory(hanime1Category(row))) return;
    row.querySelectorAll<HTMLAnchorElement>("a[href]").forEach(anchor => {
      const url = absoluteHttpUrl(anchor.getAttribute("href"), baseUrl);
      if (url) urls.push(url);
    });
  });
  return [...new Set(urls)];
}

export function hanime1PublishedAtFromDocument(doc: Document): string {
  for (const row of hanime1MetadataRows(doc)) {
    if (!isGalleryDateCategory(hanime1Category(row))) continue;
    const value = cleanGalleryDateValue(hanime1RowValues(row).join(" "));
    if (value) return value;
  }
  return "";
}

function hanime1MetadataRows(doc: Document): HTMLElement[] {
  return Array.from(doc.querySelectorAll<HTMLElement>(".comics-panel-margin .comics-metadata-margin-top h5"));
}

function hanime1Category(row: HTMLElement): string {
  return splitHanime1DirectText(row).category;
}

function hanime1RowValues(row: HTMLElement): string[] {
  const values = Array.from(row.childNodes)
    .slice(1)
    .map(node => node.textContent?.trim() || "")
    .filter(Boolean);
  if (values.length) return values;
  const inlineValue = splitHanime1DirectText(row).value;
  return inlineValue ? [inlineValue] : [];
}

function splitHanime1DirectText(row: HTMLElement): { category: string; value: string } {
  const directText = row.firstChild?.textContent || "";
  const index = directText.search(/[:：]/);
  if (index < 0) return { category: directText, value: "" };
  return {
    category: directText.slice(0, index),
    value: directText.slice(index + 1).trim(),
  };
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

function cleanHanime1Title(value: unknown): string {
  return cleanHanime1Value(value).replaceAll(/\s/g, "");
}

function cleanHanime1Value(value: unknown): string {
  return cleanSourceTag(value);
}
