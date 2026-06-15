import { sourceMetadataTag } from "../tags";

export function eagleAuthorSourceTags(author: unknown, sourceTags: unknown[] = []): string[] {
  const tags = new Set<string>();
  const authorTag = sourceMetadataTag("author", cleanSourceTag(author));
  if (authorTag) tags.add(authorTag);
  sourceTags
    .map(cleanSourceTag)
    .filter(Boolean)
    .forEach(tag => tags.add(tag));
  return [...tags];
}

export function isEagleAuthorCategory(category: unknown): boolean {
  return sourceMetadataTag(String(category ?? ""), "author").startsWith("author:");
}

export function cleanSourceTag(value: unknown): string {
  if (typeof value !== "string" && typeof value !== "number") return "";
  return String(value)
    .replace(/[\n\r\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}
