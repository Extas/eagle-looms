import { GalleryMeta } from "../../download/gallery-meta";
import ImageNode from "../../img-node";
import { Chapter } from "../../page-fetcher";
import { ADAPTER } from "../adapt";
import { BaseMatcher, OriginMeta, Result } from "../platform";

type EahentaiGalleryData = {
  albumID: number,
  addDt: string,
  thumbnailUri: string, // 
  imageUri: string,
  title: string,
  tags: string,
  from: string,
  characters: string,
  author: string,
  albumType: string,
  images: EahentaiGalleryImage[],
}

type EahentaiGalleryImage = {
  imageId: number,
  addDt: string,
  imageUri: string,
  thumbnailUri: string,
  title: string,
  author: string,
  sort: number,
}

function eahentaiGetURL(uri: string) {
  return 'https://i.eahentai.com/file/ea-gallery/' + encodeURI(uri).replace(/,/g, '%2C').replace(/&/g, '%26').replace(/\+/g, '%2B').replace(/%20/g, '+');
}
class EahentaiMatcher extends BaseMatcher<EahentaiGalleryData> {
  meta?: GalleryMeta;

  async *fetchPagesSource(): AsyncGenerator<Result<EahentaiGalleryData>> {
    const galleryID = window.location.href.match(/eahentai.com\/a\/(\d+)/)?.[1];
    if (!galleryID) throw new Error("cannot get gallery id from url: " + window.location.href);
    const api = `${window.location.origin}/api/image/album/${galleryID}`;
    const data = await window.fetch(api, { "referrer": window.location.href, }).then(resp => resp.json()) as EahentaiGalleryData[];
    if (!data || data.length === 0) throw new Error("cannot fetch album data from: " + api);
    const data1 = data[0];

    this.meta = eahentaiGalleryMeta(data1, window.location.href);

    yield Result.ok(data[0]);
  }

  async parseImgNodes(data: EahentaiGalleryData): Promise<ImageNode[]> {
    return data.images.map((img, i) => {
      const thumb = eahentaiGetURL(img.thumbnailUri);
      const href = `${window.location.origin}/a/${data.albumID}/${i}`;
      const ext = img.imageUri.split(".").pop() ?? "jpg";
      const origin = eahentaiGetURL(img.imageUri);
      const node = new ImageNode(thumb, href, img.title + "." + ext, undefined, origin);
      node.setPublishedAt(eahentaiPublishedAt(img, data));
      return node;
    });
  }

  async fetchOriginMeta(node: ImageNode): Promise<OriginMeta> {
    return { url: node.originSrc! };
  }

  galleryMeta(chapter: Chapter): GalleryMeta {
    return this.meta ?? super.galleryMeta(chapter);
  }

}

export function eahentaiPublishedAt(image: { addDt?: unknown }, gallery?: { addDt?: unknown }): string {
  return cleanEahentaiValue(image.addDt) || cleanEahentaiValue(gallery?.addDt);
}

export function eahentaiGalleryMeta(data: Pick<EahentaiGalleryData, "title" | "tags" | "author" | "albumType" | "characters">, href: string): GalleryMeta {
  const meta = new GalleryMeta(href, cleanEahentaiValue(data.title) || "eahentai");
  meta.tags.tags = splitEahentaiTags(data.tags);
  const author = cleanEahentaiValue(data.author);
  if (author) meta.tags.author = [author];
  meta.tags.albumType = splitEahentaiTags(data.albumType);
  meta.tags.characters = splitEahentaiTags(data.characters);
  return meta;
}

function splitEahentaiTags(value: unknown): string[] {
  return cleanEahentaiValue(value)
    .split("|")
    .map(cleanEahentaiValue)
    .filter(Boolean);
}

function cleanEahentaiValue(value: unknown): string {
  if (typeof value !== "string" && typeof value !== "number") return "";
  return String(value)
    .replace(/[\n\r\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

ADAPTER.addSetup({
  name: "eahentai",
  workURLs: [
    /eahentai.com\/a\/\d+\/?$/
  ],
  match: ["https://eahentai.com/*"],
  constructor: () => new EahentaiMatcher(),
});
