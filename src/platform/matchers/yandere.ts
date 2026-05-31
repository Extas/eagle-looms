import { GalleryMeta } from "../../download/gallery-meta";
import ImageNode from "../../img-node";
import { evLog } from "../../utils/ev-log";
import { ADAPTER } from "../adapt";
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
}

class YandereMatcher extends BaseMatcher<Document> {

  infos: Record<string, YandereKonachanPostInfo> = {};
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
    const matches = raw.matchAll(POST_INFO_REGEX);
    const ret = [];
    for (const match of matches) {
      if (!match || match.length < 2) continue;
      try {
        const info = JSON.parse(match[1]) as YandereKonachanPostInfo;
        this.infos[info.id.toString()] = info;
        this.count++;
        ret.push(new ImageNode(info.preview_url, `${window.location.origin}/post/show/${info.id}`, `${info.id}.${info.file_ext}`, undefined, undefined, { w: info.width, h: info.height }));
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
    return { url };
  }

  galleryMeta(): GalleryMeta {
    const url = new URL(window.location.href);
    const tags = url.searchParams.get("tags")?.trim();
    const meta = new GalleryMeta(window.location.href, `yande_${tags || "post"}_${this.count}`);
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

