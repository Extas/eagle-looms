import { GalleryMeta } from "../../download/gallery-meta";
import ImageNode from "../../img-node";
import { ADAPTER } from "../adapt";
import { BaseMatcher, OriginMeta, Result } from "../platform";

const STEAM_THUMB_IMG_URL_REGEX = /background-image:\surl\(.*?(h.*\/).*?\)/;
class SteamMatcher extends BaseMatcher<string> {
  async fetchOriginMeta(node: ImageNode): Promise<OriginMeta> {
    let raw = "";
    try {
      raw = await window.fetch(node.href).then(resp => resp.text());
      if (!raw) throw new Error("[text] is empty");
    } catch (error) {
      throw new Error(`Fetch source page error, expected [text]！ ${error}`);
    }
    const domParser = new DOMParser();
    const doc = domParser.parseFromString(raw, "text/html");
    const imgURL = doc.querySelector(".actualmediactn > a")?.getAttribute("href");
    if (!imgURL) {
      throw new Error("Cannot Query Steam original Image URL");
    }
    return { url: imgURL };
  }

  async parseImgNodes(source: string): Promise<ImageNode[] | never> {
    const list: ImageNode[] = [];
    const doc = await window.fetch(source).then((resp) => resp.text()).then(raw => new DOMParser().parseFromString(raw, "text/html"));
    if (!doc) {
      throw new Error("warn: steam matcher failed to get document from source page!")
    }
    const nodes = doc.querySelectorAll(".profile_media_item");
    if (!nodes || nodes.length == 0) {
      throw new Error("warn: failed query image nodes!")
    }
    for (const node of Array.from(nodes)) {
      const src = STEAM_THUMB_IMG_URL_REGEX.exec(node.innerHTML)?.[1];
      if (!src) {
        throw new Error(`Cannot Match Steam Image URL, Content: ${node.innerHTML}`);
      }
      const newNode = new ImageNode(
        src,
        node.getAttribute("href")!,
        node.getAttribute("data-publishedfileid")! + ".jpg",
      );
      list.push(newNode);
    }
    return list;
  }

  async *fetchPagesSource(): AsyncGenerator<Result<string>> {
    let totalPages = -1;
    document.querySelectorAll(".pagingPageLink").forEach(ele => {
      totalPages = Number(ele.textContent);
    });
    const url = new URL(window.location.href);
    url.searchParams.set("view", "grid");
    if (totalPages === -1) {
      const doc = await window.fetch(url.href).then((response) => response.text()).then((text) => new DOMParser().parseFromString(text, "text/html")).catch(() => null);
      if (!doc) {
        throw new Error("warn: steam matcher failed to get document from source page!")
      }
      doc.querySelectorAll(".pagingPageLink").forEach(ele => totalPages = Number(ele.textContent));
    }
    if (totalPages > 0) {
      for (let p = 1; p <= totalPages; p++) {
        url.searchParams.set("p", p.toString());
        yield Result.ok(url.href);
      }
    } else {
      yield Result.ok(url.href);
    }
  }

  galleryMeta(): GalleryMeta {
    return steamGalleryMetaFromUrl(window.location.href, document.title);
  }

}

export function steamGalleryMetaFromUrl(href: string, fallbackTitle = "steam"): GalleryMeta {
  const meta = new GalleryMeta(href, steamGalleryTitleFromUrl(href, fallbackTitle));
  const author = steamProfileIdentityFromUrl(href);
  if (author) {
    meta.tags.author = [author];
    meta.authorUrls = [steamAuthorUrlFromUrl(href)];
  }
  return meta;
}

export function steamGalleryTitleFromUrl(href: string, fallbackTitle = "steam"): string {
  const url = new URL(href, "https://steamcommunity.com");
  const appid = cleanSteamValue(url.searchParams.get("appid"));
  if (appid) return `steam-${appid}`;
  return `steam-${cleanSteamValue(fallbackTitle) || "screenshots"}`;
}

export function steamProfileIdentityFromUrl(href: string): string {
  const url = new URL(href, "https://steamcommunity.com");
  const match = url.pathname.match(/^\/(?:id|profiles)\/([^/]+)/i);
  return cleanSteamValue(match?.[1]);
}

export function steamAuthorUrlFromUrl(href: string): string {
  const url = new URL(href, "https://steamcommunity.com");
  const match = url.pathname.match(/^(\/(?:id|profiles)\/[^/]+)/i);
  return match ? `${url.origin}${match[1]}` : "";
}

function cleanSteamValue(value: unknown): string {
  if (typeof value !== "string" && typeof value !== "number") return "";
  return String(value)
    .replace(/[\n\r\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

ADAPTER.addSetup({
  name: "Steam Screenshots",
  workURLs: [
    /steamcommunity.com\/(?:id|profiles)\/[^/]+\/screenshots.*/
  ],
  match: ["https://steamcommunity.com/*"],
  constructor: () => new SteamMatcher(),
});
