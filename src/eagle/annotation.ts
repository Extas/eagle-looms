import { EagleDuplicateAsset, stableKeyForAsset } from "./duplicates";

export type EagleAnnotationInput = EagleDuplicateAsset & {
  authorUrls?: string[];
};

export function eagleAnnotationForAsset(input: EagleAnnotationInput): string | undefined {
  const authorUrls = unique(input.authorUrls || []);
  if (!input.itemKey && authorUrls.length === 0) return undefined;

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

function unique(values: string[]): string[] {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))];
}
