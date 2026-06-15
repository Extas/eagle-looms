import { GalleryMeta } from "../../download/gallery-meta";
import { isGalleryAuthorCategory } from "./gallery-author-urls";
import { cleanSourceTag } from "./source-tags";

export function ykmhGalleryMetaFromDocument(doc: Document, href: string): GalleryMeta {
  const title = cleanYkmhValue(doc.querySelector(".comic_deCon h1")?.textContent) || cleanYkmhValue(doc.title);
  const meta = new GalleryMeta(href, title);
  for (const row of ykmhDetailRows(doc)) {
    const category = ykmhRowCategory(row);
    const values = ykmhRowValues(row);
    if (!category || values.length === 0) continue;
    meta.tags[category] = values;
    if (isGalleryAuthorCategory(category)) {
      meta.authorUrls.push(...ykmhRowUrls(row, href));
    }
  }
  meta.authorUrls = [...new Set(meta.authorUrls)];
  return meta;
}

function ykmhDetailRows(doc: Document): Element[] {
  return Array.from(doc.querySelectorAll(".comic_deCon li, .comic_deCon p, .comic_deCon .txtItme, .comic_deCon .txtItem, .comic_deCon .item"))
    .filter(row => /[:：]/.test(row.textContent || ""));
}

function ykmhRowCategory(row: Element): string {
  const clone = row.cloneNode(true) as Element;
  clone.querySelectorAll("a").forEach(element => element.remove());
  const text = cleanYkmhValue(clone.textContent || "");
  return cleanYkmhValue(text.match(/^(.+?)[：:]/)?.[1] || "");
}

function ykmhRowValues(row: Element): string[] {
  const linkValues = Array.from(row.querySelectorAll("a"))
    .map(element => cleanYkmhValue(element.textContent || ""))
    .filter(Boolean);
  const values = linkValues.length ? linkValues : [rowTextAfterCategory(row)];
  return [...new Set(values
    .flatMap(value => value.split(/[、,，/|]/g))
    .map(cleanYkmhValue)
    .filter(Boolean))];
}

function rowTextAfterCategory(row: Element): string {
  return cleanYkmhValue(cleanYkmhValue(row.textContent || "").replace(/^.+?[：:]/, ""));
}

function ykmhRowUrls(row: Element, href: string): string[] {
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

function cleanYkmhValue(value: unknown): string {
  return cleanSourceTag(value);
}
