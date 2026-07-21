import { GalleryMeta } from "../../download/gallery-meta";
import { extractGalleryPublishedAt } from "./gallery-published-at";
import { isEagleAuthorCategory } from "./source-tags";

export function ehentaiGalleryMetaFromDocument(doc: Document, href = window.location.href): GalleryMeta {
  const titleList = doc.querySelectorAll<HTMLElement>("#gd2 h1");
  const title = titleList[0]?.textContent || "UNTITLE";
  const originTitle = titleList.length > 1 ? titleList[1]?.textContent || undefined : undefined;
  const meta = new GalleryMeta(href, title);
  meta.originTitle = originTitle;
  meta.tags = ehentaiTagsFromDocument(doc);
  meta.authorUrls = extractEhentaiAuthorUrls(doc, href);
  return meta;
}

export function extractEhentaiAuthorUrls(document: Document, baseUrl = window.location.href): string[] {
  const urls: string[] = [];
  document.querySelectorAll("#taglist tr").forEach((row) => {
    if (!isEagleAuthorCategory(row.querySelector("td")?.textContent)) return;

    row.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((anchor) => {
      const url = absoluteHttpUrl(anchor.getAttribute("href"), baseUrl);
      if (url) urls.push(url);
    });
  });
  return [...new Set(urls)];
}

export function ehentaiPublishedAtFromDocument(doc: Document): string {
  return extractGalleryPublishedAt(doc, "#gdd > table:not([hidden]) tr", ".gdt1", ".gdt2");
}

function ehentaiTagsFromDocument(doc: Document): Record<string, string[]> {
  const tags: Record<string, string[]> = {};
  const category = cleanEhentaiValue(doc.querySelector("#gdc > div")?.textContent);
  if (category) tags.category = [category];
  const uploader = cleanEhentaiValue(doc.querySelector("#gdn > a")?.textContent);
  if (uploader) tags.uploader = [uploader];

  Array.from(doc.querySelectorAll("#gdd > table:not([hidden]) tr")).forEach(tr => {
    const cat = cleanEhentaiValue(tr.querySelector(".gdt1")?.textContent).replace(":", "").toLowerCase();
    let value = cleanEhentaiValue(tr.querySelector(".gdt2")?.textContent);
    if (!cat || !value || cat === "language" || cat === "语言") return;
    if (cat === "parent" || cat === "父级") {
      value = cleanEhentaiValue(tr.querySelector<HTMLAnchorElement>(".gdt2 a")?.href) || value;
    }
    tags[cat] = [value];
  });

  doc.querySelectorAll("#taglist tr").forEach((row) => {
    const cells = row.children;
    const category = cleanEhentaiValue(cells[0]?.textContent).replace(":", "");
    if (!category) return;
    const values = Array.from(cells[1]?.childNodes || [])
      .map(node => cleanEhentaiValue(node.textContent))
      .filter(Boolean);
    if (values.length) tags[category] = values;
  });

  return tags;
}

function absoluteHttpUrl(value: string | null, baseUrl: string): string {
  const raw = (value || "").trim();
  if (!raw || raw.startsWith("#") || /^javascript:/i.test(raw)) return "";
  try {
    const url = new URL(raw, baseUrl);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function cleanEhentaiValue(value: unknown): string {
  return String(value ?? "")
    .replace(/[\n\r\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
