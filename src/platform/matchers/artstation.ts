import { GalleryMeta } from "../../download/gallery-meta";
import EBUS from "../../event-bus";
import ImageNode from "../../img-node";
import { evLog } from "../../utils/ev-log";
import { batchFetch } from "../../utils/query";
import { ADAPTER } from "../adapt";
import { artStationAuthorTag, artStationAuthorUrl, normalizeArtStationTags } from "../../eagle/adapters/artstation";
import { galleryTitle } from "../gallery-title";
import { BaseMatcher, OriginMeta, Result } from "../platform";

class ArtStationMatcher extends BaseMatcher<ArtStationProject[]> {
  pageData: Map<string, ArtStationProject[]> = new Map();
  info: { username: string, fullName: string, permalink: string, projects: number, assets: number } = { username: "", fullName: "", permalink: "", projects: 0, assets: 0 };
  tags: Record<string, string[]> = {};
  galleryMeta(): GalleryMeta {
    const meta = new GalleryMeta(window.location.href, galleryTitle(["artstation", this.info.username || document.title]));
    meta.tags = {
      author: [this.info.username || this.info.fullName].filter(Boolean),
      ...this.tags,
    };
    return meta;
  }
  async *fetchPagesSource(): AsyncGenerator<Result<ArtStationProject[]>> {
    // find artist id;
    const { id, username, full_name, permalink } = await this.fetchArtistInfo();
    this.info.username = username;
    this.info.fullName = full_name;
    this.info.permalink = permalink;
    let page = 0;
    while (true) {
      page++;
      try {
        const projects = await this.fetchProjects(username, id.toString(), page);
        if (!projects || projects.length === 0) break;
        yield Result.ok(projects);
      } catch (error) {
        page--;
        yield Result.err(error as Error);
      }
    }
  }
  async parseImgNodes(projects: ArtStationProject[]): Promise<ImageNode[]> {
    const projectURLs = projects.map(p => `https://www.artstation.com/projects/${p.hash_id}.json`)
    const assets = await batchFetch<ArtStationAsset>(projectURLs, 10, "json");
    const ret: ImageNode[] = [];
    for (const asset of assets) {
      if (asset instanceof Error) {
        evLog("error", asset.message);
        EBUS.emit("notify-message", "error", asset.message, 8000);
        continue;
      }
      this.info.projects++;
      const sourceTags = [
        artStationAuthorTag({ username: this.info.username, full_name: this.info.fullName }),
        ...normalizeArtStationTags(asset.tags),
      ].filter(Boolean);
      this.tags[asset.slug] = sourceTags;
      for (let i = 0; i < asset.assets.length; i++) {
        const a = asset.assets[i];
        if (a.asset_type === "cover") continue;
        const thumb = a.image_url.replace("/large/", "/small/");
        const ext = a.image_url.match(/\.(\w+)\?\d+$/)?.[1] ?? "jpg";
        const title = `${asset.slug}-${i + 1}.${ext}`;
        let originSrc = a.image_url;
        if (a.has_embedded_player && a.player_embedded) {
          if (a.player_embedded.includes("youtube")) continue; // skip youtube embedded
          originSrc = a.player_embedded;
        }
        this.info.assets++;
        const node = new ImageNode(thumb, asset.permalink, title, undefined, originSrc, { w: a.width, h: a.height });
        node.setTags(...sourceTags);
        node.setAuthorUrls(artStationAuthorUrl({ username: this.info.username, permalink: this.info.permalink }));
        node.setPublishedAt(asset.published_at || asset.updated_at);
        ret.push(node);
      }
    }
    return ret;
  }
  async fetchOriginMeta(node: ImageNode): Promise<OriginMeta> {
    if (node.originSrc?.startsWith("<iframe")) {
      const iframe = node.originSrc.match(/src=['"](.*?)['"]\s/)?.[1];
      if (!iframe) throw new Error("cannot match video clip url");
      const doc = await window.fetch(iframe).then(res => res.text()).then(text => new DOMParser().parseFromString(text, "text/html"));
      const source = doc.querySelector<HTMLSourceElement>("video > source");
      if (!source) throw new Error("cannot find video element");
      return { url: source.src };
    }
    return { url: node.originSrc! };
  }
  async processData(data: Uint8Array<ArrayBuffer>, contentType: string): Promise<[Uint8Array<ArrayBuffer>, string]> {
    if (contentType.startsWith("binary") || contentType.startsWith("text")) {
      return [data, "video/mp4"];
    }
    return [data, contentType];
  }
  async fetchArtistInfo(): Promise<ArtStationArtistInfo> {
    const user = window.location.pathname.slice(1).split("/").shift();
    if (!user) throw new Error("cannot match artist's username");
    const info = await window.fetch(`https://www.artstation.com/users/${user}/quick.json`).then(res => res.json()) as ArtStationArtistInfo;
    return info;
  }
  async fetchProjects(user: string, id: string, page: number): Promise<ArtStationProject[]> {
    const url = `https://www.artstation.com/users/${user}/projects.json?user_id=${id}&page=${page}`;
    const project = await window.fetch(url).then(res => res.json()) as { data: ArtStationProject[], total_count: number };
    return project.data;
  }

}

type ArtStationArtistInfo = {
  id: number,
  full_name: string,
  username: string,
  permalink: string,
}

type ArtStationProject = {
  id: number,
  assets_count: number,
  title: string,
  description: string,
  slug: string, // title
  hash_id: string,
  permalink: string, // href
  cover: {
    id: number,
    small_square_url: string,
    micro_square_image_url: string,
    thumb_url: string
  },
}

type ArtStationAsset = {
  tags: string[],
  assets: {
    has_image: boolean,
    has_embedded_player: boolean,
    // "player_embedded": "<iframe src='https://www.artstation.com/api/v2/animation/video_clips/05283c5d-c7d9-496a-8906-73adabcbe407/embed.html?s=1ca70087a5cf3cb220bb3dc9a4818e63b88c741eeb9bfb89d1caac2832e7a353&t=1725866441' width='1920' height='2560' frameborder='0' allowfullscreen allows='autoplay; fullscreen' style='max-width: 1920px; max-height: 2560px;'></iframe>",
    player_embedded?: string,
    image_url: string,
    width: number,
    height: number,
    position: number, // 0
    asset_type: "image" | "cover" | "video_clip",

  }[],
  id: 19031208,
  cover_url: string,
  permalink: string,
  slug: string,
  published_at?: string,
  updated_at?: string,
}
ADAPTER.addSetup({
  name: "Art Station",
  workURLs: [
    /artstation.com\/[-\w]+(\/albums\/\d+)?$/
  ],
  match: ["https://www.artstation.com/*"],
  constructor: () => new ArtStationMatcher(),
});
