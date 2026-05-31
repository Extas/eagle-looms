import { GalleryMeta } from "../../download/gallery-meta";
import ImageNode from "../../img-node";
import { evLog } from "../../utils/ev-log";
import { ADAPTER } from "../adapt";
import { searchGalleryTitle } from "../gallery-title";
import { MoebooruTagTypes, normalizeMoebooruSourceTags, parseMoebooruTagTypes } from "../moebooru-tags";
import { BaseMatcher, OriginMeta, Result } from "../platform";

const POST_INFO_REGEX = /Post\.register\((.*)\)/g;
type YandereKonachanPostInfo = {
  id: number,
  md5: string,
  file_ext?: string,
  file_url: string,
  preview_url: string,
  sample_url: string,
  jpeg_url: string,
  width: number,
  height: number,
  tags?: string,
  created_at?: string | number,
}

class YandereMatcher extends BaseMatcher<Document> {

  infos: Record<string, YandereKonachanPostInfo> = {};
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
    const raw = doc.querySelector("body > form + script")?.textContent;
    if (!raw) throw new Error("cannot find post list from script");
    this.tagTypes = parseMoebooruTagTypes(doc);
    const matches = raw.matchAll(POST_INFO_REGEX);
    const ret = [];
    for (const match of matches) {
      if (!match || match.length < 2) continue;
      try {
        const info = JSON.parse(match[1]) as YandereKonachanPostInfo;
        this.infos[info.id.toString()] = info;
        this.count++;
        const node = new ImageNode(info.preview_url, `${window.location.origin}/post/show/${info.id}`, `${info.id}.${info.file_ext}`, undefined, undefined, { w: info.width, h: info.height });
        node.setTags(...normalizeMoebooruSourceTags(info.tags, this.tagTypes));
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
    const url = new URL(window.location.href);
    const tags = url.searchParams.get("tags")?.trim();
    const meta = new GalleryMeta(window.location.href, searchGalleryTitle("yande.re", tags));
    (meta as any)["infos"] = this.infos;
    return meta;
  }
}
ADAPTER.addSetup({
  name: "yande.re",
  workURLs: [
    /yande.re\/post(?!\/show\/.*)/
  ],
  match: ["https://yande.re/*"],
  constructor: () => new YandereMatcher(),
});

