import { EagleDuplicateAsset, stableKeyForAsset } from "./duplicates";

export type EagleAnnotationInput = EagleDuplicateAsset & {
  authorUrls?: string[];
};

const MAX_AUTHOR_URLS = 20;
const MAX_AUTHOR_URL_LENGTH = 2048;

export function eagleAnnotationForAsset(input: EagleAnnotationInput): string | undefined {
  const authorUrls = validAuthorUrls(input.authorUrls || []);
  if (!input.itemKey && authorUrls.length === 0) return undefined;
  if (!input.itemKey) return authorUrls.join("\n");

  const payload: Record<string, unknown> = {
    schema: "eagle-looms/item/v1",
    sourceUrl: input.sourceUrl,
    stableKey: stableKeyForAsset(input),
  };
  if (input.originUrl) payload.originUrl = input.originUrl;
  if (input.itemKey) payload.itemKey = input.itemKey;
  if (authorUrls.length) payload.authorUrls = authorUrls;
  return JSON.stringify(payload);
}

function validAuthorUrls(values: string[]): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const raw = value.trim();
    if (!raw || raw.length > MAX_AUTHOR_URL_LENGTH) continue;

    try {
      const parsed = new URL(raw);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") continue;
      const key = parsed.toString();
      if (seen.has(key)) continue;
      seen.add(key);
      urls.push(raw);
      if (urls.length >= MAX_AUTHOR_URLS) break;
    } catch {
      continue;
    }
  }

  return urls;
}
