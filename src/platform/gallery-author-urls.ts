const AUTHOR_CATEGORIES = new Set([
  "artist",
  "artists",
  "author",
  "authors",
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
    const category = cleanCategory(row.querySelector(categorySelector)?.textContent);
    if (!AUTHOR_CATEGORIES.has(category)) return;

    row.querySelectorAll<HTMLAnchorElement>(linkSelector).forEach(anchor => {
      const url = absoluteHttpUrl(anchor.getAttribute("href"), baseUrl);
      if (url) urls.push(url);
    });
  });
  return [...new Set(urls)];
}

function cleanCategory(value: unknown): string {
  return String(value ?? "")
    .replace(/[:：]\s*$/, "")
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
