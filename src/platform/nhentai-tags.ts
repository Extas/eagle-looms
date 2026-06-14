type NhentaiTag = {
  type?: unknown;
  url?: unknown;
};

const AUTHOR_TAG_TYPES = new Set([
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

export function nhentaiAuthorUrlsFromTags(tags: NhentaiTag[] | undefined, baseUrl = window.location.href): string[] {
  const urls = (tags || [])
    .filter(tag => AUTHOR_TAG_TYPES.has(cleanTagType(tag.type)))
    .map(tag => absoluteHttpUrl(tag.url, baseUrl))
    .filter(Boolean);
  return [...new Set(urls)];
}

export function nhentaiAuthorUrlsFromDocument(document: Document, baseUrl = window.location.href): string[] {
  const urls: string[] = [];
  document.querySelectorAll(".info > ul > li.tags").forEach((row) => {
    const category = cleanTagType(row.querySelector("span.text")?.textContent);
    if (!AUTHOR_TAG_TYPES.has(category)) return;

    row.querySelectorAll<HTMLAnchorElement>("a.tag_btn[href]").forEach((anchor) => {
      const url = absoluteHttpUrl(anchor.getAttribute("href"), baseUrl);
      if (url) urls.push(url);
    });
  });
  return [...new Set(urls)];
}

function cleanTagType(value: unknown): string {
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
