export const EAGLE_RAW_RECORD_SCHEMA = "eagle-looms/raw/v1";

export type EagleRawRecord = {
  identity: {
    stableKey: string;
    sourceUrl: string;
    originUrl?: string;
    itemKey?: string;
  };
  assetItemId?: string;
};

export function decodeEagleRawRecordAnnotation(annotation?: string): EagleRawRecord | undefined {
  const parsed = parseJsonObject(annotation);
  if (!parsed || parsed.schema !== EAGLE_RAW_RECORD_SCHEMA || !isObject(parsed.record)) return undefined;
  const identity = (parsed.record as Record<string, unknown>).identity;
  if (!isObject(identity)) return undefined;
  if (typeof identity.stableKey !== "string" || typeof identity.sourceUrl !== "string") return undefined;
  return parsed.record as EagleRawRecord;
}

function parseJsonObject(value?: string): Record<string, unknown> | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value);
    return isObject(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
