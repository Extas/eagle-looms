import { isTwitterMediaSourceUrl } from "./adapters/twitter";
import { decodeEagleRawRecordAnnotation, type EagleRawRecord } from "./raw-record";

export type EagleDuplicateAsset = {
  sourceUrl: string;
  originUrl?: string;
  itemKey?: string;
  sourceName?: string;
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
  if (!asset.itemKey) return [];
  return [`"${stableKeyForAsset(asset).replaceAll('"', '\\"')}"`];
}

export function duplicateUrls(asset: EagleDuplicateAsset): string[] {
  return [...new Set([asset.sourceUrl, asset.originUrl].filter((value): value is string => Boolean(value)))];
}

export function isDuplicateItem(item: EagleDuplicateCandidate, asset: EagleDuplicateAsset): boolean {
  const stableKey = stableKeyForAsset(asset);
  const legacyStableKey = legacyStableKeyForAsset(asset);
  const sourceOnlyIdentity = !asset.itemKey && !asset.originUrl;
  const rawRecord = decodeEagleRawRecordAnnotation(item.annotation);
  if (rawRecord) return rawRecordMatchesAsset(rawRecord, asset, stableKey);
  const payload = parseAnnotationPayload(item.annotation);
  if (item.annotation?.includes(stableKey) || payload?.stableKey === stableKey) return true;
  if (sourceOnlyIdentity && (item.annotation?.includes(legacyStableKey) || payload?.stableKey === legacyStableKey)) return true;
  if (payload && payloadMatchesAsset(payload, asset)) return true;
  if (sourceOnlyIdentity && (item.website === asset.sourceUrl || item.url === asset.sourceUrl)) return true;
  if (isTwitterMediaSourceUrl(asset.sourceUrl)
    && (item.website === asset.sourceUrl || item.url === asset.sourceUrl)) return true;
  if (asset.sourceName
    && (item.website === asset.sourceUrl || item.url === asset.sourceUrl)
    && candidateNameMatchesItemKey(item.name, asset.sourceName)) return true;
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

export function isSessionImported(asset: EagleDuplicateAsset, libraryKey = ""): boolean {
  return SESSION_IMPORTED_ASSET_KEYS.has(sessionImportedAssetKey(asset, libraryKey));
}

export function markSessionImported(asset: EagleDuplicateAsset, libraryKey = ""): void {
  SESSION_IMPORTED_ASSET_KEYS.add(sessionImportedAssetKey(asset, libraryKey));
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

function sessionImportedAssetKey(asset: EagleDuplicateAsset, libraryKey: string): string {
  return `${libraryKey}\0${stableKeyForAsset(asset)}`;
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
  const normalizedItemKeys = [
    normalizeComparableName(itemKey),
    normalizeComparableName(itemKey.replace(/\.[a-z0-9]{1,12}$/i, "")),
  ].filter((value, index, values) => value && values.indexOf(value) === index);
  return normalizedItemKeys.some(key => normalizedName === key || normalizedName.endsWith(` ${key}`) || normalizedName.endsWith(`-${key}`));
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
