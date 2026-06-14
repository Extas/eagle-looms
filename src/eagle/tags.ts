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
      tags.push(...values);
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
      tag: normalizeSourceMetadataTag(rawTag) || cleanTag(rawTag),
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
    .replace(/\s+(?:[+-]?\d+(?:\.\d+)?[kKmM]?|[+-]\d+)$/, "")
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

function metaValueTexts(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(metaValueTexts);
  if (!value || typeof value !== "object") return [];
  const object = value as Record<string, unknown>;
  for (const key of ["name", "tag", "value", "label", "title"]) {
    const candidate = object[key];
    if (typeof candidate === "string" && candidate.trim()) return [candidate];
  }
  for (const key of ["tags", "values", "items"]) {
    const candidate = object[key];
    if (Array.isArray(candidate)) return candidate.flatMap(metaValueTexts);
  }
  return [];
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
