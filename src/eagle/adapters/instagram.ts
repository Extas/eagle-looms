import { cleanSourceTag, eagleAuthorSourceTags } from "./source-tags";

export function instagramSourceTags(username: unknown, captionText: unknown): string[] {
  const author = cleanInstagramValue(username);
  return eagleAuthorSourceTags(author, instagramCaptionHashtags(captionText));
}

export function instagramAuthorUrls(username: unknown): string[] {
  const author = cleanInstagramValue(username);
  return author ? [`https://www.instagram.com/${encodeURIComponent(author)}/`] : [];
}

export function instagramPublishedAt(value: unknown): string {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  return String(seconds);
}

function instagramCaptionHashtags(value: unknown): string[] {
  if (typeof value !== "string") return [];
  const tags: string[] = [];
  for (const match of value.matchAll(/(^|[^\p{L}\p{N}_])#([\p{L}\p{N}_]+)/gu)) {
    const tag = cleanInstagramValue(match[2]);
    if (tag) tags.push(tag);
  }
  return tags;
}

function cleanInstagramValue(value: unknown): string {
  return cleanSourceTag(String(value ?? "").replace(/^[#@]+/, ""));
}
