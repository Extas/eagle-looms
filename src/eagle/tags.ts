import type { GalleryMeta } from "../download/gallery-meta";

export function normalizeEagleTags(required: string[], source: string[], maxSourceTags: number): string[] {
  const tags = new Set<string>();
  required.map(cleanTag).filter(Boolean).forEach(tag => tags.add(tag));
  const limit = Number.isFinite(maxSourceTags) ? Math.max(0, Math.floor(maxSourceTags)) : 0;
  let added = 0;
  for (const tag of prioritizedSourceTags(source)) {
    if (added >= limit) break;
    if (!tag || tags.has(tag)) continue;
    tags.add(tag);
    added += 1;
  }
  return [...tags];
}

export function normalizeEagleItemTags(source: string[], maxSourceTags: number): string[] {
  return normalizeEagleTags([], semanticSourceTags(source), maxSourceTags);
}

export function semanticSourceTags(tags: string[]): string[] {
  return tags.filter(tag => !isInfrastructureTag(tag));
}

export function sourceMetadataTag(category: string, value: string): string {
  const namespace = normalizeSourceNamespace(category);
  const tagValue = cleanSourceTagValue(value);
  return namespace && tagValue ? `${namespace}:${tagValue}` : "";
}

export function sourceTagsFromGalleryMeta(meta: GalleryMeta, sourceUrl: string): string[] {
  const tags: string[] = [];
  const postId = postIdFromSourceUrl(sourceUrl);
  const metadata = meta.tags || {};

  for (const [category, rawValues] of Object.entries(metadata)) {
    const values = normalizeMetaValues(rawValues);
    if (values.length === 0) continue;

    if (metadataBucketMatchesPostId(category, postId)) {
      tags.push(...sourceTagsFromPostMetadata(rawValues));
      continue;
    }

    const namespace = normalizeSourceNamespace(category);
    if (namespace) {
      values.forEach(value => tags.push(`${namespace}:${value}`));
      continue;
    }

    if (isRawSourceTagCategory(category)) {
      tags.push(...values);
    }
  }

  return [...new Set(tags)];
}

export function normalizeSourceMetadataTag(value: string): string {
  const index = value.search(/[:：]/);
  if (index < 0) return "";
  return sourceMetadataTag(value.slice(0, index), value.slice(index + 1));
}

export function eagleExtensionTag(...sources: Array<string | undefined>): string {
  for (const source of sources) {
    const ext = extensionFromSource(source);
    if (ext) return `ext:${ext}`;
  }
  return "";
}

function prioritizedSourceTags(source: string[]): string[] {
  return source
    .map((rawTag, index) => ({
      tag: normalizeSourceMetadataTag(rawTag) || cleanSourceTagValue(rawTag),
      index,
    }))
    .filter(({ tag }) => Boolean(tag))
    .sort((a, b) => sourceTagPriority(a.tag) - sourceTagPriority(b.tag) || a.index - b.index)
    .map(({ tag }) => tag);
}

function sourceTagPriority(tag: string): number {
  if (tag.startsWith("copyright:")) return 0;
  if (tag.startsWith("character:")) return 1;
  if (tag.startsWith("author:")) return 2;
  return 3;
}

function isInfrastructureTag(tag: string): boolean {
  const trimmed = tag.trim().toLowerCase();
  const prefix = trimmed.split(":", 1)[0];
  return trimmed === "eagle-looms" || ["site", "gallery", "chapter", "ext", "mime", "post"].includes(prefix);
}

function cleanTag(value: string): string {
  return value
    .replace(/[\n\r\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function cleanSourceTagValue(value: string): string {
  return cleanTag(value)
    .replace(/\s*[\[(]\s*[+-]?\d[\d,]*(?:\.\d+)?[kKmM]?\s*[\])]$/, "")
    .replace(/\s+(?:[+-]?\d[\d,]*(?:\.\d+)?[kKmM]?|[+-]\d+)$/, "")
    .trim();
}

function normalizeSourceNamespace(category: string): "copyright" | "character" | "author" | "" {
  const normalized = normalizeSourceCategoryKey(category);
  switch (normalized) {
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
    case "作品":
    case "原作":
    case "系列":
      return "copyright";
    case "4":
    case "character":
    case "characters":
    case "char":
    case "角色":
    case "人物":
      return "character";
    case "1":
    case "author":
    case "authors":
    case "artist":
    case "artists":
    case "creator":
    case "creators":
    case "circle":
    case "circles":
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
    case "作者":
    case "作家":
    case "艺术家":
    case "藝術家":
    case "画师":
    case "畫師":
    case "社团":
    case "社團":
    case "团体":
    case "團體":
      return "author";
    default:
      return "";
  }
}

function normalizeMetaValues(value: unknown): string[] {
  const rawValues = Array.isArray(value) ? value : [value];
  return rawValues
    .flatMap(value => metaValueTexts(value))
    .flatMap(splitMaybeDelimitedTags)
    .map(cleanSourceTagValue)
    .filter(Boolean);
}

function sourceTagsFromPostMetadata(value: unknown): string[] {
  const rawValues = Array.isArray(value) ? value : [value];
  return rawValues
    .flatMap(value => postMetadataValueTags(value))
    .filter(Boolean);
}

function postMetadataValueTags(value: unknown): string[] {
  if (typeof value === "string") {
    const tag = normalizeSourceMetadataTag(value) || cleanSourceTagValue(value);
    return tag ? [tag] : [];
  }
  if (Array.isArray(value)) return value.flatMap(postMetadataValueTags);
  if (!value || typeof value !== "object") return [];

  const object = value as Record<string, unknown>;
  const category = metaValueCategory(object);
  const values = normalizeMetaValues(value);
  if (category && values.length) {
    const namespace = normalizeSourceNamespace(category);
    if (namespace) return values.map(value => `${namespace}:${value}`);
    if (isRawSourceTagCategory(category)) return values;
  }

  return values.map(value => normalizeSourceMetadataTag(value) || value);
}

function metaValueTexts(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(metaValueTexts);
  if (!value || typeof value !== "object") return [];
  const object = value as Record<string, unknown>;
  for (const key of ["name", "tag", "tag_en", "tagName", "tag_name", "value", "label", "title", "displayName", "display_name", "nameEn", "name_en", "translatedName", "translated_name"]) {
    const candidate = object[key];
    if (typeof candidate === "string" && candidate.trim()) return [candidate];
  }
  for (const key of ["translation", "translations", "translated", "localized", "localization", "i18n"]) {
    const values = localizedMetaValueTexts(object[key]);
    if (values.length) return values;
  }
  for (const key of ["tag", "tags", "values", "items"]) {
    const candidate = object[key];
    if (candidate && typeof candidate === "object") {
      const values = metaValueTexts(candidate);
      if (values.length) return values;
    }
  }
  return [];
}

function localizedMetaValueTexts(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (!value || typeof value !== "object") return [];
  const object = value as Record<string, unknown>;
  return ["en", "english", "name", "text", "value", "label", "title"]
    .map(key => object[key])
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0);
}

function metaValueCategory(object: Record<string, unknown>): string {
  for (const key of ["type", "category", "tagType", "tag_type", "namespace", "kind"]) {
    const candidate = object[key];
    if (typeof candidate === "string" || typeof candidate === "number") {
      const value = String(candidate).trim();
      if (value) return value;
    }
  }
  const nested = object.tag;
  if (nested && typeof nested === "object") {
    return metaValueCategory(nested as Record<string, unknown>);
  }
  return "";
}

function splitMaybeDelimitedTags(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) return [];
  if (trimmed.includes("|")) return trimmed.split("|");
  if (trimmed.includes(",")) return trimmed.split(",");
  return [trimmed];
}

function isRawSourceTagCategory(category: string): boolean {
  switch (normalizeSourceCategoryKey(category)) {
    case "0":
    case "5":
    case "tag":
    case "tags":
    case "general":
    case "female":
    case "female tag":
    case "female tags":
    case "female_tags":
    case "flag":
    case "genre":
    case "genres":
    case "category":
    case "categories":
    case "album type":
    case "albumtype":
    case "type":
    case "types":
    case "language":
    case "languages":
    case "标签":
    case "標籤":
    case "分类":
    case "分類":
    case "类别":
    case "類別":
    case "语言":
    case "語言":
    case "类型":
    case "類型":
    case "其他":
    case "其它":
    case "杂项":
    case "雜項":
    case "male":
    case "male tag":
    case "male tags":
    case "male_tags":
    case "mixed":
    case "other":
    case "misc":
    case "cosplayer":
    case "uploader":
    case "uploaders":
    case "meta":
      return true;
    default:
      return false;
  }
}

function normalizeSourceCategoryKey(category: string): string {
  return cleanTag(category)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\(\s*s\s*\)/gi, "")
    .replace(/[:：]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function postIdFromSourceUrl(sourceUrl: string): string {
  return sourceUrl.match(/(?:artworks|posts|post\/show|view_post)\/(\d+)/)?.[1]
    || sourceUrl.match(/[?&]id=(\d+)/)?.[1]
    || "";
}

function metadataBucketMatchesPostId(category: string, postId: string): boolean {
  if (!postId) return false;
  const normalized = normalizeSourceCategoryKey(category).replace(/[:：#]+/g, " ");
  if (normalized === postId) return true;
  const match = normalized.match(/^(?:post|id|pid|artwork|artworks|illust|illust id)\s*(\d+)$/);
  return match?.[1] === postId;
}

function extensionFromSource(source: string | undefined): string {
  if (!source) return "";
  const fromQuery = source.match(/[?&](?:format|ext)=([a-z0-9]{2,8})\b/i)?.[1];
  const fromPath = source.match(/\.([a-z0-9]{2,8})(?:[?#].*)?$/i)?.[1];
  const ext = (fromQuery || fromPath || "").toLowerCase();
  return ext.replace(/[^a-z0-9]/g, "");
}
