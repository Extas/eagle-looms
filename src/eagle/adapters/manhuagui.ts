import { GalleryMeta } from "../../download/gallery-meta";
import { isGalleryAuthorCategory } from "./gallery-author-urls";
import { cleanSourceTag } from "./source-tags";

const STATUS_REGEX = /\[(\d{4}-\d{2}-\d{2})\].*?\[(.*?)\]/;

export function manhuaguiPublishedAtFromDocument(doc: Document): string {
  return manhuaguiStatusText(doc).match(STATUS_REGEX)?.[1] || "";
}

export function manhuaguiGalleryMetaFromDocument(doc: Document, href: string): GalleryMeta {
  const title = cleanManhuaguiValue(doc.querySelector(".book-title > h1")?.textContent) || cleanManhuaguiValue(doc.title);
  const meta = new GalleryMeta(href, title);
  for (const row of doc.querySelectorAll(".detail-list li")) {
    const category = manhuaguiRowCategory(row);
    const values = manhuaguiRowValues(row);
    if (!category || values.length === 0) continue;
    meta.tags[category] = values;
    if (isGalleryAuthorCategory(category)) {
      meta.authorUrls.push(...manhuaguiRowUrls(row, href));
    }
  }
  meta.authorUrls = [...new Set(meta.authorUrls)];
  return meta;
}

function manhuaguiStatusText(doc: Document): string {
  return doc.querySelector(".detail-list .status")?.textContent || "";
}

function manhuaguiRowCategory(row: Element): string {
  const clone = row.cloneNode(true) as Element;
  clone.querySelectorAll("a, .status").forEach(element => element.remove());
  const text = cleanManhuaguiValue(clone.textContent || "");
  const match = text.match(/^(.+?)[：:]/);
  return cleanManhuaguiValue(match?.[1] || "").replace(/[:：]\s*$/, "");
}

function manhuaguiRowValues(row: Element): string[] {
  const status = cleanManhuaguiValue(row.querySelector(".status")?.textContent || "");
  if (status) {
    const statusValue = status.match(STATUS_REGEX)?.[2];
    return statusValue ? [cleanManhuaguiValue(statusValue)] : [status];
  }

  const linkValues = Array.from(row.querySelectorAll("a"))
    .map(element => cleanManhuaguiValue(element.textContent || ""))
    .filter(Boolean);
  const values = linkValues.length ? linkValues : [rowTextAfterCategory(row)];
  return [...new Set(values
    .flatMap(value => value.split(/[、,，/|]/g))
    .map(cleanManhuaguiValue)
    .filter(Boolean))];
}

function rowTextAfterCategory(row: Element): string {
  const text = cleanManhuaguiValue(row.textContent || "");
  return cleanManhuaguiValue(text.replace(/^.+?[：:]/, ""));
}

function manhuaguiRowUrls(row: Element, href: string): string[] {
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

function cleanManhuaguiValue(value: unknown): string {
  return cleanSourceTag(value);
}
