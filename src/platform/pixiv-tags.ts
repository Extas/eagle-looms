type PixivTagObject = {
  tag?: unknown;
};

type PixivAuthorObject = {
  userId?: unknown;
  userName?: unknown;
  userAccount?: unknown;
};

export function normalizePixivWorkTags(value: unknown): string[] {
  const rawTags = Array.isArray(value) ? value : tagsArrayFromObject(value);
  return [...new Set(rawTags
    .map(tagValue)
    .map(cleanPixivTag)
    .filter(Boolean))];
}

export function pixivAuthorTag(value: unknown, fallbackUserId?: unknown): string {
  const author = pixivAuthorName(value);
  if (author) return `author:${author}`;
  const id = cleanPixivTag(String(fallbackUserId ?? pixivAuthorId(value) ?? ""));
  return id ? `author:${id}` : "";
}

export function pixivAuthorUrl(value: unknown, fallbackUserId?: unknown): string {
  const id = cleanPixivTag(String(fallbackUserId ?? pixivAuthorId(value) ?? ""));
  return id ? `https://www.pixiv.net/users/${id}` : "";
}

function pixivAuthorName(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const object = value as PixivAuthorObject;
  return cleanPixivTag(String(object.userName || object.userAccount || ""));
}

function pixivAuthorId(value: unknown): unknown {
  if (!value || typeof value !== "object") return "";
  return (value as PixivAuthorObject).userId;
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
