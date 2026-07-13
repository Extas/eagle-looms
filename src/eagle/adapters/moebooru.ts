import { GalleryMeta } from "../../download/gallery-meta";
import { searchGalleryTitle } from "../../platform/gallery-title";
import { sourceMetadataTag } from "../tags";

const POST_REGISTER_TAGS_RE = /Post\.register_tags\(\s*(\{[\s\S]*?\})\s*\)/g;
const POST_REGISTER_RE = /Post\.register\(\s*(\{[\s\S]*?\})\s*\)/g;

export type MoebooruTagTypes = Record<string, unknown>;
export type MoebooruPostInfo = {
  id: number | string,
  md5?: string,
  file_ext?: string,
  file_url: string,
  preview_url: string,
  sample_url: string,
  jpeg_url?: string,
  width?: number,
  height?: number,
  tags?: string,
  created_at?: string | number,
};

export function parseMoebooruTagTypes(document: Document): MoebooruTagTypes {
  const tagTypes: MoebooruTagTypes = {};
  document.querySelectorAll<HTMLScriptElement>("script").forEach((script) => {
    const text = script.textContent || "";
    for (const match of text.matchAll(POST_REGISTER_TAGS_RE)) {
      try {
        Object.assign(tagTypes, JSON.parse(match[1]) as MoebooruTagTypes);
      } catch {
        // Ignore malformed inline tag maps; raw tags are still imported.
      }
    }
  });
  return tagTypes;
}

export function parseMoebooruPostInfos(document: Document): MoebooruPostInfo[] {
  const infos: MoebooruPostInfo[] = [];
  document.querySelectorAll<HTMLScriptElement>("script").forEach((script) => {
    const text = script.textContent || "";
    for (const match of text.matchAll(POST_REGISTER_RE)) {
      try {
        infos.push(JSON.parse(match[1]) as MoebooruPostInfo);
      } catch {
        // Ignore malformed inline post data; callers can still report no posts.
      }
    }
  });
  return infos;
}

export function normalizeMoebooruSourceTags(rawTags: string | undefined, tagTypes: MoebooruTagTypes): string[] {
  const tags: string[] = [];
  for (const rawTag of splitTags(rawTags)) {
    const namespace = normalizeMoebooruTagType(tagTypes[rawTag]);
    tags.push(namespace ? sourceMetadataTag(namespace, rawTag) : rawTag);
  }
  return [...new Set(tags)];
}

export function moebooruAuthorUrlsFromTags(rawTags: string | undefined, tagTypes: MoebooruTagTypes, baseUrl = window.location.href): string[] {
  const urls = splitTags(rawTags)
    .filter(rawTag => normalizeMoebooruTagType(tagTypes[rawTag]) === "author")
    .map(rawTag => moebooruTagSearchUrl(rawTag, baseUrl))
    .filter(Boolean);
  return [...new Set(urls)];
}

export function moebooruGalleryMetaFromState(site: string, href: string, infos: Record<string, MoebooruPostInfo>, tagTypes: MoebooruTagTypes): GalleryMeta {
  const postId = moebooruPostIdFromUrl(href);
  const title = searchGalleryTitle(site, postId ? undefined : searchTagsFromUrl(href));
  const meta = new GalleryMeta(href, title);
  meta.tags = Object.fromEntries(
    Object.values(infos)
      .filter(info => info.id !== undefined && info.id !== null)
      .map(info => [String(info.id), normalizeMoebooruSourceTags(info.tags, tagTypes)])
      .filter(([, tags]) => tags.length > 0)
  );
  return meta;
}

export function moebooruPostIdFromUrl(href: string): string {
  return href.match(/\/post\/show\/(\d+)/)?.[1] || "";
}

function searchTagsFromUrl(href: string): string | undefined {
  try {
    return new URL(href, window.location.href).searchParams.get("tags")?.trim() || undefined;
  } catch {
    return undefined;
  }
}

function splitTags(value: string | undefined): string[] {
  return (value || "")
    .split(/\s+/)
    .map(tag => tag.trim())
    .filter(Boolean);
}

function normalizeMoebooruTagType(value: unknown): "copyright" | "character" | "author" | "" {
  const raw = typeof value === "number"
    ? String(value)
    : typeof value === "string"
      ? value.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().toLowerCase()
      : "";
  switch (raw) {
    case "1":
    case "artist":
    case "artists":
    case "author":
    case "authors":
    case "circle":
    case "circles":
    case "creator":
    case "creators":
    case "group":
    case "groups":
    case "illustrator":
    case "illustrators":
    case "writer":
    case "writers":
    case "translator":
    case "translators":
    case "editor":
    case "editors":
    case "colorist":
    case "colorists":
    case "letterer":
    case "letterers":
    case "mangaka":
      return "author";
    case "3":
    case "copyright":
    case "copyrights":
    case "game copyright":
    case "other copyright":
    case "parody":
    case "parodies":
    case "parodys":
    case "series":
    case "work":
    case "works":
    case "work title":
    case "source work":
    case "original":
    case "original work":
    case "franchise":
    case "franchises":
    case "ip":
    case "property":
    case "properties":
      return "copyright";
    case "4":
    case "character":
    case "characters":
    case "char":
      return "character";
    default:
      return "";
  }
}

function moebooruTagSearchUrl(tag: string, baseUrl: string): string {
  try {
    const url = new URL("/post", baseUrl);
    url.searchParams.set("tags", tag);
    return url.href;
  } catch {
    return "";
  }
}
