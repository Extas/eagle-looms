export const DEFAULT_EAGLE_BASE_URL = "http://localhost:41595";
export const DEFAULT_EAGLE_FOLDER_TEMPLATE = "Eagle Looms/{site}/{gallery}";
export const DEFAULT_EAGLE_IMPORT_LIMIT = 100;
export const DEFAULT_EAGLE_MAX_SOURCE_TAGS = 20;
export const EAGLE_IMPORT_LIMIT_RANGE = [1, 1000] as const;
export const EAGLE_MAX_SOURCE_TAGS_RANGE = [0, 100] as const;

const FOLDER_INVALID_CHARS = /[\\/:*?"<>|\n\r\t]+/g;

export type EagleFolderTokens = {
  site: string;
  gallery: string;
  chapter: string;
};

export type EagleConfigPatch = {
  eagleBaseUrl?: unknown;
  eagleFolderPath?: unknown;
  eagleImportLimit?: unknown;
  eagleMaxSourceTags?: unknown;
};

export function normalizeEagleBaseUrl(value: unknown): string {
  const raw = typeof value === "string" && value.trim() ? value.trim() : DEFAULT_EAGLE_BASE_URL;
  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol)) return DEFAULT_EAGLE_BASE_URL;
    return url.origin;
  } catch {
    return DEFAULT_EAGLE_BASE_URL;
  }
}

export function normalizeEagleFolderTemplate(value: unknown): string {
  const raw = typeof value === "string" ? value : "";
  const segments = raw
    .split("/")
    .map(segment => cleanFolderName(segment.trim()))
    .filter(Boolean);
  return segments.length ? segments.join("/") : DEFAULT_EAGLE_FOLDER_TEMPLATE;
}

export function normalizeEagleImportLimit(value: unknown): number {
  const parsed = Math.trunc(Number(value));
  if (!Number.isFinite(parsed)) return DEFAULT_EAGLE_IMPORT_LIMIT;
  return Math.min(EAGLE_IMPORT_LIMIT_RANGE[1], Math.max(EAGLE_IMPORT_LIMIT_RANGE[0], parsed));
}

export function normalizeEagleMaxSourceTags(value: unknown): number {
  const parsed = Math.trunc(Number(value));
  if (!Number.isFinite(parsed)) return DEFAULT_EAGLE_MAX_SOURCE_TAGS;
  return Math.min(EAGLE_MAX_SOURCE_TAGS_RANGE[1], Math.max(EAGLE_MAX_SOURCE_TAGS_RANGE[0], parsed));
}

export function normalizeEagleConfigPatch<T extends object>(patch: T): T {
  const next = { ...patch } as T & EagleConfigPatch;
  if ("eagleBaseUrl" in next) next.eagleBaseUrl = normalizeEagleBaseUrl(next.eagleBaseUrl);
  if ("eagleFolderPath" in next) next.eagleFolderPath = normalizeEagleFolderTemplate(next.eagleFolderPath);
  if ("eagleImportLimit" in next) next.eagleImportLimit = normalizeEagleImportLimit(next.eagleImportLimit);
  if ("eagleMaxSourceTags" in next) next.eagleMaxSourceTags = normalizeEagleMaxSourceTags(next.eagleMaxSourceTags);
  return next as T;
}

export function resolveEagleFolderPath(template: string, tokens: EagleFolderTokens): string[] {
  const raw = normalizeEagleFolderTemplate(template)
    .replaceAll("{site}", tokens.site)
    .replaceAll("{gallery}", tokens.gallery)
    .replaceAll("{chapter}", tokens.chapter);
  const path = raw
    .split("/")
    .map(cleanFolderName)
    .filter(Boolean);
  return path.length ? path : DEFAULT_EAGLE_FOLDER_TEMPLATE.split("/");
}

export function cleanFolderName(value: string): string {
  return value
    .replace(FOLDER_INVALID_CHARS, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}
