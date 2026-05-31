export function normalizeEagleTags(required: string[], source: string[], maxSourceTags: number): string[] {
  const tags = new Set<string>();
  required.map(cleanTag).filter(Boolean).forEach(tag => tags.add(tag));
  const limit = Number.isFinite(maxSourceTags) ? Math.max(0, Math.floor(maxSourceTags)) : 0;
  let added = 0;
  for (const rawTag of source) {
    if (added >= limit) break;
    const tag = normalizeSourceMetadataTag(rawTag) || cleanTag(rawTag);
    if (!tag || tags.has(tag)) continue;
    tags.add(tag);
    added += 1;
  }
  return [...tags];
}

export function sourceMetadataTag(category: string, value: string): string {
  const namespace = normalizeSourceNamespace(category);
  const tagValue = cleanSourceTagValue(value);
  return namespace && tagValue ? `${namespace}:${tagValue}` : "";
}

export function normalizeSourceMetadataTag(value: string): string {
  const index = value.indexOf(":");
  if (index < 0) return "";
  return sourceMetadataTag(value.slice(0, index), value.slice(index + 1));
}

export function eagleExtensionTag(...sources: Array<string | undefined>): string {
  for (const source of sources) {
    const ext = extensionFromSource(source);
    if (ext) return `ext:${ext}`;
  }
  return "";
}

function cleanTag(value: string): string {
  return value
    .replace(/[\n\r\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function cleanSourceTagValue(value: string): string {
  return cleanTag(value)
    .replace(/\s+(?:[+-]?\d+(?:\.\d+)?[kKmM]?|[+-]\d+)$/, "")
    .trim();
}

function normalizeSourceNamespace(category: string): "copyright" | "character" | "author" | "" {
  const normalized = cleanTag(category).toLowerCase();
  switch (normalized) {
    case "copyright":
    case "game copyright":
      return "copyright";
    case "character":
      return "character";
    case "author":
    case "artist":
      return "author";
    default:
      return "";
  }
}

function extensionFromSource(source: string | undefined): string {
  if (!source) return "";
  const fromQuery = source.match(/[?&](?:format|ext)=([a-z0-9]{2,8})\b/i)?.[1];
  const fromPath = source.match(/\.([a-z0-9]{2,8})(?:[?#].*)?$/i)?.[1];
  const ext = (fromQuery || fromPath || "").toLowerCase();
  return ext.replace(/[^a-z0-9]/g, "");
}
