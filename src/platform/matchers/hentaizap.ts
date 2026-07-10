import { GalleryMeta } from "../../download/gallery-meta";
import ImageNode from "../../img-node";
import { ADAPTER } from "../adapt";
import { hentaizapGalleryMetaFromDocument, hentaizapPublishedAtFromDocument } from "../../eagle/adapters/hentaizap";
import { BaseMatcher, OriginMeta, Result } from "../platform";

type HentaiZapGalleryInfo = {
  serverID: string,
  galleryID: string,
  loadDir: string,
  loadID: string,
  loadPages: number,
  images: Record<string, string>,
}

const HENTAIZAP_TYPE_MAP: Record<string, string> = {
  "j": "jpg",
  "p": "png",
  "b": "bmp",
  "g": "gif",
  "w": "webp",
};

class HentaiZapMatcher extends BaseMatcher<HentaiZapGalleryInfo> {
  meta?: GalleryMeta;
  publishedAt = "";

  galleryMeta(): GalleryMeta {
    if (this.meta) return this.meta;
    this.meta = hentaizapGalleryMetaFromDocument(document);
    return this.meta;
  }

  async *fetchPagesSource(): AsyncGenerator<Result<HentaiZapGalleryInfo>> {
    this.publishedAt = hentaizapPublishedAtFromDocument(document);
    const gthRaw = Array.from(document.querySelectorAll<HTMLScriptElement>("script"))
      .find(e => e.textContent?.trimStart()?.startsWith("var g_th"))
      ?.textContent?.match(/\('(\{.*\})'\)/)?.[1];
    if (!gthRaw) throw new Error("cannot find g_th");
    const serverID = document.querySelector<HTMLInputElement>("input#load_server")?.value;
    if (!serverID) throw new Error("cannot find server id");
    const loadDir = document.querySelector<HTMLInputElement>("input#load_dir")?.value;
    if (!loadDir) throw new Error("cannot find load dir");
    const galleryID = document.querySelector<HTMLInputElement>("input#gallery_id")?.value;
    if (!galleryID) throw new Error("cannot find gallery id");
    const loadID = document.querySelector<HTMLInputElement>("input#load_id")?.value;
    if (!loadID) throw new Error("cannot find load id");
    const loadPages = document.querySelector<HTMLInputElement>("input#load_pages")?.value;
    if (!loadPages) throw new Error("cannot find load pages");
    const gth = JSON.parse(gthRaw) as Record<string, string>;
    const info: HentaiZapGalleryInfo = {
      serverID, galleryID, loadDir, loadID, loadPages: parseInt(loadPages), images: gth
    };
    yield Result.ok(info);
  }

  async parseImgNodes(info: HentaiZapGalleryInfo): Promise<ImageNode[]> {
    const server = `m${info.serverID}.hentaizap.com`;
    const nodes: ImageNode[] = [];
    const digits = info.loadPages.toString().length;
    for (let i = 0; i < info.loadPages; i++) {
      // https://m10.hentaizap.com/029/ebsm4v8rz0/1t.jpg
      const [t, w, h] = info.images[(i + 1).toString()]?.split(",") ?? [];
      if (!t || !w || !h) throw new Error("cannot find image g_th: " + (i + 1));
      const ext = HENTAIZAP_TYPE_MAP[t] ?? "webp";
      const thumb = `https://${server}/${info.loadDir}/${info.loadID}/${i + 1}t.jpg`;
      const href = `${window.location.origin}/g/${info.galleryID}/${i + 1}/`;
      const origin = `https://${server}/${info.loadDir}/${info.loadID}/${i + 1}.${ext}`;
      const title = (i + 1).toString().padStart(digits, "0");
      const node = new ImageNode(thumb, href, `${title}.${ext}`, undefined, origin, { w: parseInt(w), h: parseInt(h) });
      node.setPublishedAt(this.publishedAt);
      nodes.push(node);
    }
    return nodes;
  }

  async fetchOriginMeta(node: ImageNode): Promise<OriginMeta> {
    return { url: node.originSrc! };
  }

}

ADAPTER.addSetup({
  name: "HentaiZap",
  workURLs: [
    /hentaizap.com\/gallery\/\w+\/?/
  ],
  match: ["https://hentaizap.com/*"],
  constructor: () => new HentaiZapMatcher(),
});
