import type { GalleryMeta } from "../../download/gallery-meta";
import ImageNode from "../../img-node";
import { evLog } from "../../utils/ev-log";
import { ADAPTER } from "../adapt";
import { MoebooruPostInfo, MoebooruTagTypes, moebooruAuthorUrlsFromTags, moebooruGalleryMetaFromState, moebooruPostIdFromUrl, normalizeMoebooruSourceTags, parseMoebooruPostInfos, parseMoebooruTagTypes } from "../../eagle/adapters/moebooru";
import { BaseMatcher, OriginMeta, Result } from "../platform";

export class YandereMatcher extends BaseMatcher<Document> {

  infos: Record<string, MoebooruPostInfo> = {};
  tagTypes: MoebooruTagTypes = {};
  count: number = 0;

  async *fetchPagesSource(): AsyncGenerator<Result<Document>> {
    let doc = document;
    yield Result.ok(doc);
    // find next page
    let tryTimes = 0;
    while (true) {
      const url = doc.querySelector<HTMLAnchorElement>("#paginator a.next_page")?.href;
      if (!url) break;
      try {
        doc = await window.fetch(url).then((res) => res.text()).then((text) => new DOMParser().parseFromString(text, "text/html"));
      } catch (e) {
        tryTimes++;
        if (tryTimes > 3) throw new Error(`fetch next page failed, ${e}`);
        continue;
      }
      tryTimes = 0;
      yield Result.ok(doc);
    }
  }

  async parseImgNodes(doc: Document): Promise<ImageNode[]> {
    this.tagTypes = parseMoebooruTagTypes(doc);
    const postId = moebooruPostIdFromUrl(window.location.href);
    const infos = parseMoebooruPostInfos(doc).filter(info => !postId || String(info.id) === postId);
    if (infos.length === 0) throw new Error("cannot find post list from script");
    const ret = [];
    for (const info of infos) {
      try {
        this.infos[info.id.toString()] = info;
        this.count++;
        const ext = info.file_ext || extensionFromUrl(info.file_url) || "jpg";
        const node = new ImageNode(info.preview_url, `${window.location.origin}/post/show/${info.id}`, `${info.id}.${ext}`, undefined, undefined, imageSizeFromInfo(info));
        node.setTags(...normalizeMoebooruSourceTags(info.tags, this.tagTypes));
        node.setAuthorUrls(...moebooruAuthorUrlsFromTags(info.tags, this.tagTypes, window.location.href));
        node.setPublishedAt(info.created_at);
        ret.push(node);
      } catch (error) {
        evLog("error", "parse post info failed", error);
        continue;
      }
    }
    return ret;
  }

  async fetchOriginMeta(node: ImageNode): Promise<OriginMeta> {
    const id = node.href.split("/").pop();
    if (!id) {
      throw new Error(`cannot find id from ${node.href}`);
    }
    let url: string | undefined;
    if (ADAPTER.conf.fetchOriginal) {
      url = this.infos[id]?.file_url;
    } else {
      url = this.infos[id]?.sample_url;
    }
    if (!url) {
      throw new Error(`cannot find url for id ${id}`);
    }
    return { url, publishedAt: this.infos[id]?.created_at ? String(this.infos[id].created_at) : undefined };
  }

  galleryMeta(): GalleryMeta {
    return moebooruGalleryMetaFromState("yande.re", window.location.href, this.infos, this.tagTypes);
  }
}
ADAPTER.addSetup({
  name: "yande.re",
  workURLs: [
    /yande.re\/post(?:$|[?#]|\/show\/)/
  ],
  match: ["https://yande.re/*"],
  constructor: () => new YandereMatcher(),
});

function imageSizeFromInfo(info: Pick<MoebooruPostInfo, "width" | "height">): { w: number, h: number } | undefined {
  const w = Number(info.width);
  const h = Number(info.height);
  return Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0 ? { w, h } : undefined;
}

function extensionFromUrl(value: string | undefined): string {
  if (!value) return "";
  try {
    return new URL(value, window.location.href).pathname.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() || "";
  } catch {
    return "";
  }
}

