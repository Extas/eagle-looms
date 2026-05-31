const CATEGORY_ATTRS = {
  copyright: ["data-tag-string-copyright", "data-tags-copyright", "data-copyright-tags"],
  character: ["data-tag-string-character", "data-tags-character", "data-character-tags"],
  author: ["data-tag-string-artist", "data-tags-artist", "data-artist-tags"],
} as const;

export function normalizeBooruSourceTags(element: Element, fallbackTags: string[]): string[] {
  const categorized = new Set<string>();
  const tags: string[] = [];

  for (const [namespace, attrs] of Object.entries(CATEGORY_ATTRS) as Array<[keyof typeof CATEGORY_ATTRS, readonly string[]]>) {
    for (const value of attrs.flatMap(attr => splitSourceTags(element.getAttribute(attr)))) {
      categorized.add(value);
      tags.push(`${namespace}:${value}`);
    }
  }

  for (const tag of fallbackTags.map(cleanSourceTag).filter(Boolean)) {
    if (!categorized.has(tag)) tags.push(tag);
  }

  return [...new Set(tags)];
}

function splitSourceTags(value: string | null): string[] {
  return (value || "").split(/\s+/).map(cleanSourceTag).filter(Boolean);
}

function cleanSourceTag(value: string): string {
  return value.replace(/[\n\r\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
}
