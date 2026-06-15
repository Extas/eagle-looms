const AUTHOR_CATEGORIES = new Set([
  "artist",
  "artists",
  "author",
  "authors",
  "comic author",
  "comic authors",
  "creator",
  "creators",
  "illustrator",
  "illustrators",
  "writer",
  "writers",
  "translator",
  "translators",
  "editor",
  "editors",
  "colorist",
  "colorists",
  "letterer",
  "letterers",
  "mangaka",
  "circle",
  "circles",
  "group",
  "groups",
  "作者",
  "漫画作者",
  "漫畫作者",
  "作家",
  "漫画家",
  "漫畫家",
  "艺术家",
  "藝術家",
  "画师",
  "畫師",
  "社团",
  "社團",
  "团体",
  "團體",
]);

export function extractGalleryAuthorUrls(
  root: ParentNode,
  rowSelector: string,
  categorySelector: string,
  linkSelector: string,
  baseUrl = window.location.href,
): string[] {
  const urls: string[] = [];
  root.querySelectorAll(rowSelector).forEach(row => {
    if (!isGalleryAuthorCategory(row.querySelector(categorySelector)?.textContent)) return;

    row.querySelectorAll<HTMLAnchorElement>(linkSelector).forEach(anchor => {
      const url = absoluteHttpUrl(anchor.getAttribute("href"), baseUrl);
      if (url) urls.push(url);
    });
  });
  return [...new Set(urls)];
}

export function isGalleryAuthorCategory(value: unknown): boolean {
  return AUTHOR_CATEGORIES.has(cleanCategory(value));
}

function cleanCategory(value: unknown): string {
  return String(value ?? "")
    .replace(/[:：]\s*$/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\(\s*s\s*\)/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function absoluteHttpUrl(value: unknown, baseUrl: string): string {
  const raw = String(value ?? "").trim();
  if (!raw || raw.startsWith("#") || /^javascript:/i.test(raw)) return "";
  try {
    const url = new URL(raw, baseUrl);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}
