import { cleanSourceTag } from "./source-tags";

export interface PawchivePageAuthor {
  name: string;
  urls: string[];
}

export function pawchivePageAuthorFromDocument(doc: Document, baseUrl = window.location.href): PawchivePageAuthor {
  const name = cleanSourceTag(
    doc.querySelector(".post__user-name, .user-header__profile [itemprop='name'], .user-header__name [itemprop='name']")?.textContent,
  );
  const urls = Array.from(doc.querySelectorAll<HTMLAnchorElement>(
    ".post__user-name[href], .user-header__profile[href]",
  )).map(anchor => absoluteHttpUrl(anchor.getAttribute("href"), baseUrl)).filter(Boolean);
  return { name, urls: [...new Set(urls)] };
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
