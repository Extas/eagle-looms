import { GalleryMeta } from "../../download/gallery-meta";
import ImageNode from "../../img-node";
import { ImagePosition, splitImagesFromUrl } from "../../utils/sprite-split";
import { ADAPTER } from "../adapt";
import { isGalleryAuthorCategory } from "../../eagle/adapters/gallery-author-urls";
import { cleanGalleryDateValue, isGalleryDateCategory } from "../gallery-published-at";
import { BaseMatcher, OriginMeta, Result } from "../platform";

export class RokuHentaiMatcher extends BaseMatcher<[number, number]> {
  sprites: ({ src: string, pos: ImagePosition } | undefined)[] = [];
  fetchedThumbnail: (string | undefined)[] = [];
  galleryId: string = "";
  imgCount: number = 0;
  publishedAt = "";

  galleryMeta(): GalleryMeta {
    const title = document.querySelector(".site-manga-info__title-text")?.textContent || "UNTITLE";
    const meta = new GalleryMeta(window.location.href, title);
    meta.originTitle = title;
    const tags: Record<string, string[]> = {};
    rokuHentaiTagsFromDocument(document).forEach((tag) => {
      if (tags[tag.category] === undefined) tags[tag.category] = [];
      tags[tag.category].push(tag.value);
    });
    meta.tags = tags;
    meta.authorUrls = rokuHentaiAuthorUrlsFromDocument(document);
    return meta;
  }

  async fetchOriginMeta(node: ImageNode): Promise<OriginMeta> {
    return { url: node.originSrc! };
  }

  async parseImgNodes(range: [number, number]): Promise<ImageNode[]> {
    const list: ImageNode[] = [];
    const digits = this.imgCount.toString().length;
    for (let i = range[0]; i < range[1]; i++) {
      let thumbnail = "";
      let thumbnailAsync = undefined;
      if (this.sprites[i]) {
        thumbnailAsync = this.fetchThumbnail(i);
      } else {
        thumbnail = `https://rokuhentai.com/_images/page-thumbnails/${this.galleryId}/${i}.jpg`;
      }
      const src = `https://rokuhentai.com/_images/pages/${this.galleryId}/${i}.jpg`;
      const node = new ImageNode(thumbnail, src, i.toString().padStart(digits, "0") + ".jpg", thumbnailAsync, src);
      node.setPublishedAt(this.publishedAt);
      list.push(node);
    }
    return list;
  }

  async *fetchPagesSource(): AsyncGenerator<Result<[number, number]>> {
    const doc = document;
    const imgCount = parseInt(doc.querySelector(".mdc-typography--caption")?.textContent || "");
    if (isNaN(imgCount)) {
      throw new Error("error: failed query image count!")
    }
    this.imgCount = imgCount;
    this.galleryId = window.location.href.split("/").pop()!; // TODO: maybe extract galleryId from doc;
    this.publishedAt = rokuHentaiPublishedAtFromDocument(doc);
    // check sprite thumbnails
    const images = Array.from(doc.querySelectorAll<HTMLElement>(".mdc-layout-grid__cell .site-page-card__media"));
    for (const img of images) {
      this.fetchedThumbnail.push(undefined);
      const x = parseInt(img.getAttribute("data-offset-x") || "");
      const y = parseInt(img.getAttribute("data-offset-y") || "");
      const width = parseInt(img.getAttribute("data-width") || "");
      const height = parseInt(img.getAttribute("data-height") || "");
      if (isNaN(x) || isNaN(y) || isNaN(width) || isNaN(height)) {
        this.sprites.push(undefined);
        continue;
      }
      const src = img.getAttribute("data-src")!;
      this.sprites.push({ src, pos: { x, y, width, height } });
    }
    // split to range by 20 from image count
    for (let i = 0; i < this.imgCount; i += 20) {
      yield Result.ok([i, Math.min(i + 20, this.imgCount)]);
    }
  }

  private async fetchThumbnail(index: number): Promise<string> {
    if (this.fetchedThumbnail[index]) {
      return this.fetchedThumbnail[index]!;
    }
    const src = this.sprites[index]!.src;
    const positions = [];
    for (let i = index; i < this.imgCount; i++) {
      if (src === this.sprites[i]?.src) {
        positions.push(this.sprites[i]!.pos);
      } else {
        break;
      }
    }
    const urls = await splitImagesFromUrl(src, positions);
    for (let i = index; i < index + urls.length; i++) {
      this.fetchedThumbnail[i] = urls[i - index];
    }
    return this.fetchedThumbnail[index]!;
  }

  async processData(data: Uint8Array<ArrayBuffer>): Promise<[Uint8Array<ArrayBuffer>, string]> {
    return [data, "image/jpeg"];
  }
}

type RokuHentaiTag = {
  category: string;
  value: string;
  href: string;
};

export function rokuHentaiTagsFromDocument(doc: Document): RokuHentaiTag[] {
  return Array.from(doc.querySelectorAll<HTMLElement>("div.mdc-chip .site-tag-count[data-tag]"))
    .map(element => rokuHentaiTagFromElement(element))
    .filter((tag): tag is RokuHentaiTag => Boolean(tag));
}

export function rokuHentaiAuthorUrlsFromDocument(doc: Document, baseUrl = window.location.href): string[] {
  const urls = rokuHentaiTagsFromDocument(doc)
    .filter(tag => isGalleryAuthorCategory(tag.category))
    .map(tag => absoluteHttpUrl(tag.href, baseUrl))
    .filter(Boolean);
  return [...new Set(urls)];
}

export function rokuHentaiPublishedAtFromDocument(doc: Document): string {
  for (const tag of rokuHentaiTagsFromDocument(doc)) {
    if (!isGalleryDateCategory(tag.category)) continue;
    const value = cleanGalleryDateValue(tag.value);
    if (value) return value;
  }
  return "";
}

function rokuHentaiTagFromElement(element: HTMLElement): RokuHentaiTag | undefined {
  const parsed = parseRokuHentaiDataTag(element.getAttribute("data-tag"));
  if (!parsed) return undefined;
  return {
    ...parsed,
    href: element.closest<HTMLAnchorElement>("a[href]")?.getAttribute("href") || "",
  };
}

function parseRokuHentaiDataTag(value: unknown): Pick<RokuHentaiTag, "category" | "value"> | undefined {
  const raw = String(value ?? "").trim();
  const match = raw.match(/^([^:]+):"?(.+?)"?$/);
  if (!match) return undefined;
  const category = match[1].trim();
  const tagValue = match[2].trim().replace(/^"|"$/g, "");
  return category && tagValue ? { category, value: tagValue } : undefined;
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
  name: "rokuhentai",
  workURLs: [
    /rokuhentai.com\/\w+$/
  ],
  match: ["https://rokuhentai.com/*"],
  constructor: () => new RokuHentaiMatcher(),
});
