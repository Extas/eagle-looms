import { GalleryMeta } from "../../download/gallery-meta";
import ImageNode from "../../img-node";
import { ADAPTER } from "../adapt";
import { BaseMatcher, OriginMeta, Result } from "../platform";
import { AnimePicturesImageCandidate, animePicturesApiDetailUrl, diagnoseAnimePicturesDocument, collectAnimePicturesImageCandidates, extractAnimePicturesSourceMetadata, isAnimePicturesChallengeHtml, parseAnimePicturesApiDetail, parseAnimePicturesPostEntries, selectAnimePicturesImageCandidate } from "../anime-pictures";

const POST_RE = /\/(?:posts|pictures\/view_post)\/(\d+)/;

class AnimePicturesMatcher extends BaseMatcher<Document> {
  count = 0;
  private failedImageCandidates = new Map<string, Set<string>>();

  async *fetchPagesSource(): AsyncGenerator<Result<Document>> {
    let page = pageNumberFromUrl(window.location.href);
    let doc = document;
    let yieldedPosts = 0;
    const maxItems = Math.max(1, ADAPTER.conf.eagleImportLimit || 100);
    const singlePostPage = isSinglePostPage(window.location.href);

    while (yieldedPosts < maxItems) {
      const diagnostics = diagnoseAnimePicturesDocument(doc, pageUrlFor(window.location.href, page));
      if (diagnostics.challengeDetected) {
        yield Result.err(new Error(`anime-pictures returned a challenge page: ${diagnostics.challengeSignals.join(",")}`));
        break;
      }
      const postCount = parseAnimePicturesPostEntries(doc, pageUrlFor(window.location.href, page)).length;
      if (postCount === 0) break;
      yield Result.ok(doc);
      if (singlePostPage) break;
      yieldedPosts += postCount;
      page += 1;
      if (yieldedPosts >= maxItems) break;
      try {
        doc = await fetchDocument(pageUrlFor(window.location.href, page));
      } catch (error) {
        yield Result.err(new Error(`fetch anime-pictures page ${page} failed: ${error}`));
        break;
      }
    }
  }

  async parseImgNodes(doc: Document): Promise<ImageNode[]> {
    const maxItems = Math.max(1, ADAPTER.conf.eagleImportLimit || 100);
    const remaining = maxItems - this.count;
    const entries = parseAnimePicturesPostEntries(doc, window.location.href, remaining);
    this.count += entries.length;
    return entries.map((entry) => {
      const title = `anime-pictures-${entry.id}.${extensionFromUrl(entry.thumbnailUrl || "") || "jpg"}`;
      const node = new ImageNode(entry.thumbnailUrl || "", entry.postUrl, title, undefined, undefined, entry.width && entry.height ? { w: entry.width, h: entry.height } : undefined);
      node.setTags("site:anime-pictures.net", `post:${entry.id}`);
      return node;
    });
  }

  async fetchOriginMeta(node: ImageNode, retry: boolean): Promise<OriginMeta> {
    const candidates: AnimePicturesImageCandidate[] = [];
    let detailError: unknown;
    try {
      const html = await fetch(withLang(node.href), { credentials: "include" }).then(res => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.text();
      });
      const doc = new DOMParser().parseFromString(html, "text/html");
      const diagnostics = diagnoseAnimePicturesDocument(doc, node.href);
      if (diagnostics.challengeDetected) {
        throw new Error(`anime-pictures returned a challenge page: ${diagnostics.challengeSignals.join(",")}`);
      }
      const sourceMetadata = extractAnimePicturesSourceMetadata(doc, node.href);
      node.setTags(...sourceMetadata.tags);
      node.setAuthorUrls(...sourceMetadata.authorUrls);
      candidates.push(...collectAnimePicturesImageCandidates(doc, html, node.href));
    } catch (error) {
      detailError = error;
    }

    const id = node.href.match(POST_RE)?.[1] || "";
    const apiDetail = id ? await fetchApiDetail(id, node.href) : undefined;
    if (apiDetail) {
      node.setTags(...apiDetail.tags);
      if (apiDetail.fileUrl) {
        candidates.push({ url: apiDetail.fileUrl, score: 110 });
      }
    }

    const triedUrls = this.failedCandidatesFor(node);
    if (retry && node.originSrc) triedUrls.add(node.originSrc);
    const candidate = selectAnimePicturesImageCandidate(candidates, triedUrls);
    const url = candidate?.url;
    if (!url) {
      if (detailError) throw detailError;
      throw new Error(`cannot find original image url from ${node.href}`);
    }
    const ext = extensionFromUrl(url) || extensionFromUrl(node.title) || "jpg";
    return {
      url,
      title: `anime-pictures-${id || "image"}.${ext}`,
      href: node.href,
    };
  }

  async processData(data: Uint8Array<ArrayBuffer>, contentType: string, node: ImageNode): Promise<[Uint8Array<ArrayBuffer>, string]> {
    if (contentType.toLowerCase().startsWith("text/html")) {
      const html = new TextDecoder().decode(data.slice(0, 256 * 1024));
      if (isAnimePicturesChallengeHtml(html, node.originSrc || node.href)) {
        throw new Error("anime-pictures image host returned a Cloudflare challenge page; retrying another image URL candidate.");
      }
    }
    return [data, contentType];
  }

  headers(node: ImageNode): Record<string, string> {
    return {
      Referer: node.href || window.location.href,
      "Cache-Control": "public, max-age=2592000, immutable",
    };
  }

  galleryMeta(): GalleryMeta {
    const url = new URL(window.location.href);
    const searchTag = decodeSearchTag(url.searchParams.get("search_tag") || "");
    const pageLabel = galleryLabel(url, searchTag);
    const title = `anime-pictures_${pageLabel}_${Math.min(this.count || ADAPTER.conf.eagleImportLimit, ADAPTER.conf.eagleImportLimit)}`;
    const meta = new GalleryMeta(window.location.href, title);
    meta.downloader = "https://github.com/Extas/eagle-looms";
    meta.tags = {
      search_tag: searchTag ? [searchTag] : [],
      page: [pageLabel],
      site: ["anime-pictures.net"],
    };
    return meta;
  }

  private failedCandidatesFor(node: ImageNode): Set<string> {
    const key = node.href;
    let tried = this.failedImageCandidates.get(key);
    if (!tried) {
      tried = new Set<string>();
      this.failedImageCandidates.set(key, tried);
    }
    return tried;
  }
}

ADAPTER.addSetup({
  name: "anime-pictures.net",
  workURLs: [
    /anime-pictures\.net\/posts(?:\?|$)/,
    /anime-pictures\.net\/posts\/\d+/,
    /anime-pictures\.net\/pictures\/view_posts/,
    /anime-pictures\.net\/pictures\/view_post\/\d+/,
    /anime-pictures\.net\/stars(?:\?|$)/,
  ],
  match: ["https://anime-pictures.net/posts*", "https://anime-pictures.net/pictures/view_post*", "https://anime-pictures.net/pictures/view_posts*", "https://anime-pictures.net/stars*"],
  constructor: () => new AnimePicturesMatcher(),
});

async function fetchDocument(url: string): Promise<Document> {
  const html = await fetch(url, { credentials: "include" }).then(res => {
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.text();
  });
  return new DOMParser().parseFromString(html, "text/html");
}

function pageUrlFor(baseUrl: string, page: number): string {
  const parsed = new URL(baseUrl);
  parsed.searchParams.set("page", String(page));
  return parsed.toString();
}

function pageNumberFromUrl(url: string): number {
  try {
    return Number(new URL(url).searchParams.get("page") || "0");
  } catch {
    return 0;
  }
}

function isSinglePostPage(url: string): boolean {
  try {
    return /\/(?:posts|pictures\/view_post)\/\d+/.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

function galleryLabel(url: URL, searchTag: string): string {
  const postId = url.pathname.match(POST_RE)?.[1];
  if (postId) return `post_${postId}`;
  if (url.pathname.includes("/stars")) return "stars";
  return searchTag || "posts";
}

function withLang(url: string): string {
  const parsed = new URL(url);
  parsed.searchParams.set("lang", "en");
  return parsed.toString();
}

async function fetchApiDetail(id: string, pageUrl: string) {
  try {
    const data = await fetch(animePicturesApiDetailUrl(id), { credentials: "include" }).then(res => {
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return res.json();
    });
    return parseAnimePicturesApiDetail(data, pageUrl);
  } catch {
    return undefined;
  }
}

function extensionFromUrl(url: string): string {
  try {
    const match = new URL(url, window.location.href).pathname.match(/\.([a-z0-9]+)$/i);
    return match?.[1]?.toLowerCase() || "";
  } catch {
    return "";
  }
}

function decodeSearchTag(value: string): string {
  return decodeURIComponent(value.replace(/\+/g, " ")).trim();
}
