type PixivTagObject = {
  tag?: unknown;
};

export function normalizePixivWorkTags(value: unknown): string[] {
  const rawTags = Array.isArray(value) ? value : tagsArrayFromObject(value);
  return [...new Set(rawTags
    .map(tagValue)
    .map(cleanPixivTag)
    .filter(Boolean))];
}

function tagsArrayFromObject(value: unknown): unknown[] {
  if (!value || typeof value !== "object") return [];
  const tags = (value as { tags?: unknown }).tags;
  return Array.isArray(tags) ? tags : [];
}

function tagValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  const tag = (value as PixivTagObject).tag;
  return typeof tag === "string" ? tag : "";
}

function cleanPixivTag(value: string): string {
  return value
    .replace(/[\n\r\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}
