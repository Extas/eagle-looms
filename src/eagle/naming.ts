const MAX_EAGLE_ITEM_NAME_LENGTH = 180;
const EAGLE_ITEM_NAME_INVALID_CHARS = /[\\/:*?"<>|\n\r\t]+/g;
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/g;
const FORMAT_CHARS = /[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g;
const EXTENSION_RE = /^(.+)\.([a-z0-9]{1,12})$/i;
const RESERVED_DEVICE_NAME_RE = /^(con|prn|aux|nul|com[1-9]|lpt[1-9]|com[¹²³]|lpt[¹²³])$/i;
const STRUCTURED_NAME_SEPARATOR = " -- ";
const STRUCTURED_NAME_VERSION = 1;
const STRUCTURED_NAME_FIELD_ORDER = ["tool", "at", "seq", "src", "job", "seed", "variant"];
const STRUCTURED_NAME_KEY_RE = /^[a-z][a-z0-9-]*$/;
const STRUCTURED_NAME_VALUE_RE = /^[A-Za-z0-9._~-]+$/;
const STRUCTURED_NAME_STEM_RE = /^(.*) -- el([1-9]\d*)\[([a-z][a-z0-9-]*=[A-Za-z0-9._~-]+(?:;[a-z][a-z0-9-]*=[A-Za-z0-9._~-]+)*)\]$/;

const HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: "\"",
};

export function createEagleItemName(rawTitle: string, usedNames: Set<string>, fallback = "image"): string {
  return deduplicate(usedNames, normalizeEagleItemName(rawTitle, fallback));
}

export function normalizeEagleItemName(rawTitle: string, fallback = "image"): string {
  const fallbackName = normalizeNameCore(fallback) || "image";
  const clean = normalizeNameCore(rawTitle);
  const { stem, extension } = splitExtension(clean);
  const safeStem = safeReservedName(stem || fallbackName);
  return joinName(truncateStem(safeStem, extension), extension);
}

export function normalizeEagleItemNameWithDatePrefix(rawTitle: string, publishedAt?: unknown, fallback = "image"): string {
  const name = normalizeEagleItemName(rawTitle, fallback);
  const prefix = sourceDatePrefix(publishedAt);
  if (!prefix) return name;
  const { stem, extension } = splitExtension(name);
  if (/^\d{4}-\d{2}-\d{2}\b/.test(stem)) return name;
  return joinName(truncateStem(`${prefix} ${stem || fallback}`, extension), extension);
}

export interface EagleStructuredName {
  display: string;
  extension: string;
  version: number;
  capsule: string;
  fields: Record<string, string>;
}

export function buildStructuredEagleName(
  rawDisplayTitle: string,
  rawExtension: string,
  fields: Record<string, unknown>,
  fallback = "image",
): string {
  const fallbackName = normalizeNameCore(fallback) || "image";
  const clean = normalizeNameCore(rawDisplayTitle);
  const displayParts = splitExtension(clean);
  const extension = normalizeStructuredExtension(rawExtension) || displayParts.extension || "png";
  const display = safeReservedName(displayParts.stem || fallbackName);
  const pairs = fitStructuredFieldPairs(structuredFieldPairs(fields), extension);
  if (!pairs.length) return joinName(truncateStem(display, extension), extension);

  const capsule = `el${STRUCTURED_NAME_VERSION}[${pairs.map(([key, value]) => `${key}=${value}`).join(";")}]`;
  const suffix = `${STRUCTURED_NAME_SEPARATOR}${capsule}`;
  return joinName(truncateStem(display, extension, suffix), extension, suffix);
}

export function parseStructuredEagleName(name: string): EagleStructuredName | undefined {
  const { stem, extension } = splitExtension(String(name || "").trim());
  if (!stem || !extension) return undefined;
  const match = stem.match(STRUCTURED_NAME_STEM_RE);
  if (!match) return undefined;

  const display = match[1].trim();
  const version = Number(match[2]);
  const body = match[3];
  if (!display || !Number.isInteger(version) || version <= 0) return undefined;

  const fields: Record<string, string> = {};
  for (const pair of body.split(";")) {
    const [key, value, extra] = pair.split("=");
    if (extra !== undefined || !STRUCTURED_NAME_KEY_RE.test(key) || !STRUCTURED_NAME_VALUE_RE.test(value)) {
      return undefined;
    }
    if (key in fields) return undefined;
    fields[key] = value;
  }

  return {
    display,
    extension,
    version,
    capsule: `el${version}[${body}]`,
    fields,
  };
}

export function sourceDatePrefix(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const directDate = raw.match(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (directDate) return datePartsToPrefix(directDate[1], directDate[2], directDate[3]);
  const numeric = Number(raw);
  const time = Number.isFinite(numeric)
    ? timestampToMilliseconds(numeric)
    : Date.parse(raw);
  if (!Number.isFinite(time) || time <= 0) return "";
  return dateToPrefix(new Date(time));
}

export function localDatePrefix(date = new Date()): string {
  return datePartsToPrefix(
    String(date.getFullYear()),
    String(date.getMonth() + 1),
    String(date.getDate()),
  );
}

function normalizeNameCore(rawTitle: string): string {
  return decodePercentEncoded(decodeHtmlEntities(candidateFromRawTitle(String(rawTitle || ""))))
    .normalize("NFKC")
    .replace(/\.([a-z0-9]{1,12})[?#].*$/i, ".$1")
    .replace(FORMAT_CHARS, "")
    .replace(CONTROL_CHARS, " ")
    .replace(EAGLE_ITEM_NAME_INVALID_CHARS, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "");
}

function deduplicate(set: Set<string>, title: string): string {
  const { stem, extension } = splitExtension(title || "image");
  let next = joinName(truncateStem(stem || "image", extension), extension);
  if (!containsName(set, next)) {
    set.add(next);
    return next;
  }

  let copy = 2;
  do {
    const suffix = ` (${copy})`;
    next = joinName(truncateStem(stem || "image", extension, suffix), extension, suffix);
    copy += 1;
  } while (containsName(set, next));
  set.add(next);
  return next;
}

function candidateFromRawTitle(value: string): string {
  const trimmed = value.trim();
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    const last = url.pathname.split("/").filter(Boolean).pop();
    return last || trimmed;
  } catch {
    return trimmed;
  }
}

function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#[0-9]+|amp|apos|gt|lt|nbsp|quot);/gi, (_match, entity: string) => {
    const normalized = entity.toLowerCase();
    if (normalized.startsWith("#x")) return safeFromCodePoint(Number.parseInt(normalized.slice(2), 16));
    if (normalized.startsWith("#")) return safeFromCodePoint(Number.parseInt(normalized.slice(1), 10));
    return HTML_ENTITIES[normalized] || "";
  });
}

function safeFromCodePoint(value: number): string {
  return Number.isFinite(value) && value >= 0 && value <= 0x10ffff ? String.fromCodePoint(value) : "";
}

function decodePercentEncoded(value: string): string {
  if (!/%[0-9a-f]{2}/i.test(value)) return value;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function splitExtension(name: string): { stem: string; extension: string } {
  const match = name.match(EXTENSION_RE);
  if (!match) return { stem: name, extension: "" };
  return { stem: match[1].replace(/[. ]+$/g, ""), extension: match[2].toLowerCase() };
}

function structuredFieldPairs(fields: Record<string, unknown>): Array<[string, string]> {
  const pairs = new Map<string, string>();
  for (const [rawKey, rawValue] of Object.entries(fields)) {
    const key = normalizeStructuredKey(rawKey);
    const value = normalizeStructuredValue(rawValue);
    if (!key || !value || pairs.has(key)) continue;
    pairs.set(key, value);
  }
  return [...pairs.entries()].sort(([left], [right]) => structuredKeyRank(left) - structuredKeyRank(right) || left.localeCompare(right));
}

function fitStructuredFieldPairs(pairs: Array<[string, string]>, extension: string): Array<[string, string]> {
  const extensionLength = extension ? extension.length + 1 : 0;
  const envelopeLength = STRUCTURED_NAME_SEPARATOR.length + `el${STRUCTURED_NAME_VERSION}[]`.length;
  const maxBodyLength = Math.max(0, MAX_EAGLE_ITEM_NAME_LENGTH - extensionLength - envelopeLength - 1);
  const fitted: Array<[string, string]> = [];
  let bodyLength = 0;
  for (const [key, value] of pairs) {
    const separatorLength = fitted.length ? 1 : 0;
    const availableValueLength = maxBodyLength - bodyLength - separatorLength - key.length - 1;
    if (availableValueLength < 1) continue;
    const fittedValue = value.slice(0, availableValueLength);
    fitted.push([key, fittedValue]);
    bodyLength += separatorLength + key.length + 1 + fittedValue.length;
  }
  return fitted;
}

function normalizeStructuredKey(value: string): string {
  const key = value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  return STRUCTURED_NAME_KEY_RE.test(key) ? key : "";
}

function normalizeStructuredValue(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(FORMAT_CHARS, "")
    .replace(CONTROL_CHARS, " ")
    .trim()
    .replace(/[^A-Za-z0-9._~-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

function normalizeStructuredExtension(value: string): string {
  const extension = String(value || "").trim().toLowerCase().replace(/^\.+/, "");
  return /^[a-z0-9]{1,12}$/.test(extension) ? extension : "";
}

function structuredKeyRank(key: string): number {
  const index = STRUCTURED_NAME_FIELD_ORDER.indexOf(key);
  return index === -1 ? STRUCTURED_NAME_FIELD_ORDER.length : index;
}

function timestampToMilliseconds(value: number): number {
  return Math.abs(value) < 1_000_000_000_000 ? value * 1000 : value;
}

function dateToPrefix(date: Date): string {
  if (Number.isNaN(date.getTime())) return "";
  return datePartsToPrefix(
    String(date.getUTCFullYear()),
    String(date.getUTCMonth() + 1),
    String(date.getUTCDate()),
  );
}

function datePartsToPrefix(year: string, month: string, day: string): string {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return "";
  if (y < 1970 || y > 9999 || m < 1 || m > 12 || d < 1 || d > 31) return "";
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return "";
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function safeReservedName(stem: string): string {
  const clean = stem || "image";
  return RESERVED_DEVICE_NAME_RE.test(clean) || clean === "." || clean === ".." ? `${clean}_` : clean;
}

function truncateStem(stem: string, extension: string, suffix = ""): string {
  const extensionLength = extension ? extension.length + 1 : 0;
  const maxStemLength = Math.max(1, MAX_EAGLE_ITEM_NAME_LENGTH - extensionLength - suffix.length);
  const truncated = stem.length > maxStemLength ? stem.slice(0, maxStemLength) : stem;
  const clean = truncated.replace(/[. ]+$/g, "");
  return clean || "image".slice(0, maxStemLength);
}

function joinName(stem: string, extension: string, suffix = ""): string {
  return `${stem}${suffix}${extension ? `.${extension}` : ""}`;
}

function containsName(set: Set<string>, name: string): boolean {
  const key = canonicalName(name);
  for (const value of set) {
    if (canonicalName(value) === key) return true;
  }
  return false;
}

function canonicalName(name: string): string {
  return name.normalize("NFC").toLowerCase();
}
