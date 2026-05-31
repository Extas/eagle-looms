import { transient } from "../../config";
import { GalleryMeta } from "../../download/gallery-meta";
import EBUS from "../../event-bus";
import ImageNode, { NodeAction } from "../../img-node";
import { evLog } from "../../utils/ev-log";
import { ADAPTER } from "../adapt";
import { extractBooruSourceTags, normalizeBooruSourceTags } from "../booru-tags";
import { searchGalleryTitle } from "../gallery-title";
import { BaseMatcher, OriginMeta, Result } from "../platform";


abstract class DanbooruMatcher extends BaseMatcher<Document> {
  tags: Record<string, string[]> = {};
  blacklistTags: string[] = [];
  count: number = 0;
  abstract nextPage(doc: Document): string | null;

  async *fetchPagesSource(): AsyncGenerator<Result<Document>> {
    let doc = document;
    this.blacklistTags = this.getBlacklist(doc);
    yield Result.ok(doc);
    // find next page
    let tryTimes = 0;
    while (true) {
      const url = this.nextPage(doc);
      if (!url) break;
      try {
        doc = await window.fetch(url).then((res) => res.text()).then((text) => new DOMParser().parseFromString(text, "text/html"));
      } catch (e) {
        tryTimes++;
        if (tryTimes > 3) yield Result.err(new Error(`fetch next page failed, ${e}`));
        continue;
      }
      tryTimes = 0;
      yield Result.ok(doc);
    }
  }

  abstract getOriginalURL(doc: Document): string | null;
  abstract getNormalURL(doc: Document): string | null;
  abstract extractIDFromHref(href: string): string | undefined;
  abstract getBlacklist(doc: Document): string[];

  async fetchOriginMeta(node: ImageNode): Promise<OriginMeta> {
    const cached = this.cachedOriginMeta(node.href);
    if (cached) return cached;
    let url: string | null = null;
    const doc = await window.fetch(node.href).then((res) => res.text()).then((text) => new DOMParser().parseFromString(text, "text/html"));
    node.setTags(...extractBooruSourceTags(doc, [...node.tags]));
    if (ADAPTER.conf.fetchOriginal) {
      url = this.getOriginalURL(doc);
    }
    if (!url) {
      url = this.getNormalURL(doc);
    }
    if (!url) throw new Error("Cannot find origin image or video url");
    const publishedAt = sourcePublishedAtFromBooruDocument(doc);
    let title: string | undefined;
    // extract ext from url
    const ext = url.split(".").pop()?.match(/^\w+/)?.[0];
    // extract id from href
    const id = this.extractIDFromHref(node.href);
    if (ext && id) {
      title = `${id}.${ext}`;
    }
    return { url, title, publishedAt };
  }

  cachedOriginMeta(_href: string): OriginMeta | null {
    return null;
  }

  abstract queryList(doc: Document): HTMLElement[];
  abstract toImgNode(ele: HTMLElement): [ImageNode | null, string];

  async parseImgNodes(doc: Document): Promise<ImageNode[] | never> {
    if (this.extractIDFromHref(window.location.href)) {
      const detailNode = this.toDetailImgNode(doc);
      return detailNode ? [detailNode] : [];
    }

    const list: ImageNode[] = [];
    this.queryList(doc).forEach(ele => {
      const [imgNode, tags] = this.toImgNode(ele);
      if (!imgNode) return;
      this.count++;
      if (tags !== "") {
        const tagList = tags.trim().replaceAll(": ", ":").split(" ").map(v => v.trim()).filter(v => v !== "");
        if (this.blacklistTags.findIndex(t => tagList.includes(t)) >= 0) return;
        const sourceTags = normalizeBooruSourceTags(ele, tagList);
        imgNode.setTags(...sourceTags);
        this.tags[imgNode.title.split(".")[0]] = sourceTags;
      }
      list.push(imgNode);
    });
    return list;
  }

  protected toDetailImgNode(doc: Document): ImageNode | null {
    const id = this.extractIDFromHref(window.location.href);
    if (!id) return null;
    let source: string | null = null;
    try {
      source = this.getNormalURL(doc) || this.getOriginalURL(doc);
    } catch {
      return null;
    }
    if (!source) return null;
    this.count++;
    const url = absoluteUrl(source);
    const node = new ImageNode(url, window.location.href, `${id}.${extensionFromUrl(url) || "jpg"}`, undefined, undefined, imageSizeFromDocument(doc));
    const sourceTags = extractBooruSourceTags(doc, []);
    node.setTags(...sourceTags);
    node.setPublishedAt(sourcePublishedAtFromBooruDocument(doc));
    this.tags[id] = sourceTags;
    return node;
  }

  abstract site(): string;

  galleryMeta(): GalleryMeta {
    const url = new URL(window.location.href);
    const tags = url.searchParams.get("tags")?.trim();
    const postId = this.extractIDFromHref(window.location.href);
    const site = this.site().toLowerCase().replace(/\s+/g, "-");
    const title = postId ? `${site}-post-${postId}` : searchGalleryTitle(site, tags);
    const meta = new GalleryMeta(window.location.href, title);
    meta.tags = this.tags;
    return meta;
  }
}

class DanbooruDonmaiMatcher extends DanbooruMatcher {
  site(): string {
    return "danbooru";
  }
  nextPage(doc: Document): string | null {
    return doc.querySelector<HTMLAnchorElement>(".paginator a.paginator-next")?.href || null;
  }
  queryList(doc: Document): HTMLElement[] {
    // .post-preview.blacklisted-active, .image-container.blacklisted-active, #c-comments .post.blacklisted-active
    return Array.from(doc.querySelectorAll(".posts-container > article"));
  }
  getBlacklist(doc: Document): string[] {
    return doc.querySelector("meta[name='blacklisted-tags']")?.getAttribute("content")?.split(",") || [];
  }
  toImgNode(ele: HTMLElement): [ImageNode | null, string] {
    const anchor = ele.querySelector<HTMLAnchorElement>("a");
    if (!anchor) {
      evLog("error", "warn: cannot find anchor element", anchor);
      return [null, ""];
    }
    const img = anchor.querySelector<HTMLImageElement>("img");
    if (!img) {
      evLog("error", "warn: cannot find img element", img);
      return [null, ""];
    }
    const href = anchor.getAttribute("href");
    if (!href) {
      evLog("error", "warn: cannot find href", anchor);
      return [null, ""];
    }
    const node = new ImageNode(img.src, href, `${ele.getAttribute("data-id") || ele.id}.jpg`);
    node.setPublishedAt(ele.getAttribute("data-created-at"));
    return [node, ele.getAttribute("data-tags") || ""];
  }
  getOriginalURL(doc: Document): string | null {
    return doc.querySelector<HTMLAnchorElement>("#image-resize-notice > a")?.href
      || doc.querySelector<HTMLElement>("#image")?.getAttribute("data-file-url")
      || doc.querySelector<HTMLElement>("article[data-file-url]")?.getAttribute("data-file-url")
      || null;
  }
  getNormalURL(doc: Document): string | null {
    return doc.querySelector<HTMLElement>("#image")?.getAttribute("src") || null;
  }
  extractIDFromHref(href: string): string | undefined {
    return href.match(/posts\/(\d+)/)?.[1];
  }
}

class Rule34Matcher extends DanbooruMatcher {
  site(): string {
    return "rule34";
  }
  nextPage(doc: Document): string | null {
    if (window.location.search.includes("page=favorites")) {
      const u = doc.querySelector<HTMLAnchorElement>("#paginator a[name=next]")?.getAttribute("onclick")?.match(/location='(.*)?'/)?.[1] || null;
      return u ? window.location.origin + "/" + u : u;
    } else {
      return doc.querySelector<HTMLAnchorElement>(".pagination a[alt=next]")?.href || null;
    }
  }
  queryList(doc: Document): HTMLElement[] {
    if (window.location.search.includes("page=favorites")) {
      return Array.from(doc.querySelectorAll("#content .thumb a"));
    } else {
      return Array.from(doc.querySelectorAll(".image-list > .thumb:not(.blacklisted-image) > a"));
    }
  }
  getBlacklist(doc: Document): string[] {
    return doc.querySelector("meta[name='blacklisted-tags']")?.getAttribute("content")?.split(",") || [];
  }
  toImgNode(ele: HTMLElement): [ImageNode | null, string] {
    const img = ele.querySelector<HTMLImageElement>("img");
    if (!img) {
      evLog("error", "warn: cannot find img element", img);
      return [null, ""];
    }
    const href = ele.getAttribute("href");
    if (!href) {
      evLog("error", "warn: cannot find href", ele);
      return [null, ""];
    }
    const node = new ImageNode(img.src, href, `${ele.id}.jpg`);
    const id = href.match(/id=(\d+)/)?.[1];
    if (id) {
      const addFav = new NodeAction("♥", "Add to favorites", async () => {
        fetch(`${window.location.origin}/index.php?page=post&s=vote&id=${id}&type=up`);
        const resp = await fetch(`${window.location.origin}/public/addfav.php?id=${id}`).then(resp => resp.text());
        if (resp === "2") {
          EBUS.emit("notify-message", "error", "You are not logged in");
          throw new Error("You are not logged in");
        }
      });
      node.actions.push(addFav);
    }
    return [node, img.getAttribute("alt") || ""];
  }
  getOriginalURL(doc: Document): string | null {
    // image = {'domain':'https://wimg.rule34.xxx/', 'width':1700, 'height':2300,'dir':3347, 'img':'xxx.jpeg', 'base_dir':'images', 'sample_dir':'samples', 'sample_width':'850', 'sample_height':'1150'};	
    const raw = doc.querySelector("#note-container + script")?.textContent?.trim().replace("image = ", "").replace(";", "").replaceAll("'", "\"");
    try {
      if (raw) {
        const info = JSON.parse(raw) as { domain: string, base_dir: string, dir: number, img: string };
        return `${info.domain}/${info.base_dir}/${info.dir}/${info.img}`;
      }
    } catch (error) {
      evLog("error", "get original url failed", error);
    }
    return null;
  }
  getNormalURL(doc: Document): string | null {
    const element = doc.querySelector<HTMLElement>("#image,#gelcomVideoPlayer > source");
    return element?.getAttribute("src") || element?.getAttribute("data-cfsrc") || null;
  }
  extractIDFromHref(href: string): string | undefined {
    return href.match(/id=(\d+)/)?.[1];
  }
}

class GelBooruMatcher extends DanbooruMatcher {
  site(): string {
    return "gelbooru";
  }
  nextPage(doc: Document): string | null {
    const href = doc.querySelector<HTMLAnchorElement>("#paginator a[alt=next]")?.href;
    if (href) return href;
    return doc.querySelector<HTMLAnchorElement>("#paginator b + a")?.href || null;
  }
  queryList(doc: Document): HTMLElement[] {
    return Array.from(doc.querySelectorAll(".thumbnail-container > article.thumbnail-preview:not(.blacklisted-image) > a"));
  }
  getBlacklist(doc: Document): string[] {
    return doc.querySelector("meta[name='blacklisted-tags']")?.getAttribute("content")?.split(",") || [];
  }
  toImgNode(ele: HTMLElement): [ImageNode | null, string] {
    const img = ele.querySelector<HTMLImageElement>("img");
    if (!img) {
      evLog("error", "warn: cannot find img element", img);
      return [null, ""];
    }
    const href = ele.getAttribute("href");
    if (!href) {
      evLog("error", "warn: cannot find href", ele);
      return [null, ""];
    }
    const node = new ImageNode(img.src, href, `${ele.id}.jpg`);
    const id = href.match(/id=(\d+)/)?.[1];
    if (id) {
      const addFav = new NodeAction("♥", "Add to favorites", async () => {
        fetch(`${window.location.origin}/index.php?page=post&s=vote&id=${id}&type=up`);
        let resp = await fetch(`${window.location.origin}/public/addfav.php?id=${id}`).then(resp => resp.text());
        if (resp === "2") {
          EBUS.emit("notify-message", "error", "You are not logged in");
          throw new Error("You are not logged in");
        }
      });
      node.actions.push(addFav);
    }
    return [node, img.getAttribute("alt") || ""];
  }
  getOriginalURL(doc: Document): string | null {
    return doc.querySelector("head > meta[property='og:image']")?.getAttribute("content") || null;
  }
  getNormalURL(doc: Document): string | null {
    const img = doc.querySelector<HTMLImageElement>("#image");
    if (img?.src) return img.src;
    const vidSources = Array.from(doc.querySelectorAll<HTMLSourceElement>("#gelcomVideoPlayer > source"));
    if (vidSources.length === 0) return null;
    return vidSources.find(s => s.type.endsWith("mp4"))?.src || vidSources[0].src;
  }
  extractIDFromHref(href: string): string | undefined {
    return href.match(/id=(\d+)/)?.[1];
  }
}

class E621Matcher extends DanbooruMatcher {
  cache: Map<string, { normal: string, original: string, id: string, fileExt?: string, publishedAt?: string }> = new Map();
  nextPage(doc: Document): string | null {
    return doc.querySelector<HTMLAnchorElement>(".pagination #paginator-next")?.href ?? null;
  }
  getOriginalURL(): string | null {
    throw new Error("Method not implemented.");
  }
  getNormalURL(): string | null {
    throw new Error("Method not implemented.");
  }
  extractIDFromHref(): string | undefined {
    throw new Error("Method not implemented.");
  }
  getBlacklist(doc: Document): string[] {
    const content = doc.querySelector("meta[name='blacklisted-tags']")?.getAttribute("content");
    if (!content) return [];
    return content.slice(1, -1).split(",").map(s => s.slice(1, -1))
  }
  queryList(doc: Document): HTMLElement[] {
    transient.imgSrcCSP = true;
    return Array.from(doc.querySelectorAll<HTMLElement>(".posts-container > article"));
  }
  toImgNode(ele: HTMLElement): [ImageNode | null, string] {
    const src = ele.getAttribute("data-preview-url");
    if (!src) return [null, ""];
    const tags = ele.getAttribute("data-tags");
    const id = ele.getAttribute("data-id");
    const normal = ele.getAttribute("data-sample-url");
    const original = ele.getAttribute("data-file-url");
    const fileExt = ele.getAttribute("data-file-ext") || undefined;
    if (!normal || !original || !id) return [null, ""];
    const href = `${window.location.origin}/posts/${id}`;
    const width = ele.getAttribute("data-width");
    const height = ele.getAttribute("data-height");
    const publishedAt = ele.getAttribute("data-created-at") || undefined;
    let wh = undefined;
    if (width && height) {
      wh = { w: parseInt(width), h: parseInt(height) };
    }
    this.cache.set(href, { normal, original, id, fileExt, publishedAt });
    const node = new ImageNode(src, href, `${id}.jpg`, undefined, undefined, wh);
    node.setPublishedAt(publishedAt);
    return [node, tags || ""];
  }
  cachedOriginMeta(href: string): OriginMeta | null {
    const cached = this.cache.get(href);
    if (!cached) throw new Error("miss origin meta: " + href);
    const ext = cached.fileExt ?? cached.original.split(".").pop() ?? "jpg";
    if (ADAPTER.conf.fetchOriginal || ["webm", "webp", "mp4"].includes(ext)) {
      return { url: cached.original, title: `${cached.id}.${ext}`, publishedAt: cached.publishedAt };
    }
    return { url: cached.normal, title: `${cached.id}.${cached.normal.split(".").pop()}`, publishedAt: cached.publishedAt };
  }
  site(): string {
    return "e621";
  }
}

ADAPTER.addSetup({
  name: "e621",
  workURLs: [
    /e621.net\/((posts|favorites)(?!\/)|$)/
  ],
  match: ["https://e621.net/*"],
  constructor: () => new E621Matcher(),
});

ADAPTER.addSetup({
  name: "rule34",
  workURLs: [
    /rule34.xxx\/index.php\?page=(post&s=list|favorites&s=view)/
  ],
  match: ["https://rule34.xxx/*"],
  constructor: () => new Rule34Matcher(),
});

ADAPTER.addSetup({
  name: "gelbooru",
  workURLs: [
    /gelbooru.com\/index.php\?(?=.*page=post)(?=.*s=(list|view))/
  ],
  match: ["https://gelbooru.com/*"],
  constructor: () => new GelBooruMatcher(),
});

ADAPTER.addSetup({
  name: "danbooru",
  workURLs: [
    /danbooru.donmai.us\/(posts(?:\/\d+)?(?:[?#]|$)|$)/
  ],
  match: ["https://danbooru.donmai.us/*"],
  constructor: () => new DanbooruDonmaiMatcher(),
});

function sourcePublishedAtFromBooruDocument(doc: Document): string | undefined {
  return doc.querySelector<HTMLElement>("article[data-created-at]")?.getAttribute("data-created-at")
    || doc.querySelector<HTMLTimeElement>("time[datetime]")?.getAttribute("datetime")
    || doc.querySelector<HTMLMetaElement>("meta[property='article:published_time'], meta[name='date']")?.getAttribute("content")
    || undefined;
}

function absoluteUrl(value: string): string {
  try {
    return new URL(value, window.location.href).href;
  } catch {
    return value;
  }
}

function extensionFromUrl(value: string): string {
  try {
    return new URL(value, window.location.href).pathname.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() || "";
  } catch {
    return "";
  }
}

function imageSizeFromDocument(doc: Document): { w: number, h: number } | undefined {
  const image = doc.querySelector<HTMLImageElement>("#image");
  const article = doc.querySelector<HTMLElement>("article[data-width][data-height]");
  const w = Number(image?.getAttribute("width") || image?.getAttribute("data-width") || article?.getAttribute("data-width"));
  const h = Number(image?.getAttribute("height") || image?.getAttribute("data-height") || article?.getAttribute("data-height"));
  return Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0 ? { w, h } : undefined;
}
