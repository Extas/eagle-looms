export const DEFAULT_EAGLE_BASE_URL = "http://localhost:41595";
export const DEFAULT_EAGLE_FOLDER_TEMPLATE = "Eagle Looms/{site}/{copyright}";
export const DEFAULT_EAGLE_FOLDER_PRESET = "copyright";
export const DEFAULT_EAGLE_IMPORT_LIMIT = 100;
export const DEFAULT_EAGLE_MAX_SOURCE_TAGS = 20;
export const DEFAULT_EAGLE_NAME_DATE_PREFIX = true;
export const EAGLE_IMPORT_LIMIT_RANGE = [1, 1000] as const;
export const EAGLE_MAX_SOURCE_TAGS_RANGE = [0, 100] as const;

const FOLDER_INVALID_CHARS = /[\\/:*?"<>|\n\r\t]+/g;

export type EagleFolderTokens = {
  site: string;
  gallery: string;
  chapter: string;
  copyright?: string;
  character?: string;
  author?: string;
  copyrights?: string[];
  characters?: string[];
  authors?: string[];
};

export type EagleConfigPatch = {
  eagleBaseUrl?: unknown;
  eagleFolderPreset?: unknown;
  eagleFolderPath?: unknown;
  eagleImportLimit?: unknown;
  eagleMaxSourceTags?: unknown;
  eagleNameDatePrefix?: unknown;
  eagleSkipDuplicates?: unknown;
};

export const EAGLE_FOLDER_PRESETS = ["custom", "copyright", "gallery", "chapter", "copyrightAuthor", "copyrightCharacter"] as const;
export type EagleFolderPreset = typeof EAGLE_FOLDER_PRESETS[number];

export const EAGLE_FOLDER_PRESET_TEMPLATES: Record<Exclude<EagleFolderPreset, "custom">, string> = {
  copyright: DEFAULT_EAGLE_FOLDER_TEMPLATE,
  gallery: "Eagle Looms/{site}/{gallery}",
  chapter: "Eagle Looms/{site}/{gallery}/{chapter}",
  copyrightAuthor: "Eagle Looms/{site}/{copyright}/{author}",
  copyrightCharacter: "Eagle Looms/{site}/{copyright}/{character}",
};

export const EAGLE_FOLDER_PRESET_OPTIONS: { value: EagleFolderPreset; display: string }[] = [
  { value: "custom", display: "Custom path" },
  { value: "copyright", display: "Site / Copyright" },
  { value: "gallery", display: "Site / Gallery" },
  { value: "chapter", display: "Site / Gallery / Chapter" },
  { value: "copyrightAuthor", display: "Site / Copyright / Author" },
  { value: "copyrightCharacter", display: "Site / Copyright / Character" },
];

export function normalizeEagleFolderPreset(value: unknown): EagleFolderPreset {
  if (typeof value === "string" && (EAGLE_FOLDER_PRESETS as readonly string[]).includes(value)) {
    return value as EagleFolderPreset;
  }
  return DEFAULT_EAGLE_FOLDER_PRESET;
}

export function eagleFolderTemplateForPreset(value: unknown): string | undefined {
  const preset = normalizeEagleFolderPreset(value);
  if (preset === "custom") return undefined;
  return EAGLE_FOLDER_PRESET_TEMPLATES[preset];
}

export function eagleFolderPresetForTemplate(value: unknown): EagleFolderPreset {
  const template = normalizeEagleFolderTemplate(value);
  for (const [preset, presetTemplate] of Object.entries(EAGLE_FOLDER_PRESET_TEMPLATES) as Array<[Exclude<EagleFolderPreset, "custom">, string]>) {
    if (normalizeEagleFolderTemplate(presetTemplate) === template) return preset;
  }
  return "custom";
}

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

export function normalizeEagleBoolean(value: unknown, fallback = true): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "off"].includes(normalized)) return false;
  }
  if (typeof value === "number" && Number.isFinite(value)) return value !== 0;
  return fallback;
}

export function normalizeEagleConfigPatch<T extends object>(patch: T): T {
  const next = { ...patch } as T & EagleConfigPatch;
  if ("eagleBaseUrl" in next) next.eagleBaseUrl = normalizeEagleBaseUrl(next.eagleBaseUrl);
  if ("eagleFolderPreset" in next) next.eagleFolderPreset = normalizeEagleFolderPreset(next.eagleFolderPreset);
  if ("eagleFolderPath" in next) next.eagleFolderPath = normalizeEagleFolderTemplate(next.eagleFolderPath);
  if ("eagleFolderPath" in next) next.eagleFolderPreset = eagleFolderPresetForTemplate(next.eagleFolderPath);
  if ("eagleImportLimit" in next) next.eagleImportLimit = normalizeEagleImportLimit(next.eagleImportLimit);
  if ("eagleMaxSourceTags" in next) next.eagleMaxSourceTags = normalizeEagleMaxSourceTags(next.eagleMaxSourceTags);
  if ("eagleNameDatePrefix" in next) next.eagleNameDatePrefix = normalizeEagleBoolean(next.eagleNameDatePrefix, DEFAULT_EAGLE_NAME_DATE_PREFIX);
  if ("eagleSkipDuplicates" in next) next.eagleSkipDuplicates = normalizeEagleBoolean(next.eagleSkipDuplicates, true);
  return next as T;
}

export function resolveEagleFolderPath(template: string, tokens: EagleFolderTokens): string[] {
  return resolveEagleFolderPaths(template, tokens)[0] || DEFAULT_EAGLE_FOLDER_TEMPLATE.split("/");
}

export function resolveEagleFolderPaths(template: string, tokens: EagleFolderTokens): string[][] {
  const normalizedTemplate = normalizeEagleFolderTemplate(template);
  const resolvedTokens = applyDefaultFolderFallback(normalizedTemplate, tokens);
  const characterValues = normalizedTemplate.includes("{character}") ? tokenList(resolvedTokens.characters, resolvedTokens.character) : [resolvedTokens.character || ""];
  const paths = characterValues.length
    ? characterValues.map(character => resolveSingleFolderPath(normalizedTemplate, { ...resolvedTokens, character }))
    : [resolveSingleFolderPath(normalizedTemplate, resolvedTokens)];
  return uniquePaths(paths.length ? paths : [DEFAULT_EAGLE_FOLDER_TEMPLATE.split("/")]);
}

function applyDefaultFolderFallback(template: string, tokens: EagleFolderTokens): EagleFolderTokens {
  if (normalizeEagleFolderTemplate(template) !== DEFAULT_EAGLE_FOLDER_TEMPLATE || cleanFolderName(tokens.copyright || "")) {
    return tokens;
  }
  return {
    ...tokens,
    copyright: cleanFolderName(tokens.gallery || tokens.author || tokens.chapter || "Unsorted"),
  };
}

function resolveSingleFolderPath(template: string, tokens: EagleFolderTokens): string[] {
  const tokenValues = {
    site: cleanFolderName(tokens.site),
    gallery: cleanFolderName(tokens.gallery),
    chapter: cleanFolderName(tokens.chapter),
    copyright: cleanFolderName(tokens.copyright || ""),
    character: cleanFolderName(tokens.character || ""),
    author: cleanFolderName(tokens.author || ""),
  };
  const raw = template
    .replaceAll("{site}", tokenValues.site)
    .replaceAll("{gallery}", tokenValues.gallery)
    .replaceAll("{chapter}", tokenValues.chapter)
    .replaceAll("{copyright}", tokenValues.copyright)
    .replaceAll("{character}", tokenValues.character)
    .replaceAll("{author}", tokenValues.author);
  const path = raw
    .split("/")
    .map(cleanFolderName)
    .filter(Boolean);
  return path.length ? path : DEFAULT_EAGLE_FOLDER_TEMPLATE.split("/");
}

function tokenList(values?: string[], fallback?: string): string[] {
  const source = values?.length ? values : fallback ? [fallback] : [];
  return [...new Set(source.map(cleanFolderName).filter(Boolean))];
}

function uniquePaths(paths: string[][]): string[][] {
  const seen = new Set<string>();
  const unique: string[][] = [];
  for (const path of paths) {
    const key = path.join("/");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(path);
  }
  return unique.length ? unique : [DEFAULT_EAGLE_FOLDER_TEMPLATE.split("/")];
}

export function cleanFolderName(value: string): string {
  return value
    .replace(FOLDER_INVALID_CHARS, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}
