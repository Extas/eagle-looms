const AUTHOR_TAG_CATEGORIES = new Set([
  "artist",
  "artists",
  "author",
  "authors",
  "creator",
  "creators",
  "circle",
  "circles",
  "group",
  "groups",
]);

export function extractEhentaiAuthorUrls(document: Document, baseUrl = window.location.href): string[] {
  const urls: string[] = [];
  document.querySelectorAll("#taglist tr").forEach((row) => {
    const category = cleanCategory(row.querySelector("td")?.textContent || "");
    if (!AUTHOR_TAG_CATEGORIES.has(category)) return;

    row.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((anchor) => {
      const url = absoluteHttpUrl(anchor.getAttribute("href"), baseUrl);
      if (url) urls.push(url);
    });
  });
  return [...new Set(urls)];
}

function cleanCategory(value: string): string {
  return value
    .replace(/[:：]\s*$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
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
