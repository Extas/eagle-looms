import { decodeEagleRawRecordAnnotation, type EagleRawRecord } from "./raw-record";

export type EagleDuplicateAsset = {
  sourceUrl: string;
  originUrl?: string;
  itemKey?: string;
};

export type EagleDuplicateCandidate = {
  name?: string;
  website?: string;
  url?: string;
  annotation?: string;
};

const SESSION_IMPORTED_ASSET_KEYS = new Set<string>();

export function stableKeyForAsset(asset: EagleDuplicateAsset): string {
  return `eagle-looms:v2:${[asset.sourceUrl, asset.originUrl || "", asset.itemKey || ""].join("|")}`;
}

export function duplicateQueries(asset: EagleDuplicateAsset): string[] {
  const terms = new Set([
    stableKeyForAsset(asset),
    asset.itemKey ? "" : legacyStableKeyForAsset(asset),
    asset.sourceUrl,
    asset.originUrl,
  ].filter(Boolean));
  return [...terms].map(value => `"${String(value).replaceAll('"', '\\"')}"`);
}

export function isDuplicateItem(item: EagleDuplicateCandidate, asset: EagleDuplicateAsset): boolean {
  const stableKey = stableKeyForAsset(asset);
  const legacyStableKey = legacyStableKeyForAsset(asset);
  const rawRecord = decodeEagleRawRecordAnnotation(item.annotation);
  if (rawRecord) return rawRecordMatchesAsset(rawRecord, asset, stableKey);
  const payload = parseAnnotationPayload(item.annotation);
  if (item.annotation?.includes(stableKey) || payload?.stableKey === stableKey) return true;
  if (!asset.itemKey && (item.annotation?.includes(legacyStableKey) || payload?.stableKey === legacyStableKey)) return true;
  if (payload && payloadMatchesAsset(payload, asset)) return true;
  if (!asset.itemKey && item.website === asset.sourceUrl) return true;
  if (asset.originUrl && !asset.itemKey && item.url === asset.originUrl) return true;
  if (asset.itemKey && asset.originUrl && item.url === asset.originUrl && candidateNameMatchesItemKey(item.name, asset.itemKey)) return true;
  return false;
}

function rawRecordMatchesAsset(record: EagleRawRecord, asset: EagleDuplicateAsset, stableKey: string): boolean {
  if (!record.assetItemId) return false;
  const identity = record.identity;
  if (identity.stableKey !== stableKey) return false;
  if (identity.sourceUrl !== asset.sourceUrl) return false;
  if ((identity.originUrl || "") !== (asset.originUrl || "")) return false;
  if ((identity.itemKey || "") !== (asset.itemKey || "")) return false;
  return true;
}

export function isSessionImported(asset: EagleDuplicateAsset): boolean {
  return SESSION_IMPORTED_ASSET_KEYS.has(stableKeyForAsset(asset));
}

export function markSessionImported(asset: EagleDuplicateAsset): void {
  SESSION_IMPORTED_ASSET_KEYS.add(stableKeyForAsset(asset));
}

export function hasPlannedAssetKey(asset: EagleDuplicateAsset, plannedKeys: Set<string>): boolean {
  return plannedKeys.has(stableKeyForAsset(asset));
}

export function markPlannedAssetKey(asset: EagleDuplicateAsset, plannedKeys: Set<string>): void {
  plannedKeys.add(stableKeyForAsset(asset));
}

export function clearSessionImportedAssets(): void {
  SESSION_IMPORTED_ASSET_KEYS.clear();
}

function legacyStableKeyForAsset(asset: EagleDuplicateAsset): string {
  return `eagle-looms:${asset.sourceUrl || asset.originUrl || ""}`;
}

function payloadMatchesAsset(payload: Record<string, unknown>, asset: EagleDuplicateAsset): boolean {
  if (payload.sourceUrl !== asset.sourceUrl) return false;
  if (asset.originUrl && payload.originUrl !== asset.originUrl) return false;
  if (asset.itemKey && payload.itemKey !== asset.itemKey && payload.subName !== asset.itemKey && payload.name !== asset.itemKey) return false;
  return true;
}

function candidateNameMatchesItemKey(name: string | undefined, itemKey: string): boolean {
  if (!name || !itemKey) return false;
  const normalizedName = normalizeComparableName(name);
  const normalizedItemKey = normalizeComparableName(itemKey);
  return normalizedName === normalizedItemKey || normalizedName.endsWith(` ${normalizedItemKey}`);
}

function normalizeComparableName(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\\/:*?"<>|\n\r\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function parseAnnotationPayload(annotation?: string): Record<string, unknown> | undefined {
  if (!annotation) return undefined;
  const match = annotation.match(/```eagle-looms-json\s*([\s\S]*?)```/);
  const raw = (match?.[1] || annotation).trim();
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : undefined;
  } catch {
    return undefined;
  }
}
