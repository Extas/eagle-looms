import ImageNode from "../../img-node";
import { isImage, isVideo } from "../../utils/media-helper";
import { batchFetch } from "../../utils/query";
import { ADAPTER } from "../adapt";
import { BaseMatcher, OriginMeta, Result } from "../platform"

interface KemonoList {
  next(): AsyncGenerator<Result<KemonoResult[]>>;
}

// type KemonoProps = {
//   count: number; // 264
//   limit: number; // 50
//   artist: {
//     id: string,
//     name: string,
//     service: string, // patreon
//   }
// }
type KemonoResult = {
  id: string,
  user: string,
  service: string,
  title: string,
  substring: string,
  file?: KemonoFile,
  attachments: KemonoFile[],
  added?: string,
  edited?: string,
  published?: string,
  tags?: unknown,
  artist?: KemonoAuthor,
  creator?: KemonoAuthor,
}

type KemonoFile = {
  name?: string,
  path?: string,
  server?: string,
  type: "thumbnail",
}

type KemonoAuthor = {
  id?: unknown,
  name?: unknown,
  username?: unknown,
  service?: unknown,
}

abstract class KemonoListAbstract implements KemonoList {

  async *next(): AsyncGenerator<Result<KemonoResult[]>> {
    const url = new URL(window.location.href);
    let page = parseInt(url.searchParams.get("o") ?? "0");
    page = isNaN(page) ? 0 : page;
    const query = url.searchParams.get("q");
    while (true) {
      const ret = await window.fetch(this.getURL(page, query), {
        headers: { "Accept": "text/css" }
      }).then(res => res.json()).catch(Error);
      if (ret instanceof Error) {
        yield Result.err(ret);
        continue;
      }
      if (ret.error) {
        yield Result.err(new Error(ret.error));
        continue;
      }
      const results = this.getPosts(ret);
      if (!results || results.length === 0) break;
      page += results.length;
      const infoMap = kemonoInfoPathMap(this.getList(ret));
      if (infoMap.size > 0) {
        results.forEach(r => {
          if (r.file?.path) {
            const info = infoMap.get(r.file.path);
            r.file.name = info?.name;
            r.file.server = info?.server;
          }
          if (r.attachments && r.attachments.length > 0) {
            r.attachments.forEach(a => {
              if (a.path) {
                const info = infoMap.get(a.path);
                a.name = info?.name;
                a.server = info?.server;
              }
            })
          }
        })
      }
      const resultLen = results.length;
      // yield Result.ok(results);
      while (results.length > 0) {
        yield Result.ok(results.splice(0, 10));
      }
      // offset not multiple of 150 or too large
      if (resultLen < 50) break;
    }
  }

  abstract getURL(pages: number, query: string | null): string;
  abstract getList(res: any): any[];
  abstract getPosts(res: any): KemonoResult[];

}

class KemonoListArtist extends KemonoListAbstract {
  getURL(pages: number, query: string | null): string {
    // https://kemono.cr/api/v1/fanbox/user/38401163/posts
    const u = new URL(`${window.location.origin}/api/v1${window.location.pathname}/posts`);
    if (pages > 0) {
      u.searchParams.set("o", pages.toString());
    }
    if (query) {
      u.searchParams.set("q", query);
    }
    return u.href;
  }
  getPosts(res: any): KemonoResult[] {
    return res;
  }
  getList(_response: any): any[] {
    return [];
  }
}
class KemonoListPosts extends KemonoListAbstract {
  getURL(pages: number, query: string | null): string {
    const u = new URL(`${window.location.origin}/api/v1${window.location.pathname}`);
    if (pages > 0) {
      u.searchParams.set("o", pages.toString());
    }
    if (query) {
      u.searchParams.set("q", query);
    }
    return u.href;
  }
  getPosts(res: any): KemonoResult[] {
    return res.posts;
  }
  getList(): any[] {
    return [];
  }
}

class KemonoListSinglePost extends KemonoListAbstract {
  getPosts(res: any): KemonoResult[] {
    if (res?.post) return [res.post];
    return [];
  }
  getURL(): string {
    return `${window.location.origin}/api/v1${window.location.pathname}`;
  }
  getList(response: any): any[] {
    return [...(response.previews ?? []), ...(response.attachments ?? [])];
  }
}

class KemonoMatcher extends BaseMatcher<KemonoResult[]> {
  list?: KemonoList;
  constructor() {
    super();
    if (window.location.href.includes("/posts")) {
      this.list = new KemonoListPosts();
    } else if (/user\/\w+/.test(window.location.href)) {
      if (/post\/\w+/.test(window.location.href)) {
        this.list = new KemonoListSinglePost();
      } else {
        this.list = new KemonoListArtist();
      }
    }
  }
  fetchPagesSource(): AsyncGenerator<Result<KemonoResult[]>> {
    if (!this.list) {
      throw new Error("Current path is not supported");
    }
    return this.list.next();
  }
  async parseImgNodes(results: KemonoResult[]): Promise<ImageNode[]> {
    const nodes = [];
    const newImageNode = (id: string, user: string, service: string, path: string, name: string, server: string) => {
      const thumb = `https://img.kemono.cr/thumbnail/data/${path}`;
      const href = `${window.location.origin}/${service}/user/${user}/post/${id}`;
      let src = server ? `${server}/data/${path}?f=${name}` : undefined;
      const node = new ImageNode(thumb, href, name, undefined, src);
      if (path.indexOf(".mp4") > 1) {
        node.mimeType = "video/mp4";
        node.thumbnailSrc = "";
      }
      // if attachment is not media file, just skip;
      const ext = path.split(".").pop() ?? "";
      if (!isImage(ext)) {
        if (ADAPTER.conf.excludeVideo || !isVideo(ext)) {
          return undefined;
        }
      }
      return node;
    }
    const chunks: { res: KemonoResult, list: KemonoFile[], needFetchPost: boolean }[] = [];
    for (const res of results) {
      const list = [];
      if (res.file?.path) list.push(res.file);
      list.push(...(res.attachments ?? []));
      chunks.push({ res, list, needFetchPost: !list[0]?.server && list.length > 0 });
    }
    await this.batchFetchPathServerMap(chunks);
    // deduplicates
    const originSrcMap = new Map();
    for (const chunk of chunks) {
      for (const file of chunk.list) {
        if (!file.path) continue;
        if (!file.name || !file.server) throw new Error("cannot find image or video name and server");
        const node = newImageNode(chunk.res.id, chunk.res.user, chunk.res.service, file.path, file.name, file.server);
        if (node) {
          if (originSrcMap.has(node.originSrc!)) {
            continue;
          }
          originSrcMap.set(node.originSrc!, true);
          node.setTags(...kemonoSourceTags(chunk.res));
          node.setAuthorUrls(...kemonoAuthorUrls(chunk.res, window.location.origin));
          node.setPublishedAt(kemonoPublishedAt(chunk.res));
          nodes.push(node);
        }
      }
    }
    return nodes;
  }
  async fetchOriginMeta(node: ImageNode): Promise<OriginMeta> {
    if (!node.originSrc) throw new Error("cannot find kemono image file: " + node.href);
    return { url: node.originSrc };
  }
  async batchFetchPathServerMap(chunks: { res: KemonoResult; list: KemonoFile[]; needFetchPost: boolean; }[]) {
    const urls = chunks.filter(chunk => chunk.needFetchPost).map(chunk =>
      new Request(`${window.location.origin}/api/v1/${chunk.res.service}/user/${chunk.res.user}/post/${chunk.res.id}`, {
        headers: { "Accept": "text/css" }
      })
    );
    const infos = await batchFetch<any>(urls, 10, "json");
    const list = infos.reduce((list, info) => {
      return [...list, ...[...(info.previews ?? []), ...(info.attachments ?? [])]];
    }, []);
    const map = kemonoInfoPathMap(list);
    chunks.filter(chunk => chunk.needFetchPost).forEach(chunk => chunk.list.forEach(file => {
      if (file.path) {
        const info = map.get(file.path);
        file.name = info?.name;
        file.server = info?.server;
      }
    }));
  }

}

function kemonoInfoPathMap(list: any[]): Map<string, { name: string, server: string }> {
  const map = new Map();
  for (const info of (list ?? [])) {
    if (info.path && info.server) {
      map.set(info.path, { server: info.server, name: info.name });
    }
  }
  return map;
}

export function kemonoSourceTags(post: Pick<KemonoResult, "service" | "user" | "tags" | "artist" | "creator">): string[] {
  const tags = new Set<string>();
  const author = kemonoAuthorName(post);
  if (author) tags.add(`author:${author}`);
  for (const tag of kemonoTagValues(post.tags)) {
    tags.add(tag);
  }
  return [...tags];
}

export function kemonoAuthorUrls(post: Pick<KemonoResult, "service" | "user" | "artist" | "creator">, origin = "https://kemono.cr"): string[] {
  const service = cleanKemonoValue(stringValue(post.service) || stringValue(post.artist?.service) || stringValue(post.creator?.service));
  const user = cleanKemonoValue(stringValue(post.user) || stringValue(post.artist?.id) || stringValue(post.creator?.id));
  if (!service || !user) return [];
  return [`${origin.replace(/\/+$/, "")}/${encodeURIComponent(service)}/user/${encodeURIComponent(user)}`];
}

export function kemonoPublishedAt(post: Pick<KemonoResult, "published" | "added" | "edited">): string {
  return cleanKemonoValue(post.published || post.added || post.edited || "");
}

function kemonoAuthorName(post: Pick<KemonoResult, "service" | "user" | "artist" | "creator">): string {
  const name = cleanKemonoValue(stringValue(post.artist?.name) || stringValue(post.creator?.name) || stringValue(post.artist?.username) || stringValue(post.creator?.username));
  if (name) return name;
  const service = cleanKemonoValue(stringValue(post.service) || stringValue(post.artist?.service) || stringValue(post.creator?.service));
  const user = cleanKemonoValue(stringValue(post.user) || stringValue(post.artist?.id) || stringValue(post.creator?.id));
  return service && user ? `${service}/${user}` : user;
}

function kemonoTagValues(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(kemonoTagValues);
  }
  if (typeof value === "string" || typeof value === "number") {
    return cleanKemonoValue(String(value)) ? [cleanKemonoValue(String(value))] : [];
  }
  if (!value || typeof value !== "object") return [];
  const object = value as Record<string, unknown>;
  return ["name", "tag", "value", "label", "title"]
    .map(key => cleanKemonoValue(stringValue(object[key])))
    .filter(Boolean);
}

function stringValue(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function cleanKemonoValue(value: string): string {
  return value
    .replace(/[\n\r\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

ADAPTER.addSetup({
  name: "Kemono",
  workURLs: [
    /kemono.cr\/(\w+\/user\/\w+(\/post\/\w+)?|posts)(\?\w=.*)?$/
  ],
  match: ["https://kemono.cr/*"],
  constructor: () => new KemonoMatcher(),
});
