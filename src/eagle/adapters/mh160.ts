import { GalleryMeta } from "../../download/gallery-meta";
import { isGalleryAuthorCategory } from "./gallery-author-urls";
import { cleanSourceTag } from "./source-tags";

export function mh160GalleryMetaFromDocument(doc: Document, href: string): GalleryMeta {
  const title = cleanMh160Value(doc.querySelector(".Introduct .h1")?.textContent) || cleanMh160Value(doc.title);
  const meta = new GalleryMeta(href, title);
  for (const row of mh160DetailRows(doc)) {
    const category = mh160RowCategory(row);
    const values = mh160RowValues(row);
    if (!category || values.length === 0) continue;
    meta.tags[category] = values;
    if (isGalleryAuthorCategory(category)) {
      meta.authorUrls.push(...mh160RowUrls(row, href));
    }
  }
  meta.authorUrls = [...new Set(meta.authorUrls)];
  return meta;
}

function mh160DetailRows(doc: Document): Element[] {
  return Array.from(doc.querySelectorAll(".Introduct li, .Introduct p, .Introduct .txtItme, .Introduct .txtItem, .Introduct .item"))
    .filter(row => /[:：]/.test(row.textContent || ""));
}

function mh160RowCategory(row: Element): string {
  const clone = row.cloneNode(true) as Element;
  clone.querySelectorAll("a").forEach(element => element.remove());
  const text = cleanMh160Value(clone.textContent || "");
  return cleanMh160Value(text.match(/^(.+?)[：:]/)?.[1] || "");
}

function mh160RowValues(row: Element): string[] {
  const linkValues = Array.from(row.querySelectorAll("a"))
    .map(element => cleanMh160Value(element.textContent || ""))
    .filter(Boolean);
  const values = linkValues.length ? linkValues : [rowTextAfterCategory(row)];
  return [...new Set(values
    .flatMap(value => value.split(/[、,，/|]/g))
    .map(cleanMh160Value)
    .filter(Boolean))];
}

function rowTextAfterCategory(row: Element): string {
  return cleanMh160Value(cleanMh160Value(row.textContent || "").replace(/^.+?[：:]/, ""));
}

function mh160RowUrls(row: Element, href: string): string[] {
  const urls = Array.from(row.querySelectorAll<HTMLAnchorElement>("a[href]"))
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

function cleanMh160Value(value: unknown): string {
  return cleanSourceTag(value);
}
