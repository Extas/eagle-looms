import { cleanSourceTag, eagleAuthorSourceTags } from "./source-tags";

export type DoubanMetadataSource = {
  owner_name?: unknown,
  owner_url?: unknown,
  date?: unknown,
};

export function doubanSourceTags(album: Pick<DoubanMetadataSource, "owner_name">): string[] {
  const author = cleanDoubanValue(album.owner_name);
  return eagleAuthorSourceTags(author);
}

export function doubanAuthorUrls(album: Pick<DoubanMetadataSource, "owner_url">): string[] {
  const url = cleanDoubanUrl(album.owner_url);
  if (!url) return [];
  try {
    const parsed = new URL(url, "https://www.douban.com");
    parsed.pathname = parsed.pathname.replace(/\/photos\/?$/, "");
    parsed.search = "";
    parsed.hash = "";
    return [parsed.href.replace(/\/$/, "")];
  } catch {
    return [url.replace(/\/photos\/?$/, "").replace(/\/$/, "")];
  }
}

export function doubanPublishedAt(album: Pick<DoubanMetadataSource, "date">): string {
  return cleanDoubanValue(album.date);
}

function cleanDoubanValue(value: unknown): string {
  return cleanSourceTag(value);
}

function cleanDoubanUrl(value: unknown): string {
  if (typeof value !== "string" && typeof value !== "number") return "";
  return String(value).replace(/[\n\r\t]+/g, "").trim();
}
