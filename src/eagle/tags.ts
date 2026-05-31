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

    if (postId && category === postId) {
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
  const index = value.indexOf(":");
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
  const normalized = cleanTag(category).toLowerCase();
  switch (normalized) {
    case "copyright":
    case "copyrights":
    case "game copyright":
    case "other copyright":
    case "parody":
    case "parodies":
    case "series":
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
    case "circle":
    case "group":
    case "groups":
      return "author";
    default:
      return "";
  }
}

function normalizeMetaValues(value: unknown): string[] {
  const rawValues = Array.isArray(value) ? value : [value];
  return rawValues
    .flatMap(value => typeof value === "string" ? splitMaybeDelimitedTags(value) : [])
    .map(cleanSourceTagValue)
    .filter(Boolean);
}

function splitMaybeDelimitedTags(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) return [];
  if (trimmed.includes("|")) return trimmed.split("|");
  if (trimmed.includes(",")) return trimmed.split(",");
  return [trimmed];
}

function isRawSourceTagCategory(category: string): boolean {
  switch (cleanTag(category).toLowerCase()) {
    case "tag":
    case "tags":
    case "general":
    case "female":
    case "male":
    case "mixed":
    case "other":
    case "cosplayer":
    case "meta":
      return true;
    default:
      return false;
  }
}

function postIdFromSourceUrl(sourceUrl: string): string {
  return sourceUrl.match(/(?:artworks|posts|post\/show|view_post)\/(\d+)/)?.[1]
    || sourceUrl.match(/[?&]id=(\d+)/)?.[1]
    || "";
}

function extensionFromSource(source: string | undefined): string {
  if (!source) return "";
  const fromQuery = source.match(/[?&](?:format|ext)=([a-z0-9]{2,8})\b/i)?.[1];
  const fromPath = source.match(/\.([a-z0-9]{2,8})(?:[?#].*)?$/i)?.[1];
  const ext = (fromQuery || fromPath || "").toLowerCase();
  return ext.replace(/[^a-z0-9]/g, "");
}
