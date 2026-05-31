const POST_REGISTER_TAGS_RE = /Post\.register_tags\((\{[^\n;]*\})\)/g;

export type MoebooruTagTypes = Record<string, unknown>;

export function parseMoebooruTagTypes(document: Document): MoebooruTagTypes {
  const tagTypes: MoebooruTagTypes = {};
  document.querySelectorAll<HTMLScriptElement>("script").forEach((script) => {
    const text = script.textContent || "";
    for (const match of text.matchAll(POST_REGISTER_TAGS_RE)) {
      try {
        Object.assign(tagTypes, JSON.parse(match[1]) as MoebooruTagTypes);
      } catch {
        // Ignore malformed inline tag maps; raw tags are still imported.
      }
    }
  });
  return tagTypes;
}

export function normalizeMoebooruSourceTags(rawTags: string | undefined, tagTypes: MoebooruTagTypes): string[] {
  const tags: string[] = [];
  for (const rawTag of splitTags(rawTags)) {
    const namespace = normalizeMoebooruTagType(tagTypes[rawTag]);
    tags.push(namespace ? `${namespace}:${rawTag}` : rawTag);
  }
  return [...new Set(tags)];
}

function splitTags(value: string | undefined): string[] {
  return (value || "")
    .split(/\s+/)
    .map(tag => tag.trim())
    .filter(Boolean);
}

function normalizeMoebooruTagType(value: unknown): "copyright" | "character" | "author" | "" {
  const raw = typeof value === "number" ? String(value) : typeof value === "string" ? value.toLowerCase() : "";
  switch (raw) {
    case "1":
    case "artist":
    case "circle":
      return "author";
    case "3":
    case "copyright":
      return "copyright";
    case "4":
    case "character":
      return "character";
    default:
      return "";
  }
}
