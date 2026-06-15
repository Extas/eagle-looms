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
