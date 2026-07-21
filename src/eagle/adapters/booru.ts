import { GalleryMeta } from "../../download/gallery-meta";
import { searchGalleryTitle } from "../../platform/gallery-title";
import { sourceMetadataTag } from "../tags";

const CATEGORY_ATTRS = {
  copyright: [
    "data-tag-string-copyright",
    "data-tags-copyright",
    "data-copyright-tags",
    "data-tag-string-parody",
    "data-tags-parody",
    "data-parody-tags",
    "data-tag-string-series",
    "data-tags-series",
    "data-series-tags",
    "data-tag-string-work",
    "data-tags-work",
    "data-work-tags",
    "data-tag-string-source-work",
    "data-tags-source-work",
    "data-source-work-tags",
    "data-tag-string-original-work",
    "data-tags-original-work",
    "data-original-work-tags",
    "data-tag-string-franchise",
    "data-tags-franchise",
    "data-franchise-tags",
    "data-tag-string-ip",
    "data-tags-ip",
    "data-ip-tags",
    "data-tag-string-property",
    "data-tags-property",
    "data-property-tags",
  ],
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
    ".copyright-tag a",
    ".tag-list-copyright a",
    ".category-copyright a",
    ".tag-type-parody a",
    ".tag-type-series a",
    ".tag-type-work a",
    ".tag-type-source-work a",
    ".tag-type-original-work a",
    ".tag-type-franchise a",
    ".tag-type-ip a",
    ".tag-type-property a",
    ".category-parody a",
    ".category-series a",
    ".category-work a",
    ".category-source-work a",
    ".category-original-work a",
    ".category-franchise a",
    ".category-ip a",
    ".category-property a",
    ".category-3 a",
    "[data-category='copyright'] a",
    "[data-category='parody'] a",
    "[data-category='series'] a",
    "[data-category='work'] a",
    "[data-category='source-work'] a",
    "[data-category='source_work'] a",
    "[data-category='original-work'] a",
    "[data-category='original_work'] a",
    "[data-category='franchise'] a",
    "[data-category='ip'] a",
    "[data-category='property'] a",
    "[data-category='3'] a",
  ],
  character: [
    ".tag-type-character a",
    ".tag-type-4 a",
    ".character-tag-list a",
    ".character-tag a",
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
    ".artist-tag a",
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
  ".general-tag a",
  ".metadata-tag a",
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

export function normalizeCommaSeparatedBooruTagText(value: string): string {
  return value
    .split(/\s*,\s*/)
    .map(tag => cleanSourceTag(tag).replace(/\s+/g, "_"))
    .filter(Boolean)
    .join(" ");
}

export function extractBooruSourceTags(root: ParentNode, fallbackTags: string[]): string[] {
  const categorized = new Set<string>();
  const rawTags = new Set<string>();
  const tags: string[] = [];

  for (const [namespace, attrs] of Object.entries(CATEGORY_ATTRS) as Array<[keyof typeof CATEGORY_ATTRS, readonly string[]]>) {
    for (const element of elementsWithAnyAttribute(root, attrs)) {
      for (const value of attrs.flatMap(attr => splitSourceTags(element.getAttribute(attr)))) {
        categorized.add(sourceTagComparisonKey(value));
        tags.push(sourceMetadataTag(namespace, value));
      }
    }
  }

  for (const [namespace, selectors] of Object.entries(CATEGORY_SELECTORS) as Array<[keyof typeof CATEGORY_SELECTORS, readonly string[]]>) {
    for (const selector of selectors) {
      root.querySelectorAll?.(selector).forEach((anchor) => {
        const value = sourceTagValueFromAnchor(anchor);
        if (!value) return;
        categorized.add(sourceTagComparisonKey(value));
        tags.push(sourceMetadataTag(namespace, value));
      });
    }
  }

  for (const element of elementsWithAnyAttribute(root, RAW_TAG_ATTRS)) {
    for (const value of RAW_TAG_ATTRS.flatMap(attr => splitSourceTags(element.getAttribute(attr)))) {
      const key = sourceTagComparisonKey(value);
      if (!categorized.has(key)) tags.push(value);
      rawTags.add(key);
    }
  }

  for (const selector of RAW_TAG_SELECTORS) {
    root.querySelectorAll?.(selector).forEach((anchor) => {
      const value = sourceTagValueFromAnchor(anchor);
      const key = sourceTagComparisonKey(value);
      if (!value || categorized.has(key)) return;
      tags.push(value);
      rawTags.add(key);
    });
  }

  for (const tag of fallbackTags.map(cleanSourceTag).filter(Boolean)) {
    const key = sourceTagComparisonKey(tag);
    if (!categorized.has(key) && !rawTags.has(key)) tags.push(tag);
  }

  return [...new Set(tags)];
}

export function extractBooruAuthorUrls(root: ParentNode, baseUrl = window.location.href): string[] {
  const urls: string[] = [];
  for (const selector of CATEGORY_SELECTORS.author) {
    root.querySelectorAll?.(selector).forEach((anchor) => {
      if (!sourceTagValueFromAnchor(anchor)) return;
      const url = absoluteHttpUrl(anchor.getAttribute("href"), baseUrl);
      if (url) urls.push(url);
    });
  }
  return [...new Set(urls)];
}

export function booruPublishedAtFromDocument(doc: Document): string | undefined {
  return doc.querySelector<HTMLElement>("article[data-created-at]")?.getAttribute("data-created-at")
    || doc.querySelector<HTMLTimeElement>("time[datetime]")?.getAttribute("datetime")
    || doc.querySelector<HTMLMetaElement>("meta[property='article:published_time'], meta[name='date']")?.getAttribute("content")
    || textPublishedAtFromDocument(doc)
    || undefined;
}

export function booruGalleryMetaFromState(site: string, href: string, postId: string | undefined, sourceTagsById: Record<string, string[]>): GalleryMeta {
  const normalizedSite = site.toLowerCase().replace(/\s+/g, "-");
  const searchTags = searchTagsFromUrl(href);
  const title = searchGalleryTitle(normalizedSite, postId ? undefined : searchTags);
  const meta = new GalleryMeta(href, title);
  meta.tags = sourceTagsById;
  return meta;
}

export function booruEagleItemBaseName(fallback: string, sourceUrl: string, sourceTags: string[]): string {
  const identity = booruIdentityFromUrl(sourceUrl);
  if (!identity) return fallback;

  const labels = [
    shortestSourceTag(sourceTags, "author"),
    shortestSourceTag(sourceTags, "copyright"),
    `${identity.site}-${identity.id}`,
  ].filter(Boolean);
  const extension = fallback.match(/\.([a-z0-9]{1,12})$/i)?.[1]?.toLowerCase() || "jpg";
  return `${[...new Set(labels)].join(" - ")}.${extension}`;
}

function searchTagsFromUrl(href: string): string | undefined {
  try {
    return new URL(href, window.location.href).searchParams.get("tags")?.trim() || undefined;
  } catch {
    return undefined;
  }
}

function booruIdentityFromUrl(value: string): { site: string, id: string } | undefined {
  try {
    const url = new URL(value, window.location.href);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const sites: Record<string, string> = {
      "danbooru.donmai.us": "danbooru",
      "gelbooru.com": "gelbooru",
      "yande.re": "yande.re",
      "konachan.com": "konachan",
      "rule34.us": "rule34.us",
    };
    const site = sites[host];
    if (!site) return undefined;
    const id = url.pathname.match(/\/(?:posts|post\/show)\/(\d+)/)?.[1]
      || (url.searchParams.get("page") === "post" && url.searchParams.get("s") === "view" ? url.searchParams.get("id") : "")
      || (url.searchParams.get("r") === "posts/view" ? url.searchParams.get("id") : "");
    return id && /^\d+$/.test(id) ? { site, id } : undefined;
  } catch {
    return undefined;
  }
}

function shortestSourceTag(tags: string[], namespace: "author" | "copyright"): string {
  return tags
    .filter(tag => tag.toLowerCase().startsWith(`${namespace}:`))
    .map(tag => cleanSourceLabel(tag.slice(namespace.length + 1)))
    .filter(Boolean)
    .sort((left, right) => left.length - right.length || left.localeCompare(right))[0] || "";
}

function cleanSourceLabel(value: string): string {
  return value.replace(/_+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
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

function sourceTagComparisonKey(value: string): string {
  return value.normalize("NFKC").replace(/_+/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
}

function sourceTagValueFromAnchor(anchor: Element): string {
  const href = (anchor.getAttribute("href") || "").trim();
  const title = (anchor.getAttribute("title") || "").trim();
  const rowText = (anchor.closest("li")?.textContent || "").replace(/\s+/g, " ").trim();
  const value = cleanSourceTag(anchor.textContent || "");
  if (/^(?:#|javascript:)/i.test(href) || /(?:^|[?&])page=wiki(?:&|$)/i.test(href)) return "";
  if (/^(?:Added by|Created|Score|Size|Source|Id):/i.test(rowText) || /^(?:Flag for Deletion|Edit Post|Remove)$/i.test(rowText)) return "";
  if (/^(?:wiki|add to search|remove from search)$/i.test(title)) return "";
  if (value === "?") return "";
  return value;
}

function textPublishedAtFromDocument(doc: Document): string | undefined {
  for (const element of doc.querySelectorAll("#tag-list li, .tag-list li, #post-information li")) {
    const text = (element.textContent || "").replace(/\s+/g, " ").trim();
    const match = text.match(/^(?:Posted|Published|Created):\s*((?:19|20)\d{2}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?)/i);
    if (match) return match[1];
  }
  return undefined;
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
