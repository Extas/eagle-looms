const GALLERY_TITLE_INVALID_CHARS = /[\\/:*?"<>|\n\r\t]+/g;

export function localDateSlug(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function galleryTitle(parts: Array<string | undefined>): string {
  const cleanParts = parts.map(cleanGalleryTitlePart).filter(Boolean);
  return cleanParts.length ? cleanParts.join("-") : "gallery";
}

export function datedGalleryTitle(parts: Array<string | undefined>, date = new Date()): string {
  return galleryTitle([...parts, localDateSlug(date)]);
}

export function searchGalleryTitle(site: string, tags: string | undefined, fallback = "posts"): string {
  return galleryTitle([site, tags ? "search" : fallback, tags]);
}

export function cleanGalleryTitlePart(value: string | undefined): string {
  return safeDecode(String(value || ""))
    .normalize("NFKC")
    .replace(GALLERY_TITLE_INVALID_CHARS, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

function safeDecode(value: string): string {
  if (!/%[0-9a-f]{2}/i.test(value)) return value;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
