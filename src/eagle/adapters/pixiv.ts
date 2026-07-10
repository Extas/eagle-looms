import { GalleryMeta } from "../../download/gallery-meta";
import { datedGalleryTitle, galleryTitle } from "../../platform/gallery-title";
import { pixivAuthorLabel, pixivAuthorUrl } from "../../platform/pixiv-tags";
import { sourceMetadataTag } from "../tags";

export type PixivEagleWorkMetadata = {
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
