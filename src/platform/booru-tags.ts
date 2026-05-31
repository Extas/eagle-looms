const CATEGORY_ATTRS = {
  copyright: ["data-tag-string-copyright", "data-tags-copyright", "data-copyright-tags"],
  character: ["data-tag-string-character", "data-tags-character", "data-character-tags"],
  author: ["data-tag-string-artist", "data-tags-artist", "data-artist-tags"],
} as const;

const CATEGORY_SELECTORS = {
  copyright: [
    ".tag-type-copyright a",
    ".copyright-tag-list a",
    ".tag-list-copyright a",
    ".category-copyright a",
    ".category-3 a",
    "[data-category='copyright'] a",
    "[data-category='3'] a",
  ],
  character: [
    ".tag-type-character a",
    ".character-tag-list a",
    ".tag-list-character a",
    ".category-character a",
    ".category-4 a",
    "[data-category='character'] a",
    "[data-category='4'] a",
  ],
  author: [
    ".tag-type-artist a",
    ".tag-type-author a",
    ".artist-tag-list a",
    ".author-tag-list a",
    ".tag-list-artist a",
    ".category-artist a",
    ".category-1 a",
    "[data-category='artist'] a",
    "[data-category='author'] a",
    "[data-category='1'] a",
  ],
} as const;

const RAW_TAG_SELECTORS = [
  ".tag-type-general a",
  ".tag-type-meta a",
  ".tag-list-general a",
  ".tag-list-meta a",
  ".category-general a",
  ".category-meta a",
  ".category-0 a",
  ".category-5 a",
  "[data-category='general'] a",
  "[data-category='meta'] a",
  "[data-category='0'] a",
  "[data-category='5'] a",
] as const;

export function normalizeBooruSourceTags(element: Element, fallbackTags: string[]): string[] {
  return extractBooruSourceTags(element, fallbackTags);
}

export function extractBooruSourceTags(root: ParentNode, fallbackTags: string[]): string[] {
  const categorized = new Set<string>();
  const tags: string[] = [];

  for (const [namespace, attrs] of Object.entries(CATEGORY_ATTRS) as Array<[keyof typeof CATEGORY_ATTRS, readonly string[]]>) {
    for (const element of elementsWithAnyAttribute(root, attrs)) {
      for (const value of attrs.flatMap(attr => splitSourceTags(element.getAttribute(attr)))) {
        categorized.add(value);
        tags.push(`${namespace}:${value}`);
      }
    }
  }

  for (const [namespace, selectors] of Object.entries(CATEGORY_SELECTORS) as Array<[keyof typeof CATEGORY_SELECTORS, readonly string[]]>) {
    for (const selector of selectors) {
      root.querySelectorAll?.(selector).forEach((anchor) => {
        const value = cleanSourceTag(anchor.textContent || "");
        if (!value) return;
        categorized.add(value);
        tags.push(`${namespace}:${value}`);
      });
    }
  }

  for (const selector of RAW_TAG_SELECTORS) {
    root.querySelectorAll?.(selector).forEach((anchor) => {
      const value = cleanSourceTag(anchor.textContent || "");
      if (!value || categorized.has(value)) return;
      tags.push(value);
    });
  }

  for (const tag of fallbackTags.map(cleanSourceTag).filter(Boolean)) {
    if (!categorized.has(tag)) tags.push(tag);
  }

  return [...new Set(tags)];
}

function elementsWithAnyAttribute(root: ParentNode, attrs: readonly string[]): Element[] {
  const selectors = attrs.map(attr => `[${attr}]`);
  const elements: Element[] = [];

  if (root instanceof Element && attrs.some(attr => root.hasAttribute(attr))) {
    elements.push(root);
  }
  if (selectors.length > 0) {
    elements.push(...Array.from(root.querySelectorAll?.(selectors.join(",")) || []));
  }

  return [...new Set(elements)];
}

function splitSourceTags(value: string | null): string[] {
  return (value || "").split(/\s+/).map(cleanSourceTag).filter(Boolean);
}

function cleanSourceTag(value: string): string {
  return value
    .replace(/[\n\r\t]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+(?:[+-]?\d+(?:\.\d+)?[kKmM]?|[+-]\d+)$/, "")
    .trim()
    .slice(0, 120);
}
