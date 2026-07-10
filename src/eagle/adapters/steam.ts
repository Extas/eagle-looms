import { GalleryMeta } from "../../download/gallery-meta";
import { cleanSourceTag } from "./source-tags";

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
  return cleanSourceTag(value);
}
