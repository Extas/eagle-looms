import { isEagleAuthorCategory } from "./source-tags";

export function extractEhentaiAuthorUrls(document: Document, baseUrl = window.location.href): string[] {
  const urls: string[] = [];
  document.querySelectorAll("#taglist tr").forEach((row) => {
    if (!isEagleAuthorCategory(row.querySelector("td")?.textContent)) return;

    row.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((anchor) => {
      const url = absoluteHttpUrl(anchor.getAttribute("href"), baseUrl);
      if (url) urls.push(url);
    });
  });
  return [...new Set(urls)];
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
