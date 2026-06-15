import { GalleryMeta } from "../../download/gallery-meta";
import ImageNode from "../../img-node";
import { ADAPTER } from "../adapt";
import { isGalleryAuthorCategory } from "../../eagle/adapters/gallery-author-urls";
import { cleanGalleryDateValue, isGalleryDateCategory } from "../gallery-published-at";
import { BaseMatcher, OriginMeta, Result } from "../platform";

class Hanime1Matcher extends BaseMatcher<Document> {
  meta?: GalleryMeta;
  publishedAt = "";
  galleryMeta(): GalleryMeta {
    return this.meta!;
  }
  parseMeta() {
    const title = document.querySelector(".comics-panel-margin h3.title")?.textContent?.replaceAll(/\s/g, "");
    const originTItle = document.querySelector(".comics-panel-margin h4.title")?.textContent?.replaceAll(/\s/g, "");
    const meta = new GalleryMeta(window.location.href, title ?? document.title);
    meta.originTitle = originTItle ?? undefined;
    Array.from(document.querySelectorAll(".comics-panel-margin .comics-metadata-margin-top h5")).forEach(ele => {
      let cat = ele.firstChild?.textContent ?? "misc";
      cat = cat.trim().replace(/[:：]+$/g, "");
      const tags = Array.from(ele.querySelectorAll("a")).map(t => t.textContent?.trim()).filter(Boolean) as string[];
      meta.tags[cat] = tags;
    });
    meta.authorUrls = hanime1AuthorUrlsFromDocument(document);
    this.publishedAt = hanime1PublishedAtFromDocument(document);
    this.meta = meta;
  }
  async *fetchPagesSource(): AsyncGenerator<Result<Document>> {
    this.parseMeta();
    yield Result.ok(document);
  }

  async parseImgNodes(doc: Document): Promise<ImageNode[]> {
    const items = Array.from(doc.querySelectorAll<HTMLAnchorElement>(".comics-panel-margin > a"));
    const item0 = items[0];
    const f = { j: 'jpg', p: 'png', g: 'gif', w: 'webp' };
    let prefix = "", extensions = undefined;
    if (item0) {
      const page0 = await window.fetch(item0.href).then(res => res.text()).then(raw => (new DOMParser()).parseFromString(raw, "text/html"));
      const img = page0.querySelector<HTMLImageElement>("#comic-content-wrapper img");
      prefix = img?.getAttribute("prefix") ?? img?.getAttribute("data-prefix") ?? "";
      const raw = page0.querySelector<HTMLScriptElement>("#comic-content-wrapper script")?.textContent?.match(/extensions.innerHTML = '(.*)?'/)?.[1]?.replaceAll("&quot;", "\"");
      extensions = raw ? JSON.parse(raw) as string[] : undefined;
    }
    const digits = items.length.toString().length;
    return items.map((item, index) => {
      const href = item.href;
      const thumb = item.querySelector("img")?.getAttribute("data-srcset") || "";
      let ext = "jpg";
      let src = (prefix && extensions) ? `${prefix}${extensions[index]}.${ext}` : undefined;
      if (prefix && extensions && prefix.includes("nhentai")) {
        const fk = (extensions?.[index] ?? "j") as keyof (typeof f);
        ext = f[fk] ?? "jpg";
        src = `${prefix}${(index + 1)}.${ext}`;
      }
      const node = new ImageNode(thumb, href, (index + 1).toString().padStart(digits, "0") + "." + ext, undefined, src);
      node.setPublishedAt(this.publishedAt);
      return node;
    });
  }

  async fetchOriginMeta(node: ImageNode, retry: boolean): Promise<OriginMeta> {
    if (!retry && node.originSrc) return { url: node.originSrc };
    const page0 = await window.fetch(node.href).then(res => res.text()).then(raw => (new DOMParser()).parseFromString(raw, "text/html"));
    const img = page0.querySelector<HTMLImageElement>("#comic-content-wrapper img");
    if (!img) throw new Error("cannot find img from " + node.href);
    return { url: img.src };
  }

  headers(): Record<string, string> {
    return {
      "Origin": "",
      "Referer": "",
    }
  }

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

ADAPTER.addSetup({
  name: "hanime1.me",
  workURLs: [
    /hanime1.me\/comic\/\d+\/?$/
  ],
  match: ["https://hanime1.me/comic/*"],
  constructor: () => new Hanime1Matcher(),
});
