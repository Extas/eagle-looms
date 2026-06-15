import { GalleryMeta } from '../../download/gallery-meta';
import ImageNode from '../../img-node';
import { ADAPTER } from '../adapt';
import { BaseMatcher, Result, OriginMeta } from '../platform';

class ArcaMatcher extends BaseMatcher<Document> {
  async *fetchPagesSource(): AsyncGenerator<Result<Document>> {
    yield Result.ok(document);
  }
  async parseImgNodes(doc: Document): Promise<ImageNode[]> {
    const imageString = '.article-content img:not(.arca-emoticon):not(.twemoji)';
    const videoString = '.article-content video:not(.arca-emoticon)';
    const publishedAt = arcaPublishedAtFromDocument(doc);

    const elements = Array.from(doc.querySelectorAll<HTMLElement>(`${imageString}, ${videoString}`));
    const nodes: ImageNode[] = [];
    const digits = elements.length.toString().length;

    elements.forEach((element, i) => {
      if (element.tagName.toLowerCase() === 'img') {
        const img = element as HTMLImageElement;
        if (img.src && img.style.width !== '0px') {
          const src = img.src;
          const href = new URL(src);
          const ext = href.pathname.split('.').pop();
          href.searchParams.set('type', 'orig');
          const title = (i + 1).toString().padStart(digits, '0') + '.' + ext;
          const node = new ImageNode(src, href.href, title, undefined, href.href);
          node.setPublishedAt(publishedAt);
          nodes.push(node);
        }
      } else if (element.tagName.toLowerCase() === 'video') {
        const video = element as HTMLVideoElement;
        if (video.src) {
          const src = video.src;
          const href = new URL(src);
          const ext = href.pathname.split('.').pop();
          href.searchParams.set('type', 'orig');
          const title = (i + 1).toString().padStart(digits, '0') + '.' + ext;
          const poster = video.poster || '';
          const node = new ImageNode(poster, href.href, title, undefined, href.href);
          node.setPublishedAt(publishedAt);
          nodes.push(node);
        }
      }
    });

    return nodes;
  }
  async fetchOriginMeta(node: ImageNode): Promise<OriginMeta> {
    return { url: node.href };
  }

  galleryMeta(): GalleryMeta {
    return arcaGalleryMetaFromDocument(document, window.location.href);
  }
}

export function arcaGalleryMetaFromDocument(doc: Document, href: string): GalleryMeta {
  const meta = new GalleryMeta(href, arcaTitleFromDocument(doc));
  const channel = arcaChannelFromUrl(href);
  if (channel) meta.tags.channel = [channel];
  const author = arcaAuthorFromDocument(doc);
  if (author) meta.tags.author = [author];
  meta.authorUrls = arcaAuthorUrlsFromDocument(doc, href);
  return meta;
}

export function arcaTitleFromDocument(doc: Document): string {
  for (const selector of [
    ".article-title",
    ".article-head .title",
    ".title-row .title",
    "meta[property='og:title']",
    "meta[name='twitter:title']",
  ]) {
    const element = doc.querySelector(selector);
    const value = cleanArcaValue(element instanceof HTMLMetaElement ? element.content : element?.textContent);
    if (value) return value;
  }
  return cleanArcaValue(doc.title) || "arca";
}

export function arcaChannelFromUrl(href: string): string {
  try {
    const url = new URL(href, "https://arca.live");
    const match = url.pathname.match(/^\/b\/([^/]+)/i);
    return cleanArcaValue(match ? decodeURIComponent(match[1]) : "");
  } catch {
    return "";
  }
}

export function arcaPublishedAtFromDocument(doc: Document): string {
  for (const selector of [
    "time[datetime]",
    "[datetime]",
    "meta[property='article:published_time']",
    "meta[name='date']",
    "meta[itemprop='datePublished']",
  ]) {
    const element = doc.querySelector(selector);
    const value = cleanArcaValue(element instanceof HTMLMetaElement
      ? element.content
      : element?.getAttribute("datetime") || element?.textContent);
    if (value) return value;
  }
  return "";
}

function arcaAuthorFromDocument(doc: Document): string {
  for (const selector of [
    ".article-head .user-info a",
    ".article-info .user-info a",
    ".user-info .nickname",
    ".member-info a[href*='/u/']",
    "meta[name='author']",
  ]) {
    const element = doc.querySelector(selector);
    const value = cleanArcaValue(element instanceof HTMLMetaElement ? element.content : element?.textContent);
    if (value) return value;
  }
  return "";
}

function arcaAuthorUrlsFromDocument(doc: Document, href: string): string[] {
  const urls = Array.from(doc.querySelectorAll<HTMLAnchorElement>(".article-head .user-info a[href], .article-info .user-info a[href], .member-info a[href*='/u/']"))
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

function cleanArcaValue(value: unknown): string {
  if (typeof value !== "string" && typeof value !== "number") return "";
  return String(value)
    .replace(/[\n\r\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

ADAPTER.addSetup({
  name: "Arcalive",
  workURLs: [
    /arca.live\/b\/\w*\/\d+/
  ],
  match: ["https://arca.live/*"],
  constructor: () => new ArcaMatcher(),
});
