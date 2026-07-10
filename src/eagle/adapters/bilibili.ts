import { cleanSourceTag, eagleAuthorSourceTags } from "./source-tags";

type BilibiliModuleAuthor = {
  mid?: unknown,
  name?: unknown,
  pub_time?: unknown,
  pub_ts?: unknown,
};

export function bilibiliSourceTags(detail: unknown): string[] {
  const author = cleanBilibiliValue(bilibiliModuleAuthor(detail)?.name);
  return eagleAuthorSourceTags(author);
}

export function bilibiliAuthorUrls(detail: unknown): string[] {
  const mid = cleanBilibiliValue(bilibiliModuleAuthor(detail)?.mid);
  return /^\d+$/.test(mid) ? [`https://space.bilibili.com/${mid}`] : [];
}

export function bilibiliPublishedAt(detail: unknown): string {
  const author = bilibiliModuleAuthor(detail);
  return cleanBilibiliValue(author?.pub_time) || cleanBilibiliValue(author?.pub_ts);
}

function bilibiliModuleAuthor(detail: unknown): BilibiliModuleAuthor | undefined {
  if (!detail || typeof detail !== "object") return undefined;
  const modules = (detail as { modules?: unknown }).modules;
  if (!Array.isArray(modules)) return undefined;
  return modules
    .map(module => (module && typeof module === "object") ? (module as { module_author?: BilibiliModuleAuthor }).module_author : undefined)
    .find(author => Boolean(author?.name || author?.mid || author?.pub_time || author?.pub_ts));
}

function cleanBilibiliValue(value: unknown): string {
  return cleanSourceTag(value);
}
