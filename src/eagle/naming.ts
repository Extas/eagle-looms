const MAX_EAGLE_ITEM_NAME_LENGTH = 180;
const EAGLE_ITEM_NAME_INVALID_CHARS = /[\\/:*?"<>|\n\r\t]+/g;
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/g;
const FORMAT_CHARS = /[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g;
const EXTENSION_RE = /^(.+)\.([a-z0-9]{1,12})$/i;
const RESERVED_DEVICE_NAME_RE = /^(con|prn|aux|nul|com[1-9]|lpt[1-9]|com[¹²³]|lpt[¹²³])$/i;

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

function safeReservedName(stem: string): string {
  const clean = stem || "image";
  return RESERVED_DEVICE_NAME_RE.test(clean) || clean === "." || clean === ".." ? `${clean}_` : clean;
}

function truncateStem(stem: string, extension: string, suffix = ""): string {
  const extensionLength = extension ? extension.length + 1 : 0;
  const maxStemLength = Math.max(1, MAX_EAGLE_ITEM_NAME_LENGTH - extensionLength - suffix.length);
  return stem.length > maxStemLength ? stem.slice(0, maxStemLength).replace(/[. ]+$/g, "") : stem;
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
