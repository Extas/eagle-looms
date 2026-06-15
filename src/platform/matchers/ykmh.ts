import { GalleryMeta } from "../../download/gallery-meta";
import ImageNode from "../../img-node";
import { Chapter } from "../../page-fetcher";
import { ADAPTER } from "../adapt";
import { isGalleryAuthorCategory } from "../../eagle/adapters/gallery-author-urls";
import { BaseMatcher, OriginMeta, Result } from "../platform";

class YKMHMatcher extends BaseMatcher<string> {

  meta?: GalleryMeta;

  galleryMeta(): GalleryMeta {
    if (this.meta) return this.meta;
    this.meta = ykmhGalleryMetaFromDocument(document, window.location.href);
    return this.meta;
  }

  async *fetchChapters(): AsyncGenerator<Chapter[]> {
    const elements = Array.from(document.querySelectorAll<HTMLLIElement>("ul[id*=chapter-list] > li"));
    const ret = elements.map((elem) => {
      let title = elem.querySelector(".list_con_zj")?.textContent;
      const url = elem.querySelector("a")?.href;
      if (!title) title = elem.querySelector("a")?.textContent?.trim();
      return { title, url };
    }).filter(e => e.title && e.url).map((e, i) => new Chapter(i, e.title!, e.url!));
    yield ret;
  }

  async *fetchPagesSource(ch: Chapter): AsyncGenerator<Result<string>> {
    yield Result.ok(ch.source);
  }

  async parseImgNodes(source: string): Promise<ImageNode[]> {
    const raw = await window.fetch(source).then(resp => resp.text()).catch(Error);
    if (raw instanceof Error) throw raw;
    const imageUrls = raw.match(/var chapterImages = \[(.*?)\]/)?.[1];
    if (!imageUrls) throw new Error("no images url matched, regexp: var chapterImages = \\[(.*?)\\]");
    const urls = imageUrls.split(",").map(url => url.replaceAll("\"", "").trim());
    const digits = urls.length.toString().length;
    return urls.map((url, i) => {
      const ext = url.split(".").pop() ?? "jpg";
      const title = (i + 1).toString().padStart(digits, "0") + "." + ext;
      return new ImageNode("", source, title, undefined, url);
    });
  }

  async fetchOriginMeta(node: ImageNode): Promise<OriginMeta> {
    return { url: node.originSrc! };
  }

}

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
  if (typeof value !== "string" && typeof value !== "number") return "";
  return String(value)
    .replace(/[\n\r\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

ADAPTER.addSetup({
  name: "优酷漫画",
  workURLs: [
    /ykmh.net\/manhua\/\w+\/?$/,
  ],
  match: ["https://www.ykmh.net/manhua/*"],
  constructor: () => new YKMHMatcher(),
});
