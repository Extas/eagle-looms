import { sourceMetadataTag } from "../tags";

export type TwitterEagleMetadata = {
  screenName?: unknown;
  hashtags?: unknown[];
};

export function twitterEagleSourceTags(metadata: TwitterEagleMetadata): string[] {
  const tags = new Set<string>();
  const author = twitterEagleAuthorTag(metadata.screenName);
  if (author) tags.add(author);
  (metadata.hashtags || [])
    .map(cleanTwitterTag)
    .filter(Boolean)
    .forEach(tag => tags.add(tag));
  return [...tags];
}

export function twitterEagleAuthorUrls(screenName: unknown): string[] {
  const user = cleanTwitterScreenName(screenName);
  return user ? [`https://x.com/${user}`] : [];
}

function twitterEagleAuthorTag(screenName: unknown): string {
  return sourceMetadataTag("author", cleanTwitterScreenName(screenName));
}

function cleanTwitterScreenName(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/^@+/, "")
    .replace(/[^\w]/g, "")
    .slice(0, 120);
}

function cleanTwitterTag(value: unknown): string {
  return String(value ?? "")
    .replace(/^#+/, "")
    .replace(/[\n\r\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}
