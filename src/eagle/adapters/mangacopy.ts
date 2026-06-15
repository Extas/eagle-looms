import { GalleryMeta } from "../../download/gallery-meta";
import { isGalleryAuthorCategory } from "./gallery-author-urls";
import { cleanSourceTag } from "./source-tags";

export function mangaCopyPublishedAtFromDocument(doc: Document): string {
  return Array.from(doc.querySelectorAll(".comicParticulars-title-right > ul > li > span.comicParticulars-right-txt"))
    .map(ele => cleanMangaCopyValue(ele.textContent || ""))
    .find(text => /^\d{4}-\d{2}-\d{2}$/.test(text)) || "";
}

export function mangaCopyGalleryMetaFromDocument(doc: Document, href: string): GalleryMeta {
  const title = cleanMangaCopyValue(doc.querySelector(".comicParticulars-title-right > ul > li > h6")?.textContent) || cleanMangaCopyValue(doc.title);
  const meta = new GalleryMeta(href, title);
  for (const row of doc.querySelectorAll(".comicParticulars-title-right > ul > li")) {
    const category = mangaCopyRowCategory(row);
    const values = mangaCopyRowValues(row);
    if (!category || values.length === 0) continue;
    meta.tags[category] = values;
    if (isGalleryAuthorCategory(category)) {
      meta.authorUrls.push(...mangaCopyRowUrls(row, href));
    }
  }
  meta.authorUrls = [...new Set(meta.authorUrls)];
  return meta;
}

function mangaCopyRowCategory(row: Element): string {
  const clone = row.cloneNode(true) as Element;
  clone.querySelector("h6")?.remove();
  clone.querySelectorAll(".comicParticulars-right-txt, a").forEach(element => element.remove());
  return cleanMangaCopyValue(clone.textContent || "").replace(/[:：]\s*$/, "");
}

function mangaCopyRowValues(row: Element): string[] {
  const values = Array.from(row.querySelectorAll(".comicParticulars-right-txt, a"))
    .map(element => cleanMangaCopyValue(element.textContent || ""))
    .flatMap(value => value.split(/[、,，/|]/g))
    .map(cleanMangaCopyValue)
    .filter(Boolean);
  return [...new Set(values)];
}

function mangaCopyRowUrls(row: Element, href: string): string[] {
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

function cleanMangaCopyValue(value: unknown): string {
  return cleanSourceTag(value);
}
