const CATEGORY_ATTRS = {
  copyright: ["data-tag-string-copyright", "data-tags-copyright", "data-copyright-tags"],
  character: ["data-tag-string-character", "data-tags-character", "data-character-tags"],
  author: [
    "data-tag-string-artist",
    "data-tags-artist",
    "data-artist-tags",
    "data-tag-string-author",
    "data-tags-author",
    "data-author-tags",
    "data-tag-string-creator",
    "data-tags-creator",
    "data-creator-tags",
    "data-tag-string-group",
    "data-tags-group",
    "data-group-tags",
    "data-tag-string-circle",
    "data-tags-circle",
    "data-circle-tags",
    "data-tag-string-illustrator",
    "data-tags-illustrator",
    "data-illustrator-tags",
    "data-tag-string-writer",
    "data-tags-writer",
    "data-writer-tags",
    "data-tag-string-translator",
    "data-tags-translator",
    "data-translator-tags",
    "data-tag-string-editor",
    "data-tags-editor",
    "data-editor-tags",
    "data-tag-string-colorist",
    "data-tags-colorist",
    "data-colorist-tags",
    "data-tag-string-letterer",
    "data-tags-letterer",
    "data-letterer-tags",
    "data-tag-string-mangaka",
    "data-tags-mangaka",
    "data-mangaka-tags",
  ],
} as const;

const RAW_TAG_ATTRS = [
  "data-tag-string-general",
  "data-tags-general",
  "data-general-tags",
  "data-tag-string-meta",
  "data-tags-meta",
  "data-meta-tags",
] as const;

const CATEGORY_SELECTORS = {
  copyright: [
    ".tag-type-copyright a",
    ".tag-type-3 a",
    ".copyright-tag-list a",
    ".tag-list-copyright a",
    ".category-copyright a",
    ".category-3 a",
    "[data-category='copyright'] a",
    "[data-category='3'] a",
  ],
  character: [
    ".tag-type-character a",
    ".tag-type-4 a",
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
    ".tag-type-1 a",
    ".tag-type-creator a",
    ".tag-type-group a",
    ".tag-type-circle a",
    ".tag-type-illustrator a",
    ".tag-type-writer a",
    ".tag-type-translator a",
    ".tag-type-editor a",
    ".tag-type-colorist a",
    ".tag-type-letterer a",
    ".tag-type-mangaka a",
    ".artist-tag-list a",
    ".author-tag-list a",
    ".creator-tag-list a",
    ".group-tag-list a",
    ".circle-tag-list a",
    ".tag-list-artist a",
    ".tag-list-author a",
    ".tag-list-creator a",
    ".tag-list-group a",
    ".tag-list-circle a",
    ".category-artist a",
    ".category-author a",
    ".category-creator a",
    ".category-group a",
    ".category-circle a",
    ".category-illustrator a",
    ".category-writer a",
    ".category-translator a",
    ".category-editor a",
    ".category-colorist a",
    ".category-letterer a",
    ".category-mangaka a",
    ".category-1 a",
    "[data-category='artist'] a",
    "[data-category='author'] a",
    "[data-category='creator'] a",
    "[data-category='group'] a",
    "[data-category='circle'] a",
    "[data-category='illustrator'] a",
    "[data-category='writer'] a",
    "[data-category='translator'] a",
    "[data-category='editor'] a",
    "[data-category='colorist'] a",
    "[data-category='letterer'] a",
    "[data-category='mangaka'] a",
    "[data-category='1'] a",
  ],
} as const;

const RAW_TAG_SELECTORS = [
  ".tag-type-general a",
  ".tag-type-meta a",
  ".tag-type-0 a",
  ".tag-type-5 a",
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

  for (const element of elementsWithAnyAttribute(root, RAW_TAG_ATTRS)) {
    for (const value of RAW_TAG_ATTRS.flatMap(attr => splitSourceTags(element.getAttribute(attr)))) {
      if (!categorized.has(value)) tags.push(value);
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

export function extractBooruAuthorUrls(root: ParentNode, baseUrl = window.location.href): string[] {
  const urls: string[] = [];
  for (const selector of CATEGORY_SELECTORS.author) {
    root.querySelectorAll?.(selector).forEach((anchor) => {
      const url = absoluteHttpUrl(anchor.getAttribute("href"), baseUrl);
      if (url) urls.push(url);
    });
  }
  return [...new Set(urls)];
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
    .replace(/\s*[\[(]\s*[+-]?\d[\d,]*(?:\.\d+)?[kKmM]?\s*[\])]$/, "")
    .replace(/\s+(?:[+-]?\d[\d,]*(?:\.\d+)?[kKmM]?|[+-]\d+)$/, "")
    .trim()
    .slice(0, 120);
}

function absoluteHttpUrl(value: string | null, baseUrl: string): string {
  const raw = (value || "").trim();
  if (!raw || raw.startsWith("#") || /^javascript:/i.test(raw)) return "";
  try {
    const url = new URL(raw, baseUrl);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}
