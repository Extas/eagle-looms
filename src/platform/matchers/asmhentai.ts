import { GalleryMeta } from "../../download/gallery-meta";
import ImageNode from "../../img-node";
import { ADAPTER } from "../adapt";
import { extractGalleryAuthorUrls } from "../../eagle/adapters/gallery-author-urls";
import { extractGalleryPublishedAt } from "../gallery-published-at";
import { BaseMatcher, OriginMeta, Result } from "../platform";

class AsmHentaiMatcher extends BaseMatcher<string> {
  publishedAt = "";

  async *fetchPagesSource(): AsyncGenerator<Result<string>> {
    this.publishedAt = asmHentaiPublishedAtFromDocument(document);
    const csrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content");
    if (!csrf) throw new Error("cannot find csrf_token");
    const loadID = document.querySelector<HTMLInputElement>("#load_id")?.value;
    if (!loadID) throw new Error("cannot find load_id");
    const loadDir = document.querySelector<HTMLInputElement>("#load_dir")?.value;
    if (!loadDir) throw new Error("cannot find load_dir");
    const pages = document.querySelector<HTMLInputElement>("#t_pages")?.value;
    if (!pages) throw new Error("cannot find t_pages");
    const api = window.location.origin + "/inc/thumbs_loader.php";
    const raw = await window.fetch(api, {
      "headers": {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
      },
      "body": `_token=${csrf}&id=${loadID}&dir=${loadDir}&visible_pages=0&t_pages=${pages}&type=2`,
      "method": "POST",
    }).then(resp => resp.text()).catch(Error);
    if (raw instanceof Error) throw raw;
    yield Result.ok(raw);
  }

  async parseImgNodes(raw: string): Promise<ImageNode[]> {
    const infos = Array.from(raw.matchAll(/<a href="(.*?)".*data-src="(.*?)"/g)).filter(m => m.length === 3).map(m => ([m[1], m[2]]));
    const digits = infos.length.toString().length;
    return infos.map((info, i) => {
      const node = new ImageNode(info[1], window.location.origin + info[0], (i + 1).toString().padStart(digits, "0"));
      node.setPublishedAt(this.publishedAt);
      return node;
    });
  }

  async fetchOriginMeta(node: ImageNode): Promise<OriginMeta> {
    const href = node.href;
    const doc = await window.fetch(href).then(resp => resp.text()).then(text => new DOMParser().parseFromString(text, "text/html")).catch(Error);
    if (doc instanceof Error) throw doc;
    const src = doc.querySelector<HTMLImageElement>("#fimg")?.getAttribute("data-src");
    if (!src) throw new Error("cannot find image from: " + href);
    const ext = src.split(".").pop() ?? "jpg";
    return { url: src, title: node.title + "." + ext };
  }

  meta?: GalleryMeta;
  galleryMeta(): GalleryMeta {
    if (this.meta) return this.meta;
    const title = document.querySelector(".right > .info > h1")?.textContent ?? document.title;
    const meta = new GalleryMeta(window.location.href, title);
    meta.originTitle = document.querySelector(".right > .info > h2")?.textContent ?? undefined;
    Array.from(document.querySelectorAll<HTMLElement>(".right > .info > ul > .tags")).forEach(elem => {
      const cate = elem.querySelector("h3")?.textContent?.trim().replace(":", "").toLowerCase();
      if (cate) {
        const tags = Array.from(elem.querySelectorAll<HTMLSpanElement>(".tag_list > a > span")).map(span =>
          span.firstChild?.textContent ?? undefined
        ).filter(Boolean) as string[];
        if (tags.length > 0) {
          meta.tags[cate] = tags;
        }
      }
    });
    meta.authorUrls = asmHentaiAuthorUrlsFromDocument(document);
    this.meta = meta;
    return this.meta;
  }

}

export function asmHentaiAuthorUrlsFromDocument(doc: Document): string[] {
  return extractGalleryAuthorUrls(doc, ".right > .info > ul > .tags", "h3", ".tag_list > a[href]");
}

export function asmHentaiPublishedAtFromDocument(doc: Document): string {
  return extractGalleryPublishedAt(doc, ".right > .info > ul > .tags", "h3");
}

ADAPTER.addSetup({
  name: "AsmHentai",
  workURLs: [
    /asmhentai.com\/g\/\d+\/?$/
  ],
  match: ["https://asmhentai.com/*"],
  constructor: () => new AsmHentaiMatcher(),
});
