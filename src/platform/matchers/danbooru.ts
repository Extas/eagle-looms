import { transient } from "../../config";
import type { GalleryMeta } from "../../download/gallery-meta";
import EBUS from "../../event-bus";
import ImageNode, { NodeAction } from "../../img-node";
import { evLog } from "../../utils/ev-log";
import { ADAPTER } from "../adapt";
import { booruGalleryMetaFromState, booruPublishedAtFromDocument, e621AuthorUrls, e621SourceTags, extractBooruAuthorUrls, extractBooruSourceTags, normalizeBooruSourceTags, normalizeCommaSeparatedBooruTagText, type E621Post } from "../../eagle/adapters/booru";
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
    node.setAuthorUrls(...extractBooruAuthorUrls(doc, node.href));
    if (ADAPTER.conf.fetchOriginal) {
      url = this.getOriginalURL(doc);
    }
    if (!url) {
      url = this.getNormalURL(doc);
    }
    if (!url) throw new Error("Cannot find origin image or video url");
    const publishedAt = booruPublishedAtFromDocument(doc);
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
        const sourceTags = normalizeBooruSourceTags(booruMetadataRoot(ele), tagList);
        imgNode.setTags(...sourceTags);
        this.tags[this.extractIDFromHref(imgNode.href) || imgNode.title.split(".")[0]] = sourceTags;
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
    node.setAuthorUrls(...extractBooruAuthorUrls(doc, window.location.href));
    node.setPublishedAt(booruPublishedAtFromDocument(doc));
    this.tags[id] = sourceTags;
    return node;
  }

  abstract site(): string;

  galleryMeta(): GalleryMeta {
    const postId = this.extractIDFromHref(window.location.href);
    return booruGalleryMetaFromState(this.site(), window.location.href, postId, this.tags);
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

export class GelBooruMatcher extends DanbooruMatcher {
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
    const root = booruMetadataRoot(ele);
    const id = root.getAttribute("data-id") || root.id.match(/\d+/)?.[0] || this.extractIDFromHref(href);
    const ext = extensionFromUrl(root.getAttribute("data-file-url") || img.src) || "jpg";
    const node = new ImageNode(img.src, href, `${id || ele.id || "post"}.${ext}`, undefined, undefined, imageSizeFromElement(root, img));
    node.setPublishedAt(root.getAttribute("data-created-at") || root.querySelector<HTMLTimeElement>("time[datetime]")?.getAttribute("datetime"));
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
    const canonicalTags = (img.getAttribute("title") || "")
      .split(/\s+/)
      .filter(tag => tag && !/^(?:score|rating):/i.test(tag))
      .join(" ");
    const readableTags = (img.getAttribute("alt") || "").replace(/^Rule 34\s*\|\s*/i, "");
    const fallbackTags = readableTags.includes(",")
      ? normalizeCommaSeparatedBooruTagText(readableTags)
      : readableTags;
    return [node, canonicalTags || fallbackTags];
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

export class E621Matcher extends DanbooruMatcher {
  cache: Map<string, { normal: string, original: string, id: string, fileExt?: string, publishedAt?: string }> = new Map();
  nextPage(doc: Document): string | null {
    return doc.querySelector<HTMLAnchorElement>(".pagination #paginator-next")?.href ?? null;
  }
  getOriginalURL(doc: Document): string | null {
    return doc.querySelector<HTMLElement>("article[data-file-url], #image[data-file-url]")?.getAttribute("data-file-url") || null;
  }
  getNormalURL(doc: Document): string | null {
    return doc.querySelector<HTMLElement>("article[data-sample-url]")?.getAttribute("data-sample-url")
      || doc.querySelector<HTMLImageElement>("#image")?.src
      || null;
  }
  extractIDFromHref(href: string): string | undefined {
    return href.match(/\/posts\/(\d+)/)?.[1];
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
    const publishedAt = cleanE621Timestamp(ele.getAttribute("data-created-at"));
    let wh = undefined;
    if (width && height) {
      wh = { w: parseInt(width), h: parseInt(height) };
    }
    this.cache.set(href, { normal, original, id, fileExt, publishedAt });
    const node = new ImageNode(src, href, `${id}.${fileExt || "jpg"}`, undefined, undefined, wh);
    node.setPublishedAt(publishedAt);
    return [node, tags || ""];
  }
  async parseImgNodes(doc: Document): Promise<ImageNode[]> {
    const detailId = this.extractIDFromHref(window.location.href);
    if (detailId) {
      try {
        const post = (await this.fetchPosts([detailId], true))[0];
        const node = post && this.nodeFromPost(post);
        if (node) {
          this.count++;
          return [node];
        }
      } catch (error) {
        evLog("error", "e621 detail metadata request failed; using page metadata", error);
      }
      return super.parseImgNodes(doc);
    }

    const nodes = await super.parseImgNodes(doc);
    const ids = nodes.map(node => this.extractIDFromHref(node.href)).filter((id): id is string => Boolean(id));
    if (ids.length === 0) return nodes;

    try {
      const posts = await this.fetchPosts(ids, false);
      const postsById = new Map(posts.map(post => [String(post.id), post]));
      return nodes.map((node) => {
        const id = this.extractIDFromHref(node.href);
        return (id && postsById.get(id) && this.nodeFromPost(postsById.get(id)!)) || node;
      });
    } catch (error) {
      evLog("error", "e621 list metadata request failed; using card metadata", error);
      return nodes;
    }
  }
  cachedOriginMeta(href: string): OriginMeta | null {
    const cached = this.cache.get(href);
    if (!cached) return null;
    const ext = cached.fileExt ?? cached.original.split(".").pop() ?? "jpg";
    if (ADAPTER.conf.fetchOriginal || ["webm", "webp", "mp4"].includes(ext)) {
      return { url: cached.original, title: `${cached.id}.${ext}`, publishedAt: cached.publishedAt };
    }
    return { url: cached.normal, title: `${cached.id}.${extensionFromUrl(cached.normal) || ext}`, publishedAt: cached.publishedAt };
  }
  site(): string {
    return "e621";
  }

  private async fetchPosts(ids: string[], detail: boolean): Promise<E621Post[]> {
    const url = detail
      ? new URL(`/posts/${ids[0]}.json`, window.location.origin)
      : new URL("/posts.json", window.location.origin);
    if (!detail) {
      url.searchParams.set("tags", `id:${ids.join(",")}`);
      url.searchParams.set("limit", String(ids.length));
    }
    const response = await window.fetch(url.href, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`e621 API request failed: HTTP ${response.status}`);
    return e621PostsFromPayload(await response.json());
  }

  private nodeFromPost(post: E621Post): ImageNode | null {
    const original = post.file.url;
    if (!original) return null;
    const normal = post.sample.url || original;
    const preview = post.preview.url || normal;
    const id = String(post.id);
    const href = new URL(`/posts/${id}`, window.location.origin).href;
    const fileExt = post.file.ext || extensionFromUrl(original) || "jpg";
    const publishedAt = cleanE621Timestamp(post.created_at);
    const sourceTags = e621SourceTags(post);
    const wh = post.file.width > 0 && post.file.height > 0
      ? { w: post.file.width, h: post.file.height }
      : undefined;

    this.cache.set(href, { normal, original, id, fileExt, publishedAt });
    this.tags[id] = sourceTags;
    const node = new ImageNode(preview, href, `${id}.${fileExt}`, undefined, undefined, wh);
    node.setTags(...sourceTags);
    node.setAuthorUrls(...e621AuthorUrls(post, window.location.origin));
    node.setPublishedAt(publishedAt);
    return node;
  }
}

class ATFMatcher extends DanbooruMatcher {
  site(): string { return "AllTheFallen"; }
  private baseUrl: string = "https://booru.allthefallen.moe";
  getBlacklist(doc: Document): string[] {
    const ul = doc.querySelector('ul#blacklist-list');
    if (!ul) return [];
    return Array.from(ul.querySelectorAll('li a')).map(a => a.textContent?.trim()).filter((text): text is string => !!text && text.length > 0)
  }
  nextPage(doc: Document): string | null {
    const nextP = doc.querySelector('a.paginator-next');
    const path = nextP ? nextP.getAttribute('href') : null;
    if (!path) return null;
    return new URL(path, this.baseUrl).href;
  }
  queryList(doc: Document): HTMLElement[] { return Array.from(doc.querySelectorAll(".posts-container > article:not(.blacklisted-active)")); }
  toImgNode(ele: HTMLElement): [ImageNode | null, string] {
    const img = ele.querySelector<HTMLImageElement>("img");
    if (!img) {
      evLog("error", "warn: cannot find img element", img);
      return [null, ""];
    }
    const href = ele.querySelector("a")?.getAttribute("href") ?? null;
    if (!href) {
      evLog("error", "warn: cannot find href", ele);
      return [null, ""];
    }
    const node = new ImageNode(img.src, href, `${ele.id}.jpg`);
    const match1 = href.match(/\/posts\/(\d+)/);
    const id = match1 ? `post_${match1[1]}` : undefined;
    if (id) {
      const addFav = new NodeAction("♥", "Add to favorites", async () => {

        EBUS.emit("notify-message", "error", "Not implemented");
        throw new Error("Not implemented");

      });
      node.actions.push(addFav);
    }
    const tags = img.title.split(" ").map(t => t.trim()).filter(t => (t) && !(t.startsWith("score") || t.startsWith("rating"))).map(t => "tag:" + t);
    node.setTags(...tags);
    return [node, img.getAttribute("alt") || ""];
  }
  getOriginalURL(doc: Document): string | null {
    const link = doc.querySelector('li#post-option-download > a');
    return link?.getAttribute("href")?.split('?')[0] ?? null;
  }
  getNormalURL(doc: Document): string | null {
    const link = doc.getElementById('image');
    return link?.getAttribute("src") ?? null;

  }
  extractIDFromHref(href: string): string | undefined {
    return href.match(/\/posts\/(\d+)/)?.[1];
  }
}

class Rule34USMatcher extends DanbooruMatcher {
  nextPage(doc: Document): string | null {
    let href = doc.querySelector<HTMLAnchorElement>(".pagination a[alt=next]")?.href;
    if (!href) {
      href = doc.querySelector<HTMLAnchorElement>(".pagination b + a")?.href;
    }
    return href ?? null;
  }
  getOriginalURL(doc: Document): string | null {
    return this.getNormalURL(doc);
  }
  getNormalURL(doc: Document): string | null {
    const videoSource = doc.querySelector<HTMLSourceElement>(".container .content_push video source");
    if (videoSource) {
      return videoSource.src;
    }
    return doc.querySelector<HTMLImageElement>(".container .content_push img")?.src ?? null;
  }
  extractIDFromHref(href: string): string | undefined {
    return href.match(/id=(\d+)/)?.[1];
  }
  getBlacklist(): string[] {
    return [];
  }
  queryList(doc: Document): HTMLElement[] {
    return Array.from(doc.querySelectorAll(".thumbail-container > div > a"));
  }
  toImgNode(ele: HTMLElement): [ImageNode | null, string] {
    const elem = ele as HTMLAnchorElement;
    const imgElem = elem.querySelector<HTMLImageElement>("img");
    if (!imgElem) return [null, ""];
    const href = elem.href;
    const thumb = imgElem.src;
    const tags = normalizeCommaSeparatedBooruTagText(imgElem.title);
    const node = new ImageNode(thumb, href, elem.id + ".jpg")
    if (/\bvideo\b/.test(tags)) {
      node.mimeType = "video/mp4";
    }
    const id = href.match(/id=(\d+)/)?.[1];
    if (id) {
      if (/r=favorites/.test(window.location.href)) {
        const delFav = new NodeAction("X", "Delete to favorites", async () => {
          await fetch(`${window.location.origin}/index.php?r=favorites/delete&id=${id}`);
        });
        node.actions.push(delFav);
      } else {
        const addFav = new NodeAction("♥", "Add to favorites", async () => {
          fetch(`${window.location.origin}/index.php?r=posts/vote&id=${id}&type=up`);
          const resp = await fetch(`${window.location.origin}/index.php?r=favorites/create&id=${id}`).then(resp => resp.text());
          if (resp === "2") {
            EBUS.emit("notify-message", "error", "You are not logged in");
            throw new Error("You are not logged in");
          }
        });
        node.actions.push(addFav);
      }
    }
    return [node, tags];
  }
  site(): string {
    return "Rule34US";
  }

}

ADAPTER.addSetup({
  name: "e621",
  workURLs: [
    /e621.net\/(posts(?:\/\d+)?(?:[?#]|$)|favorites(?:[?#]|$)|$)/
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
  name: "rule34.US",
  workURLs: [
    /rule34.us\/index.php\?r=posts\/index/,
    /rule34.us\/index.php\?r=favorites\/view/,
  ],
  match: ["https://rule34.us/*"],
  constructor: () => new Rule34USMatcher(),
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

ADAPTER.addSetup({
  name: "AllTheFallen",
  workURLs: [
    /booru.allthefallen.moe\/(posts(?!\/)|$)/
  ],
  match: ["https://booru.allthefallen.moe/*"],
  constructor: () => new ATFMatcher(),
});

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

function booruMetadataRoot(ele: HTMLElement): HTMLElement {
  return ele.closest<HTMLElement>("article, .thumbnail-preview, .post-preview") || ele;
}

function imageSizeFromElement(root: HTMLElement, image?: HTMLImageElement | null): { w: number, h: number } | undefined {
  const w = Number(root.getAttribute("data-width") || image?.getAttribute("width") || image?.getAttribute("data-width"));
  const h = Number(root.getAttribute("data-height") || image?.getAttribute("height") || image?.getAttribute("data-height"));
  return Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0 ? { w, h } : undefined;
}

function cleanE621Timestamp(value: unknown): string | undefined {
  const timestamp = String(value ?? "").trim();
  if (!timestamp) return undefined;
  const quote = timestamp[0];
  return (quote === '"' || quote === "'") && timestamp.at(-1) === quote
    ? timestamp.slice(1, -1).trim() || undefined
    : timestamp;
}

function e621PostsFromPayload(value: unknown): E621Post[] {
  if (!value || typeof value !== "object") return [];
  const payload = value as { post?: E621Post, posts?: E621Post[] };
  const posts = payload.post ? [payload.post] : payload.posts;
  return (posts || []).filter(post => Boolean(
    post
    && Number.isFinite(post.id)
    && post.file
    && post.preview
    && post.sample
    && post.tags,
  ));
}
