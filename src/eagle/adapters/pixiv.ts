import { GalleryMeta } from "../../download/gallery-meta";
import { datedGalleryTitle, galleryTitle } from "../../platform/gallery-title";
import { pixivAuthorLabel, pixivAuthorUrl } from "../../platform/pixiv-tags";
import { sourceMetadataTag } from "../tags";

const PIXIV_TIMEZONE_OFFSET_MS = 9 * 60 * 60 * 1000;

export type PixivEagleWorkMetadata = {
  title?: unknown;
  tags?: string[];
  userId?: unknown;
  userName?: unknown;
  userAccount?: unknown;
};

export function pixivEagleSourceTags(work: PixivEagleWorkMetadata | undefined, fallbackUserId?: unknown): string[] {
  return [
    pixivEagleAuthorTag(work, fallbackUserId),
    ...(work?.tags || []),
  ].filter(Boolean);
}

export function pixivEagleAuthorTag(work: PixivEagleWorkMetadata | undefined, fallbackUserId?: unknown): string {
  return sourceMetadataTag("author", pixivAuthorLabel(work, fallbackUserId));
}

export function pixivEagleAuthorUrl(work: PixivEagleWorkMetadata | undefined, fallbackUserId?: unknown): string {
  return pixivAuthorUrl(work, fallbackUserId);
}

export function pixivEagleItemTitle(work: PixivEagleWorkMetadata | undefined, sourceFileName: string): string {
  const author = pixivAuthorLabel(work).slice(0, 40);
  const artwork = cleanDisplayPart(work?.title).slice(0, 80);
  return uniqueDisplayParts([author, artwork, sourceFileName]).join(" - ") || sourceFileName;
}

export function pixivEaglePublishedAt(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const timestamp = Date.parse(raw);
  if (!Number.isFinite(timestamp)) return raw;
  const japanTime = new Date(timestamp + PIXIV_TIMEZONE_OFFSET_MS).toISOString();
  return `${japanTime.slice(0, 19)}+09:00`;
}

export function pixivEagleArtworkMetadataBuckets(works: Record<string, PixivEagleWorkMetadata>): Record<string, string[]> {
  return Object.entries(works).reduce<Record<string, string[]>>((tags, [pid, work]) => {
    tags[pid] = pixivEagleSourceTags(work);
    return tags;
  }, {});
}

export function pixivEagleGalleryMetaFromState(href: string, sourceTitle: string, works: Record<string, PixivEagleWorkMetadata>, date = new Date()): GalleryMeta {
  const meta = new GalleryMeta(
    href,
    sourceTitle === "home"
      ? datedGalleryTitle(["pixiv", "home"], date)
      : galleryTitle(["pixiv", "user", sourceTitle]),
  );
  meta.tags = pixivEagleArtworkMetadataBuckets(works);
  return meta;
}

function cleanDisplayPart(value: unknown): string {
  return String(value ?? "")
    .replace(/[\n\r\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueDisplayParts(parts: string[]): string[] {
  const seen = new Set<string>();
  return parts.filter(part => {
    const key = part.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
