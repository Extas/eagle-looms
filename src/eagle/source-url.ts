const ANIME_PICTURES_POST_RE = /^\/(?:posts|pictures\/view_post)\/(\d+)(?:\/)?$/;

export function canonicalEagleSourceUrl(value: string, baseUrl: string): string {
  const fallback = value.trim();
  if (!fallback) return fallback;

  try {
    const base = new URL(baseUrl, window.location.href);
    const url = new URL(fallback, base);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      base.hash = "";
      return base.protocol === "http:" || base.protocol === "https:" ? base.href : fallback;
    }
    url.hash = "";

    const animePicturesPostId = url.hostname.replace(/^www\./, "") === "anime-pictures.net"
      ? url.pathname.match(ANIME_PICTURES_POST_RE)?.[1]
      : undefined;
    if (animePicturesPostId) {
      url.protocol = "https:";
      url.host = "anime-pictures.net";
      url.pathname = `/posts/${animePicturesPostId}`;
      url.search = "";
    }

    return url.href;
  } catch {
    return fallback;
  }
}
