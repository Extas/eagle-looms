import { GalleryMeta } from "../../download/gallery-meta";
import { searchGalleryTitle } from "../../platform/gallery-title";
import { sourceMetadataTag } from "../tags";

export type AnimePicturesCategory = "copyright" | "character" | "author" | "raw" | "";

export function animePicturesCategory(value: string): AnimePicturesCategory | undefined {
  const normalized = normalizeAnimePicturesCategory(value);
  const namespace = animePicturesNamespace(normalized);
  if (namespace) return namespace;
  switch (normalized) {
    case "reference":
    case "object":
    case "general":
    case "meta":
    case "style":
    case "tag":
      return "raw";
    case "tags":
      return "";
    default:
      return undefined;
  }
}

export function animePicturesSourceTag(category: AnimePicturesCategory, name: string): string {
  if (!name) return "";
  return category === "raw" ? name : sourceMetadataTag(category, name);
}

export function animePicturesApiSourceTag(category: unknown, name: string): string {
  const normalized = animePicturesNamespace(String(category || ""));
  return normalized ? sourceMetadataTag(normalized, name) : name;
}

export function animePicturesGalleryMetaFromUrl(href = window.location.href): GalleryMeta {
  const url = new URL(href, window.location.href);
  const searchTag = decodeAnimePicturesSearchTag(url.searchParams.get("search_tag") || "");
  const pageLabel = animePicturesGalleryLabel(url, searchTag);
  const title = searchGalleryTitle("anime-pictures", pageLabel === "posts" || pageLabel === "stars" ? "" : searchTag, pageLabel);
  const meta = new GalleryMeta(href, title);
  meta.downloader = "https://github.com/Extas/eagle-looms";
  meta.tags = {
    search_tag: searchTag ? [searchTag] : [],
    page: [pageLabel],
    site: ["anime-pictures.net"],
  };
  return meta;
}

function animePicturesNamespace(value: string): "copyright" | "character" | "author" | "" {
  switch (normalizeAnimePicturesCategory(value)) {
    case "game copyright":
    case "copyright":
    case "copyrights":
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
    case "character":
    case "characters":
    case "char":
      return "character";
    case "author":
    case "authors":
    case "artist":
    case "artists":
    case "creator":
    case "creators":
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
    case "circle":
    case "circles":
    case "group":
    case "groups":
      return "author";
    default:
      return "";
  }
}

function animePicturesGalleryLabel(url: URL, searchTag: string): string {
  if (url.pathname.match(/\/(?:posts|pictures\/view_post)\/\d+/)) return "posts";
  if (url.pathname.includes("/stars")) return "stars";
  return searchTag || "posts";
}

function decodeAnimePicturesSearchTag(value: string): string {
  return decodeURIComponent(value.replace(/\+/g, " ")).trim();
}

function normalizeAnimePicturesCategory(value: string): string {
  return value
    .replace(/[\n\r\t]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\(\s*s\s*\)/gi, "")
    .replace(/[:：]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
